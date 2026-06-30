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

from MED3pa.datasets import DatasetsManager
from MED3pa.models import BaseModelManager
from MED3pa.med3pa import Med3paExperiment

json_params_dict, id_ = parse_arguments()
go_print("running run_med3pa_analysis.py:" + id_)


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
        # Resolving that UUID to an actual CSV path is not wired yet, so hardcode.
        dataset_path = "datasets/in_hospital_mortality/mimic_filtered_data.csv"  # add input from frontend
        target_column = "deceased"  # add input from frontend

        df = pd.read_csv(dataset_path)
        y = np.array(df.pop(target_column))
        x = df

        ipc_params = {
            "n_estimators": ipc.get("n_estimators") or 100,
            "max_depth": ipc.get("max_depth") or None,
            "min_samples_split": ipc.get("min_samples_split") or 2,
        }
        # Grid-search ranges are not exposed in the UI yet.
        ipc_grid = {  # add input from frontend
            "n_estimators": [50, 100, 200],
            "max_depth": [2, 3, 4, 5],
            "min_samples_leaf": [1, 2, 4],
        }

        apc_params = {
            "max_depth": apc.get("tree_max_depth") or 3,
            "min_samples_leaf": apc.get("min_leading_samples") or 1,
            "ccp_alpha": apc.get("ccp_alpha") or 0.0,
        }
        apc_grid = {  # add input from frontend
            "max_depth": [2, 3, 4, 5],
            "min_samples_leaf": [1, 2, 4],
        }

        _ = mpc_strategy  # add when package updates

        self.set_progress(label="Loading base model", now=30)


        base_model_path = "datasets/in_hospital_mortality/clf.pkl"  # add input from frontend
        with open(base_model_path, "rb") as f:
            base_mdl = pickle.load(f)
        base_model_manager = BaseModelManager(model=base_mdl)


        datasets = DatasetsManager()
        datasets.set_from_data(
            dataset_type="testing",
            observations=x.to_numpy(),
            true_labels=y,
            column_labels=list(x.columns),
        )

        self.set_progress(label="Running MED3pa experiment", now=50)

        results = Med3paExperiment.run(
            datasets_manager=datasets,
            base_model_manager=base_model_manager,
            uncertainty_metric="sigmoidal_error",          # add input from frontend (maps to ipc.confidence_metric)
            ipc_type="EnsembleRandomForestRegressor",      # add input from frontend
            ipc_params=ipc_params,
            apc_params=apc_params,
            ipc_grid_params=ipc_grid,
            apc_grid_params=apc_grid,
            samples_ratio_min=0,                           # add input from frontend
            samples_ratio_max=10,                          # add input from frontend
            samples_ratio_step=5,                          # add input from frontend
            evaluate_models=True,                          # add input from frontend
        )

        self.set_progress(label="Saving results", now=90)

        output_dir = os.path.join("experiments", "results", "med3pa", session_name)  # add input from frontend
        os.makedirs(output_dir, exist_ok=True)
        results.save(file_path=output_dir)

        self.results = {"status": "completed", "output_dir": output_dir}
        self.set_progress(label="Done", now=100)
        return self.results


runMed3pa = GoExecScriptRunMed3paAnalysis(json_params_dict, id_)
runMed3pa.start()
