import os
import sys
import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import (get_child_id_by_name,
                                    get_dataset_as_pd_df,
                                    get_pickled_model_from_collection)

from MED3pa.datasets import DatasetsManager
from MED3pa.models import BaseModelManager
from MED3pa.med3pa import Med3paExperiment

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
        # its "model.pkl" child. Resolve that child id, then unpickle it from Mongo.
        if not base_model or "id" not in base_model:
            raise ValueError("No base model was selected in the frontend.")

        pickle_object_id = get_child_id_by_name(base_model["id"], "model.pkl") #generalize for all .pkl but also all .medmodel
        if pickle_object_id is None:
            raise ValueError(
                f"Could not find 'model.pkl' inside model '{base_model.get('name')}'."
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

        output_dir = os.path.join("experiments", "results", "med3pa", session_name)
        os.makedirs(output_dir, exist_ok=True)
        results.save(file_path=output_dir)

        self.results = {"status": "completed", "output_dir": output_dir}
        self.set_progress(label="Done", now=100)
        return self.results


runMed3pa = GoExecScriptRunMed3paAnalysis(json_params_dict, id_)
runMed3pa.start()