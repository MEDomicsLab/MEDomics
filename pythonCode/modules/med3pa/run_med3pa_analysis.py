import os
import sys
import json
import pickle
import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from bson.binary import Binary

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import (connect_to_mongo,
                                    get_dataset_as_pd_df)
from med_libs.model_loading import (get_model_feature_columns,
                                    load_base_model)

from MED3pa.datasets import DatasetsManager
from MED3pa.models import BaseModelManager
from MED3pa.med3pa import Med3paExperiment
from MED3pa.med3pa.models import APCModel, IPCModel, MPCModel
from MED3pa.med3pa.profiles import Profile
from MED3pa.med3pa.results import to_serializable
from MED3pa.med3pa.uncertainty import UncertaintyMetric

from modules.med3pa.confidence_metrics import (describe_confidence_metric,
                                               resolve_confidence_metric)
from modules.med3pa.mpc_strategies import (describe_mpc_strategy,
                                           resolve_mpc_strategy)


json_params_dict, id_ = parse_arguments()
go_print("running run_med3pa_analysis.py:" + id_)

def parse_int_list(value, default):
    """Turn a frontend value into a list of ints.

    The grid-search fields arrive as comma-separated strings (e.g. "50, 100, 200").
    Accepts an already-parsed list too, and falls back to `default` when empty.
    """
    if value is None or value == "":
        return default
    if isinstance(value, list):
        return [int(v) for v in value]
    return [int(v.strip()) for v in str(value).split(",") if v.strip() != ""]


def build_grid(grid_cfg, fields):
    """Build a grid-search dict from only the fields the user actually filled in.

    Returns None when every field was left blank, which tells MED3pa to train
    directly. Defaulting the blanks instead would silently run a grid search
    nobody asked for on every analysis.
    """
    grid = {}
    for field in fields:
        values = parse_int_list(grid_cfg.get(field), None)
        if values:
            grid[field] = values
    return grid or None


