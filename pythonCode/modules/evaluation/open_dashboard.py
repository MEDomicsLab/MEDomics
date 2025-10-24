import json
import os
import sys
import threading
import time
import types
from pathlib import Path

import numpy as np
import pandas as pd
from explainerdashboard import ClassifierExplainer, ExplainerDashboard, RegressionExplainer
from explainerdashboard.explainer_methods import guess_shap
from pycaret.internal.pipeline import Pipeline

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import (
    connect_to_mongo,
    get_child_id_by_name,
    get_dataset_as_pd_df,
    get_pickled_model_from_collection,
)
from med_libs.server_utils import (
    find_next_available_port,
    go_print,
    is_port_in_use,
    load_csv,
    load_med_standard_data,
)

# --- Pandas >= 2.0 safeguard (iteritems removed) ---------------------------
# Some libraries still expect Series/DataFrame.iteritems; alias to items if absent.
if not hasattr(pd.Series, "iteritems"):
    pd.Series.iteritems = pd.Series.items
if not hasattr(pd.DataFrame, "iteritems"):
    pd.DataFrame.iteritems = pd.DataFrame.items
# ---------------------------------------------------------------------------

CLASSIFIER_NOT_SUPPORTING_NAN = [
    "LogisticRegression",
    "KNeighborsClassifier",
    "GaussianNB",
    "DecisionTreeClassifier",
    "SGDClassifier",
    "SVC",
    "GaussianProcessClassifier",
    "MLPClassifier",
    "RidgeClassifier",
    "RandomForestClassifier",
    "QuadraticDiscriminantAnalysis",
    "AdaBoostClassifier",
    "GradientBoostingClassifier",
    "LinearDiscriminantAnalysis",
    "ExtraTreesClassifier",
]
REGRESSOR_NOT_SUPPORTING_NAN = []  # TODO: add regressors not supporting NaN


def predict_proba(self, X):
    """Fallback predict_proba for classifiers without it (e.g., SGDClassifier)."""
    pred = self.predict(X)
    return np.array([1 - pred, pred]).T


json_params_dict, id_ = parse_arguments()


