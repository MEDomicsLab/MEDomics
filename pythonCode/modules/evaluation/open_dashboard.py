import json
import os
import sys
import threading
import time
import types
from pathlib import Path

import numpy as np
from explainerdashboard import ClassifierExplainer, ExplainerDashboard, RegressionExplainer

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import (connect_to_mongo, get_child_id_by_name,
                                    get_dataset_as_pd_df,
                                    get_pickled_model_from_collection)
from med_libs.server_utils import (find_next_available_port, go_print,
                                   is_port_in_use, load_csv, load_med_standard_data)

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
REGRESSOR_NOT_SUPPORTING_NAN = [] # TODO: add regressors not supporting nan
    

def predict_proba(self, X):
    pred = self.predict(X)
    return np.array([1-pred, pred]).T 

json_params_dict, id_ = parse_arguments()


class GoExecScriptOpenDashboard(GoExecutionScript):
    """
        This class is used to run a script from Go to open a dashboard
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
        self.ed:ExplainerDashboard = None
        self.is_calculating = True
        self.progress_thread = threading.Thread(target=self._update_progress_periodically, args=())
        self.progress_thread.daemon = True
        self.progress_thread.start()
        self.dashboard_thread = threading.Thread(target=self._server_dashboard, args=())
        self.dashboard_thread.daemon = True

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script opening the dashboard
        """
        go_print(json.dumps(json_config, indent=4))

        # Initialize data and load model
        db = connect_to_mongo()
        model_infos = json_config['model']
        dataset_infos = json_config['dataset']
        ml_type = json_config['ml_type']
        target = json_config['target']
        dashboard_name = json_config['dashboardName']
        sample_size = json_config['sampleSizeFrac']
        pickle_object_id = get_child_id_by_name(model_infos['id'], "model.pkl")
        self.model = get_pickled_model_from_collection(pickle_object_id)

        go_print(f"model loaded: {self.model}")
        
        columns_to_keep = None
        # Get the feature names from the model
        if dir(self.model).__contains__('feature_names_in_'):
            columns_to_keep = self.model.__getattribute__('feature_names_in_').tolist()

        if dir(self.model).__contains__('feature_name_') and columns_to_keep is None:
            columns_to_keep = self.model.__getattribute__('feature_name_')
            
        use_med_standard = json_config['useMedStandard']
        if use_med_standard:
            temp_df = load_med_standard_data(
                db,
                dataset_infos['selectedDatasets'],
                json_config['selectedVariables'], 
                target
            )
        elif 'path' in dataset_infos:
            temp_df = load_csv(dataset_infos['path'], model_infos['target'])
        elif 'id' in dataset_infos:
            temp_df = get_dataset_as_pd_df(dataset_infos['id'])
        else:
            print("dataset_infos", dataset_infos)
            raise ValueError("Dataset has no ID and is not MEDomicsLab standard")
            
        if sample_size < 1:
            temp_df = temp_df.sample(frac=sample_size)

        go_print(f"MODEL NAME: {self.model.__class__.__name__}")
        # Monkey patch the predict_proba method for the SGDClassifier
        # "SGDClassifier" and self.model.__class__.__name__ == "SGDClassifier" RidgeClassifier
        if ml_type == "classification" and not hasattr(self.model, "predict_proba"):
            self.model.predict_proba = types.MethodType(predict_proba, self.model)

        # If the model does not support nan values, we remove the rows with missing values (model is not in the list of models supporting nan)
        if ml_type == "classification" and self.model.__class__.__name__ in CLASSIFIER_NOT_SUPPORTING_NAN:
            # temp_df.fillna(temp_df.mean(), inplace=True)
            temp_df.dropna(how='any', inplace=True)
        
        # Remove columns with spaces in the name
        temp_df.columns = temp_df.columns.str.replace(' ', '_')
        
        # Add the target to the columns to keep if it's not already there
        if columns_to_keep is not None:
            if target not in columns_to_keep:
                columns_to_keep.append(target)        
            # Keep only the columns that are in the model
            temp_df = temp_df[columns_to_keep]     

        X_test = temp_df.drop(columns=target)
        y_test = temp_df[target]
        explainer = None
        if ml_type == "classification":
            # Check if y is binary (only two unique values)
            unique_values = y_test.squeeze().unique()
            if len(unique_values) == 2:
                # Proceed with conversion
                print(f"Converting y to binary {unique_values[0]} is now 0 and {unique_values[1]} is now 1")
                y_test = y_test.apply(lambda x: 1 if x == unique_values[1] else 0)
            explainer = ClassifierExplainer(self.model, X_test, y_test)
        elif ml_type == "regression":
            explainer = RegressionExplainer(self.model, X_test, y_test)

        self.row_count = len(y_test)
        self._progress["duration"] = "{:.2f}".format(self.row_count / self.speed / 60.0)
        self.now = 0
        self.ed = ExplainerDashboard(explainer, title=dashboard_name, mode="dash")
        self.now = 100
        go_print(f"dashboard created")
        self.port = find_next_available_port()
        self.dashboard_thread.start()
        self.progress_thread.join()
        self.dashboard_thread.join()
        return {"results_html": "html"}

    def _update_progress_periodically(self):
        """
        This function is used to update the progress of the pipeline execution.
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
        This function is used to run the dashboard
        """
        self.ed.run(host="localhost", port=self.port, use_waitress=True, mode="dash")


open_dashboard = GoExecScriptOpenDashboard(json_params_dict, id_)
open_dashboard.start()
