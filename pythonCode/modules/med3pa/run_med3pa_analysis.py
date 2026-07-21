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
                                    get_child_id_by_name,
                                    get_dataset_as_pd_df,
                                    get_pickled_model_from_collection)

from MED3pa.datasets import DatasetsManager
from MED3pa.models import BaseModelManager
from MED3pa.med3pa import Med3paExperiment
from MED3pa.med3pa.results import to_serializable

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


class GoExecScriptRunMed3paAnalysis(GoExecutionScript):
    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self._progress["type"] = "process"

    def _custom_process(self, json_config: dict) -> dict:
        params = json_config["med3pa_params"]

        base_model = params["base_model"]        # {"id": <workspace uuid>, "name": ...}
        dataset = params["chosen_dataset"]       # {"id": <workspace uuid>, "name": ...}
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
        x = df

        ipc_params = {
            "n_estimators": ipc.get("n_estimators") or 100,
            "max_depth": ipc.get("max_depth") or None,
            "min_samples_split": ipc.get("min_samples_split") or 2,
        }
        ipc_grid_cfg = ipc.get("grid", {})
        ipc_grid = {
            "n_estimators": parse_int_list(ipc_grid_cfg.get("n_estimators"), [50, 100, 200]),
            "max_depth": parse_int_list(ipc_grid_cfg.get("max_depth"), [2, 3, 4, 5]),
            "min_samples_leaf": parse_int_list(ipc_grid_cfg.get("min_samples_leaf"), [1, 2, 4]),
        }

        apc_params = {
            "max_depth": apc.get("tree_max_depth") or 3,
            "min_samples_leaf": apc.get("min_leading_samples") or 1,
            "ccp_alpha": apc.get("ccp_alpha") or 0.1,
        }
        apc_grid_cfg = apc.get("grid", {})
        apc_grid = {
            "max_depth": parse_int_list(apc_grid_cfg.get("max_depth"), [2, 3, 4, 5]),
            "min_samples_leaf": parse_int_list(apc_grid_cfg.get("min_samples_leaf"), [1, 2, 4]),
        }

        _ = mpc_strategy  # add when package updates

        self.set_progress(label="Loading base model", now=30)

        # A "model" MEDDataObject is a directory; the pickled estimator lives in
        # its "model_sklearn.pkl" child (pure sklearn, no pycaret dependency).
        # Fall back to the full-pipeline "model.pkl" for models saved before the
        # pycaret-free estimator export existed.
        if not base_model or "id" not in base_model:
            raise ValueError("No base model was selected in the frontend.")

        pickle_object_id = get_child_id_by_name(base_model["id"], "model_sklearn.pkl")
        if pickle_object_id is None:
            pickle_object_id = get_child_id_by_name(base_model["id"], "model.pkl")
        if pickle_object_id is None:
            raise ValueError(
                f"Could not find 'model_sklearn.pkl' or 'model.pkl' inside model '{base_model.get('name')}'."
            )
        base_mdl = get_pickled_model_from_collection(pickle_object_id)
        if base_mdl is None:
            raise ValueError("The base model could not be loaded from the database.")
        base_model_manager = BaseModelManager(model=base_mdl)


        datasets = DatasetsManager()
        datasets.set_from_data(
            dataset_type="testing",
            observations=x.to_numpy(),
            true_labels=y,
            column_labels=list(x.columns),
        )

        self.set_progress(label="Running MED3pa experiment", now=50)

        samples_ratio = params.get("samples_ratio") or {}
        results = Med3paExperiment.run(
            datasets_manager=datasets,
            base_model_manager=base_model_manager,
            uncertainty_metric=ipc.get("confidence_metric") or "sigmoidal_error",
            ipc_type=ipc.get("ipc_type") or "EnsembleRandomForestRegressor",
            ipc_params=ipc_params,
            apc_params=apc_params,
            ipc_grid_params=ipc_grid,
            apc_grid_params=apc_grid,
            samples_ratio_min=samples_ratio.get("min", 0),
            samples_ratio_max=samples_ratio.get("max", 10),
            samples_ratio_step=samples_ratio.get("step", 5),
            evaluate_models=params.get("evaluate_models", True),
        )

        self.set_progress(label="Saving results", now=90)

        test_record = results.test_record

        def serialize(obj, save_all=True):
            """Round-trip through JSON so numpy types / Profile objects become
            plain dicts and int keys become strings (BSON requires string keys)."""
            if obj is None:
                return None
            if save_all:
                return json.loads(json.dumps(obj, default=to_serializable))
            return json.loads(json.dumps(obj, default=lambda o: to_serializable(o, additional_arg=False)))

        session_doc = {
            "name": session_name,
            "created_at": datetime.datetime.now().isoformat(),
            "status": "completed",
            "config": serialize(params),
            "base_model": base_model,
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

        # Pickle the trained IPC/APC models so a deployment can reuse them later
        try:
            models_doc = {
                "session_name": session_name,
                "created_at": session_doc["created_at"],
                "ipc_model": Binary(pickle.dumps(results.ipc_model)) if results.ipc_model else None,
                "apc_model": Binary(pickle.dumps(results.apc_model)) if results.apc_model else None,
            }
            db["med3pa_models"].replace_one({"session_name": session_name}, models_doc, upsert=True)
        except Exception as e:
            # A model bigger than the 16MB BSON cap must not lose the analysis results;
            # deployment for this session will just be unavailable.
            go_print(f"WARNING: could not store IPC/APC models for session '{session_name}': {e}")

        self.results = {"status": "completed", "session_name": session_name}
        self.set_progress(label="Done", now=100)
        return self.results


runMed3pa = GoExecScriptRunMed3paAnalysis(json_params_dict, id_)
runMed3pa.start()