class GoExecScriptOpenDashboard(GoExecutionScript):
    """
    Run a dashboard from Go. Builds an ExplainerDashboard on top of a trained model
    and a provided dataset, with SHAP safeguards to avoid common crashes.
    """

    def __init__(self, json_params: dict, _id: str = "default_id"):
        super().__init__(json_params, _id)
        self.model = None
        self.port = None
        self.now = 0
        self._progress["type"] = "dashboard"
        self.thread_delay = 2
        self.speed = 2  # rows/second
        self.row_count = 10000
        self.ed: ExplainerDashboard = None
        self.is_calculating = True
        self.progress_thread = threading.Thread(
            target=self._update_progress_periodically, args=()
        )
        self.progress_thread.daemon = True
        self.progress_thread.start()
        self.dashboard_thread = threading.Thread(target=self._server_dashboard, args=())
        self.dashboard_thread.daemon = True

    def _custom_process(self, json_config: dict) -> dict:
        """
        Main script opening the dashboard.
        """
        go_print(json.dumps(json_config, indent=4))

        # Initialize data and load model
        db = connect_to_mongo()
        model_infos = json_config["model"]
        dataset_infos = json_config["dataset"]
        ml_type = json_config["ml_type"]
        target = json_config["target"]
        dashboard_name = json_config["dashboardName"]
        sample_size = json_config["sampleSizeFrac"]
        pickle_object_id = get_child_id_by_name(model_infos["id"], "model.pkl")
        
        # Check if pickle_object_id is None
        if pickle_object_id is None:
            raise ValueError("Could not find the model.pkl in the database.")
        
        # Load dataset
        self.set_progress(label="Loading the dataset and model")
        use_med_standard = json_config["useMedStandard"]
        if use_med_standard:
            temp_df = load_med_standard_data(
                db,
                dataset_infos["selectedDatasets"],
                json_config["selectedVariables"],
                target,
            )
        elif "path" in dataset_infos:
            temp_df = load_csv(dataset_infos["path"], model_infos["target"])
        elif "id" in dataset_infos:
            temp_df = get_dataset_as_pd_df(dataset_infos["id"])
        else:
            print("dataset_infos", dataset_infos)
            raise ValueError("Dataset has no ID and is not MEDomicsLab standard")

        # Load the model
        self.model = get_pickled_model_from_collection(pickle_object_id)
        go_print(f"model loaded: {self.model}")

        # Check if model is not None
        if self.model is None:
            raise ValueError("The model could not be loaded from the database.")

        # Apply all model transformations on the dataset
        self.set_progress(label="Applying model transformations")
        if type(self.model) == Pipeline and hasattr(self.model, 'transform'):
            temp_df = self.model.transform(temp_df)
            self.model = self.model.steps[-1][1]    # Unwrap the Pipeline to get the actual model

        # Optional downsample for SHAP performance and stability
        if sample_size < 1:
            temp_df = temp_df.sample(frac=sample_size, random_state=42)
        
        # Determine columns used by the trained model (if exposed)
        columns_to_keep = None
        if "feature_names_in_" in dir(self.model):
            columns_to_keep = list(getattr(self.model, "feature_names_in_"))
        if "feature_name_" in dir(self.model) and columns_to_keep is None:
            columns_to_keep = list(getattr(self.model, "feature_name_"))

        go_print(f"MODEL NAME: {self.model.__class__.__name__}")

        # Monkey patch predict_proba for classifiers lacking it
        if ml_type == "classification" and not hasattr(self.model, "predict_proba"):
            self.model.predict_proba = types.MethodType(predict_proba, self.model)

        # If the model does not support NaN values, drop rows with missing values
        if ml_type == "classification" and (
            self.model.__class__.__name__ in CLASSIFIER_NOT_SUPPORTING_NAN
        ):
            # Alternative: temp_df.fillna(temp_df.mean(), inplace=True)
            temp_df.dropna(how="any", inplace=True)

        # --- Dataset sanitization for Explainer/SHAP ------------------------
        # 1) Normalize column names and drop technical identifiers (_id/id)
        temp_df.columns = temp_df.columns.str.strip().str.replace(" ", "_")
        for c in ["_id", "id"]:
            if c in temp_df.columns:
                temp_df.drop(columns=[c], inplace=True, errors="ignore")

        # 2) Align to model's expected columns if available
        if columns_to_keep is not None:
            try:
                if target not in columns_to_keep:
                    columns_to_keep.append(target)
                # Reindex to preserve order and fill missing features with 0
                temp_df = temp_df.reindex(columns=columns_to_keep, fill_value=0)
            except Exception as e:
                raise ValueError(f"Error aligning dataset to model's expected features: {e}")

        # 3) Split features/target with guards
        if target not in temp_df.columns:
            raise ValueError(f"Target column '{target}' not found after preprocessing.")
        X_test = temp_df.drop(columns=target)
        y_test = temp_df[target]

        if X_test.shape[0] == 0:
            raise ValueError("Dataset has zero rows after preprocessing (nothing to explain).")
        if X_test.shape[1] == 0:
            raise ValueError("Dataset has zero feature columns after preprocessing.")

        # 4) Sanity check: ensure model can predict on a single-row slice
        _ = self.model.predict(X_test.iloc[[0], :])
        if ml_type == "classification" and hasattr(self.model, "predict_proba"):
            _ = self.model.predict_proba(X_test.iloc[[0], :])

        # Build Explainer with SHAP additivity check disabled (avoids reduction errors)
        explainer = None

        # Init shap kwargs
        shap_kwargs = None
        shap_type = guess_shap(self.model)
        if shap_type == "tree":
            shap_kwargs = {"check_additivity": False}

        # Handle binary classification edge case
        self.set_progress(label="Testing SHAP computations")
        if ml_type == "classification":
            explainer = ClassifierExplainer(
                self.model,
                X_test,
                y_test,
                shap_kwargs=shap_kwargs,
                # model_output="probability",  # uncomment if you want SHAP to explain probabilities
            )
        elif ml_type == "regression":
            explainer = RegressionExplainer(
                self.model, X_test, y_test, shap_kwargs=shap_kwargs
            )

        # Trigger a light SHAP computation; if it fails, fallback to a smaller sample
        try:
            _ = explainer.columns_ranked_by_shap()
        except Exception as e:
            print("SHAP initial computation failed, falling back with smaller sample:", e)
            n = min(500, len(X_test))
            X_small = X_test.sample(n=n, random_state=42)
            y_small = y_test.loc[X_small.index] if y_test is not None else None
            if ml_type == "classification":
                explainer = ClassifierExplainer(
                    self.model, X_small, y_small, shap_kwargs=shap_kwargs
                )
            else:
                explainer = RegressionExplainer(
                    self.model, X_small, y_small, shap_kwargs=shap_kwargs
                )

        # Progress & dashboard startup
        self.set_progress(label="Building the dashboard")
        self.row_count = len(y_test)
        self._progress["duration"] = "{:.2f}".format(self.row_count / self.speed / 60.0)
        self.now = 0
        self.ed = ExplainerDashboard(explainer, title=dashboard_name, mode="dash")
        self.now = 100
        go_print("dashboard created")
        self.port = find_next_available_port()
        self.dashboard_thread.start()
        self.progress_thread.join()
        self.dashboard_thread.join()
        return {"results_html": "html"}

    def _update_progress_periodically(self):
        """
        Update the progress of the pipeline execution and expose dashboard URL once ready.
        """
        while self.is_calculating:
            if self.port is not None:
                if is_port_in_use(self.port):
                    self._progress["dashboard_url"] = f"http://localhost:{self.port}/"
                    self._progress["port"] = self.port
                    go_print("self.ed run state" + str(self.ed.app))
                    self.is_calculating = False

            self.now += round(self.thread_delay * self.speed / self.row_count * 100, 2)
            self._progress["now"] = "{:.2f}".format(self.now)
            self.push_progress()
            time.sleep(self.thread_delay)

    def _server_dashboard(self):
        """
        Run the dashboard server.
        """
        self.ed.run(host="localhost", port=self.port, use_waitress=True, mode="dash")


open_dashboard = GoExecScriptOpenDashboard(json_params_dict, id_)
open_dashboard.start()