class GoExecScriptRunMed3paAnalysis(GoExecutionScript):
    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self._progress["type"] = "process"
        self.warnings = []

    def warn(self, message: str) -> None:
        """Record a warning where it can actually be seen.

        go_print writes to stdout, but the Go server's copyOutput only reacts to
        "response-ready*_*" and "progress*_*" lines and drops everything else on
        the floor. copyOutputErr logs every stderr line, so warnings go there,
        and they are also stored on the session document so the UI can show what
        the run silently changed.
        """
        self.warnings.append(message)
        print(f"WARNING: {message}", file=sys.stderr, flush=True)

    def _custom_process(self, json_config: dict) -> dict:
        params = json_config["med3pa_params"]

        base_model = params.get("base_model")    # {"id": <workspace uuid>, "name": ...}
        dataset = params["chosen_dataset"]       # {"id": <workspace uuid>, "name": ...}
        # Alternative to a base model: a column of already-computed predicted
        # probabilities. MED3pa only uses the base model to fill in
        # pseudo-probabilities, so supplying them directly works for models we
        # have no loader for.
        probability_column = params.get("probability_column")
        ipc = params["ipc"]
        apc = params["apc"]
        mpc_strategy = params["mpc_strategy"]
        session_name = params.get("session_name") or "med3pa_session"

        self.set_progress(label="Loading dataset", now=10)

        # The frontend sends a workspace UUID (dataset["id"]), not a file path.
        # MEDomicsLab stores the dataset content in a MongoDB collection whose
        # name IS that UUID, so we read it straight back into a DataFrame.
        if not dataset or "id" not in dataset:
            raise ValueError("No dataset was selected in the frontend.")

        target_column = params.get("target_column")
        if not target_column:
            raise ValueError("No target column was specified in the frontend.")

        df = get_dataset_as_pd_df(dataset["id"])
        if target_column not in df.columns:
            raise ValueError(
                f"Target column '{target_column}' not found in dataset "
                f"'{dataset.get('name')}'. Available columns: {list(df.columns)}"
            )
        y = np.array(df.pop(target_column))

        if bool(base_model) == bool(probability_column):
            raise ValueError(
                "Select either a base model or a column of predicted "
                "probabilities, but not both."
            )

        probabilities = None
        if probability_column:
            if probability_column not in df.columns:
                raise ValueError(
                    f"Probability column '{probability_column}' not found in dataset "
                    f"'{dataset.get('name')}'. Available columns: {list(df.columns)}"
                )
            probabilities = np.asarray(df.pop(probability_column), dtype=float)
            if probabilities.min() < 0 or probabilities.max() > 1:
                raise ValueError(
                    f"Column '{probability_column}' holds values in "
                    f"[{probabilities.min():.3f}, {probabilities.max():.3f}], which are "
                    f"not probabilities. It must contain the predicted probability of "
                    f"the positive class."
                )

        ipc_params = {
            "n_estimators": ipc.get("n_estimators") or 100,
            "max_depth": ipc.get("max_depth") or None,
            "min_samples_split": ipc.get("min_samples_split") or 2,
        }
        ipc_type = ipc.get("ipc_type") or "RandomForestRegressor"
        ipc_grid = build_grid(ipc.get("grid") or {},
                              ("n_estimators", "max_depth", "min_samples_leaf"))

        # MED3pa's IPCModel.optimize ends with `self.model.set_model(best_estimator_)`,
        # which writes the fitted winner to the ensemble's `.model` attribute — but
        # EnsembleRandomForestRegressorModel.predict reads `self.models`, the list of
        # inner regressors, which is left untrained. Grid-searching that model type
        # therefore always ends in NotFittedError, so train it directly instead.
        if ipc_grid and ipc_type == "EnsembleRandomForestRegressor":
            self.warn(
                f"IPC grid search was NOT run. MED3pa cannot grid-search "
                f"EnsembleRandomForestRegressor: IPCModel.optimize stores the tuned model "
                f"where the ensemble's predict() never reads it, which raises NotFittedError. "
                f"Your grid {ipc_grid} was ignored and the IPC was trained directly with "
                f"n_estimators={ipc_params['n_estimators']}, max_depth={ipc_params['max_depth']}, "
                f"min_samples_split={ipc_params['min_samples_split']}. "
                f"Choose a different ipc_type to use the grid."
            )
            ipc_grid = None

        apc_params = {
            "max_depth": apc.get("tree_max_depth") or 3,
            "min_samples_leaf": apc.get("min_leading_samples") or 1,
            "ccp_alpha": apc.get("ccp_alpha") or 0.1,
        }
        apc_grid = build_grid(apc.get("grid") or {}, ("max_depth", "min_samples_leaf"))

        # Same treatment as the IPC confidence metric: a built-in name or a
        # formula over the IPC and APC confidence columns, resolved to one object.
        mpc_strategy = resolve_mpc_strategy(mpc_strategy, warn=self.warn)

        self.set_progress(label="Loading base model", now=30)

        base_model_manager = None
        model_threshold = 0.5
        feature_columns = None
        if base_model:
            if "id" not in base_model:
                raise ValueError("The selected base model has no workspace id.")
            base_mdl, model_metadata = load_base_model(base_model["id"])
            feature_columns = get_model_feature_columns(model_metadata)
            model_threshold = model_metadata.get("model_threshold") or 0.5

            # BaseModelManager.threshold reads `.threshold` off the wrapped model
            # and otherwise defaults to 0.5, so a declared threshold only takes
            # effect if it is put there. Without this, the threshold recorded at
            # import (or by pycaret's threshold optimisation) is silently ignored
            # when MED3pa turns probabilities into pseudo-labels.
            if model_threshold != 0.5 and not hasattr(base_mdl, "threshold"):
                try:
                    base_mdl.threshold = model_threshold
                    self.warn(
                        f"Using the model's declared decision threshold "
                        f"{model_threshold} instead of 0.5. Earlier runs of this "
                        f"session ignored it, so results will differ from them."
                    )
                except AttributeError:
                    self.warn(
                        f"Model '{base_model.get('name')}' declares a decision "
                        f"threshold of {model_threshold}, but it could not be applied "
                        f"to a {type(base_mdl).__name__}, so MED3pa used 0.5."
                    )
            base_model_manager = BaseModelManager(model=base_mdl)
        else:
            model_threshold = params.get("probability_threshold") or 0.5

        # Feed the model its own feature space, in its own order. Relying on the
        # dataset's leftover column order silently produces plausible-looking
        # nonsense whenever the CSV does not match how the model was trained --
        # which an externally imported model has no reason to do.
        if feature_columns:
            missing = [c for c in feature_columns if c not in df.columns]
            if missing:
                raise ValueError(
                    f"Dataset '{dataset.get('name')}' is missing columns the model "
                    f"expects: {missing}. Available columns: {list(df.columns)}"
                )
            x = df[feature_columns]
        else:
            x = df
            if base_model:
                # Only a concern when the model is the one producing predictions;
                # with probabilities supplied, column order just names IPC/APC
                # features and cannot make a prediction wrong.
                self.warn(
                    f"Base model '{base_model.get('name')}' declares no feature list, "
                    f"so the dataset's own column order was used. If it does not match "
                    f"the order the model was trained on, every prediction in this "
                    f"analysis is wrong."
                )

        datasets = DatasetsManager()
        datasets.set_from_data(
            dataset_type="testing",
            observations=x.to_numpy(),
            true_labels=y,
            column_labels=list(x.columns),
        )

        # With probabilities supplied up front, MED3pa never asks for a base
        # model (Med3paExperiment._setup_dataset only calls predict_proba when
        # the dataset has no pseudo-probabilities yet).
        if probabilities is not None:
            testing_set = datasets.get_dataset_by_type(
                dataset_type="testing", return_instance=True
            )
            testing_set.set_pseudo_probs_labels(probabilities, model_threshold)

        # "confidence_metric" is either a built-in MED3pa metric name or a formula
        # typed into the config form. Both become an UncertaintyMetric instance:
        # MED3pa 1.0.4 stores the class for its string path and then calls
        # calculate() unbound, so passing a bare name through raises TypeError.
        uncertainty_metric = resolve_confidence_metric(ipc.get("confidence_metric"), warn=self.warn)
        go_print(f"MED3pa confidence metric: {describe_confidence_metric(uncertainty_metric)}")
        go_print(f"MED3pa MPC strategy: {describe_mpc_strategy(mpc_strategy)}")

        self.set_progress(label="Running MED3pa experiment", now=50)

        samples_ratio = params.get("samples_ratio") or {}
        results = Med3paExperiment.run(
            datasets_manager=datasets,
            base_model_manager=base_model_manager,
            uncertainty_metric=uncertainty_metric,
            ipc_type=ipc_type,
            ipc_params=ipc_params,
            apc_params=apc_params,
            ipc_grid_params=ipc_grid,
            apc_grid_params=apc_grid,
            samples_ratio_min=samples_ratio.get("min", 0),
            samples_ratio_max=samples_ratio.get("max", 10),
            samples_ratio_step=samples_ratio.get("step", 5),
            evaluate_models=params.get("evaluate_models", True),
            mpc_strategy=mpc_strategy,
        )

        self.set_progress(label="Saving results", now=90)

        test_record = results.test_record

        def serialize(obj, save_all=True):
            """Round-trip through JSON so numpy types / Profile objects become
            plain dicts and int keys become strings (BSON requires string keys)."""
            if obj is None:
                return None

            def default(o):
                # experiment_config carries the metric itself, which is a live
                # object for a custom formula; store the formula text instead.
                if isinstance(o, UncertaintyMetric):
                    return describe_confidence_metric(o)
                # MED3pa used to expose Profile.to_dict(save_all) and drop the
                # metrics for the trimmed form. It now takes no argument, and
                # to_serializable still forwards one whenever additional_arg is
                # not None -- including False -- so asking for the trimmed form
                # raises TypeError. Build it here instead.
                if isinstance(o, Profile):
                    record = o.to_dict()
                    if save_all:
                        return record
                    return {"id": record["id"], "path": record["path"]}
                return to_serializable(o)

            return json.loads(json.dumps(obj, default=default))

        session_doc = {
            "name": session_name,
            "created_at": datetime.datetime.now().isoformat(),
            "status": "completed",
            "config": serialize(params),
            # Anything the run silently changed (a dropped grid search, a metric
            # returning values outside [0, 1]) — stdout warnings are discarded by
            # the Go server, so this is the only durable record.
            "warnings": self.warnings,
            "base_model": base_model,
            # None unless the run used supplied probabilities instead of a model;
            # deployments need to know so they can ask for the same column again.
            "probability_column": probability_column,
            "probability_threshold": model_threshold,
            "dataset": dataset,
            "target_column": target_column,
            "dataset_size": int(len(y)),
            "columns": list(x.columns),
            "metrics_by_dr": serialize(test_record.metrics_by_dr),
            "profiles": serialize(test_record.profiles_manager.get_profiles()) if test_record.profiles_manager else None,
            "lost_profiles": serialize(test_record.profiles_manager.get_lost_profiles(), save_all=False) if test_record.profiles_manager else None,
            "tree": serialize(test_record.tree.to_dict()) if test_record.tree else None,
            "models_evaluation": serialize(test_record.models_evaluation),
            "experiment_config": serialize(results.experiment_config),
        }

        db = connect_to_mongo()
        # One doc per session name: re-running a session overwrites it
        db["med3pa_sessions"].replace_one({"name": session_name}, session_doc, upsert=True)

        # Pickle the trained IPC/APC models so a deployment can reuse them later.
        # Med3paResults exposes them only through `confidence_model`, which is the
        # model matching the experiment's `mode` — an MPCModel by default, wrapping
        # both sub-models.
        try:
            confidence_model = results.confidence_model
            if isinstance(confidence_model, MPCModel):
                ipc_model = confidence_model.IPC_model
                apc_model = confidence_model.APC_model
            elif isinstance(confidence_model, IPCModel):
                ipc_model, apc_model = confidence_model, None
            elif isinstance(confidence_model, APCModel):
                ipc_model, apc_model = None, confidence_model
            else:
                raise TypeError(
                    f"Unexpected confidence model type {type(confidence_model).__name__}; "
                    f"cannot tell which sub-models to store for deployment."
                )
            if ipc_model is None:
                raise ValueError(
                    "The experiment produced no IPC model, which the deployment path requires."
                )

            models_doc = {
                "session_name": session_name,
                "created_at": session_doc["created_at"],
                "ipc_model": Binary(pickle.dumps(ipc_model)),
                "apc_model": Binary(pickle.dumps(apc_model)) if apc_model is not None else None,
            }
            db["med3pa_models"].replace_one({"session_name": session_name}, models_doc, upsert=True)
        except Exception as e:
            # A model bigger than the 16MB BSON cap must not lose the analysis results,
            # so this stays non-fatal — but it has to be visible, because a silent
            # failure here makes deployment impossible with a misleading error.
            self.warn(
                f"could not store the trained models for session '{session_name}': "
                f"{type(e).__name__}: {e}. The analysis was saved, but deploying this "
                f"session will fail until it is re-run successfully."
            )

        self.results = {"status": "completed", "session_name": session_name,
                        "warnings": self.warnings}
        self.set_progress(label="Done", now=100)
        return self.results


runMed3pa = GoExecScriptRunMed3paAnalysis(json_params_dict, id_)
runMed3pa.start()