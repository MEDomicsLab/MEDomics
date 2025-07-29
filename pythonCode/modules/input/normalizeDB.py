import os
import sys
from pathlib import Path

import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running normalizeDB.py: " + id_)


class GoExecScriptNormalize(GoExecutionScript):
    """
    This class applies normalization to selected columns using a specified method.
    It saves the new dataset in the MongoDB collection.
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "Nothing returned"}

    def _custom_process(self, json_config: dict) -> dict:
        collection_name = json_config["collection"]
        columns = json_config["columns"]
        method = json_config["method"]
        new_dataset_name = json_config["newDatasetName"]
        overwrite = json_config.get("overwrite", False)

        go_print(f"Normalizing columns {columns} from {collection_name} using {method}")

        # Connect and load the original data
        db = connect_to_mongo()
        original_collection = db[collection_name]
        data = list(original_collection.find())
        df = pd.DataFrame(data)
        df = df.drop(columns=["_id"], errors="ignore")

        if not columns:
            raise ValueError("No columns selected for normalization")

        # Select and normalize only selected columns
        df_to_normalize = df[columns].copy()

        if method == "zscore":
            scaler = StandardScaler()
        elif method == "minmax":
            scaler = MinMaxScaler()
        elif method == "robust":
            scaler = RobustScaler()
        else:
            raise ValueError(f"Unsupported normalization method: {method}")

        try:
            normalized_array = scaler.fit_transform(df_to_normalize)
            df[columns] = normalized_array
        except Exception as e:
            raise ValueError(f"Normalization failed: {str(e)}")

        # Save to MongoDB (overwrite or create new collection)
        if overwrite:
            target_collection = db[collection_name]
            target_collection.delete_many({})
        else:
            db.create_collection(new_dataset_name)
            target_collection = db[new_dataset_name]

        # Handle NaN for MongoDB
        data_dict = df.where(pd.notnull(df), None).to_dict(orient="records")
        target_collection.insert_many(data_dict)

        return {
            "data": f"Normalization ({method}) applied to columns: {columns}",
            "overwrite": overwrite
        }


script = GoExecScriptNormalize(json_params_dict, id_)
script.start()
