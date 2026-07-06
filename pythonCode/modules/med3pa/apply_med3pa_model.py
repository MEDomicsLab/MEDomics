import os
import sys
import pickle
import datetime
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import (connect_to_mongo,
                                    get_child_id_by_name,
                                    get_dataset_as_pd_df,
                                    get_pickled_model_from_collection)

json_params_dict, id_ = parse_arguments()
go_print("running apply_med3pa_model.py:" + id_)


def walk_tree(tree, row):
    """Walk the saved APC tree representation for one patient row and return
    the reached node (dict with node_id and path)."""
    node = tree
    while True:
        feature = node.get("feature")
        if feature is None:
            break
        value = row.get(feature)
        if value is None:
            break
        child = node.get("c_left") if float(value) <= float(node["threshold"]) else node.get("c_right")
        if child is None:
            break
        node = child
    return node


class GoExecScriptApplyMed3paModel(GoExecutionScript):
    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self._progress["type"] = "process"

    def _custom_process(self, json_config: dict) -> dict:
        params = json_config["med3pa_apply_params"]

        deployment_name = params["deployment_name"]
        input_mode = params["input_mode"]  # "dataset" | "manual"

        db = connect_to_mongo()

        self.set_progress(label="Loading deployment", now=5)
        deployment = db["med3pa_deployments"].find_one({"name": deployment_name}, {"_id": False})
        if deployment is None:
            raise ValueError(f"Deployment '{deployment_name}' not found.")

        session = db["med3pa_sessions"].find_one({"name": deployment["session_name"]}, {"_id": False})
        if session is None:
            raise ValueError(f"Session '{deployment['session_name']}' behind this deployment no longer exists.")

        columns = session["columns"]
        threshold = float(deployment.get("min_confidence_level") or 0.5)
        mpc_strategy = deployment.get("mpc_strategy") or "minimum"

        self.set_progress(label="Loading input data", now=15)
        if input_mode == "dataset":
            dataset = params.get("dataset")
            if not dataset or "id" not in dataset:
                raise ValueError("No dataset was selected.")
            df = get_dataset_as_pd_df(dataset["id"])
            # Drop the training target column if it is present in the new data
            target_column = session.get("target_column")
            if target_column and target_column in df.columns:
                df = df.drop(columns=[target_column])
        else:
            patient = params.get("patient") or {}
            row = {}
            for col in columns:
                raw = patient.get(col)
                try:
                    row[col] = float(raw)
                except (TypeError, ValueError):
                    row[col] = np.nan
            df = pd.DataFrame([row])

        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise ValueError(f"Input data is missing the following columns used at training time: {missing}")

        id_column = params.get("patient_id_column")
        patient_ids = None
        if id_column and id_column in df.columns:
            patient_ids = df[id_column].astype(str).tolist()
        x = df[columns]

        self.set_progress(label="Loading models", now=30)
        base_model_id = deployment.get("base_model_id") or (session.get("base_model") or {}).get("id")
        pickle_object_id = get_child_id_by_name(base_model_id, "model.pkl")
        if pickle_object_id is None:
            raise ValueError("Could not find 'model.pkl' inside the deployment's base model.")
        base_mdl = get_pickled_model_from_collection(pickle_object_id)
        if base_mdl is None:
            raise ValueError("The base model could not be loaded from the database.")

        models_doc = db["med3pa_models"].find_one({"session_name": deployment["session_name"]})
        if models_doc is None or models_doc.get("ipc_model") is None:
            raise ValueError("The trained IPC/APC models for this session were not found. Re-run the analysis.")
        ipc_model = pickle.loads(models_doc["ipc_model"])
        apc_model = pickle.loads(models_doc["apc_model"]) if models_doc.get("apc_model") else None

        self.set_progress(label="Running base model", now=45)
        x_np = x.to_numpy()
        if hasattr(base_mdl, "predict_proba"):
            base_prob = base_mdl.predict_proba(x_np)[:, 1]
        else:
            base_prob = np.asarray(base_mdl.predict(x_np), dtype=float)
        base_pred = (base_prob >= 0.5).astype(int)

        self.set_progress(label="Computing confidence scores", now=60)
        ipc_values = np.asarray(ipc_model.predict(x_np), dtype=float)
        if apc_model is not None:
            apc_values = np.asarray(apc_model.predict(x_np), dtype=float)
        else:
            apc_values = ipc_values.copy()

        if mpc_strategy == "average":
            mpc_values = (ipc_values + apc_values) / 2.0
        else:
            # "minimum" is the package default; unknown/custom strategies fall back to it
            mpc_values = np.minimum(ipc_values, apc_values)

        self.set_progress(label="Assigning profiles", now=75)
        tree = session.get("tree")
        records = []
        now = datetime.datetime.now().isoformat()
        existing_count = db["med3pa_patients"].count_documents({})
        for i in range(len(x)):
            row_dict = {c: (None if pd.isna(x.iloc[i][c]) else float(x.iloc[i][c])) for c in columns}
            if tree is not None:
                node = walk_tree(tree, row_dict)
                profile_path = node.get("path") or ["*"]
                profile_node_id = node.get("node_id")
            else:
                profile_path = ["*"]
                profile_node_id = None

            mpc = float(mpc_values[i])
            apc = float(apc_values[i])
            if mpc >= threshold and apc >= threshold:
                routing = "accept"
            elif mpc >= threshold:
                routing = "caution"
            else:
                routing = "flag"

            pid = patient_ids[i] if patient_ids else f"PT-{existing_count + i + 1:04d}"
            records.append({
                "patient_id": pid,
                "deployment_name": deployment_name,
                "session_name": deployment["session_name"],
                "created_at": now,
                "data": row_dict,
                "base_prob": float(base_prob[i]),
                "prediction": int(base_pred[i]),
                "ipc": float(ipc_values[i]),
                "apc": apc,
                "mpc": mpc,
                "threshold": threshold,
                "profile_path": profile_path,
                "profile_node_id": profile_node_id,
                "routing": routing,
            })

        self.set_progress(label="Saving predictions", now=90)
        if records:
            db["med3pa_patients"].insert_many([dict(r) for r in records])

        self.results = {"status": "completed", "n_patients": len(records), "predictions": records}
        self.set_progress(label="Done", now=100)
        return self.results


applyMed3pa = GoExecScriptApplyMed3paModel(json_params_dict, id_)
applyMed3pa.start()
