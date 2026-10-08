import os
import sys
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print
from med_libs.mongodb_utils import connect_to_mongo

# Parse arguments
json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecScriptAppend(GoExecutionScript):
    """
    This class overwrites an existing MongoDB collection while keeping existing columns.

    Args:
        json_params: Input JSON parameters
        _id: Request ID (optional)
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {
            "status": "error",
            "message": "Process not completed."
        }

    @staticmethod
    def _one_hot_encode_column(
        documents: List[Dict[str, Any]],
        column_name: str
    ) -> List[Dict[str, Any]]:
        """
        One-hot encode a column using pandas and append encoded columns.
        """
        if not documents:
            return []

        # Remove MongoDB _id before pandas processing
        df = pd.DataFrame([{k: v for k, v in doc.items() if k != "_id"} for doc in documents])

        if column_name not in df.columns:
            raise ValueError(f"Column '{column_name}' does not exist in data.")

        encoded_df = pd.get_dummies(df[column_name], prefix=column_name)

        df = df.join(encoded_df)

        return df.to_dict(orient="records")

    @staticmethod
    def _overwrite_collection(collection, new_data: List[Dict[str, Any]]) -> None:
        """
        Overwrites a MongoDB collection while preserving the union of keys.
        """
        if not new_data:
            collection.delete_many({})
            return

        # Collect all possible keys
        all_keys = set()
        for doc in new_data:
            all_keys.update(doc.keys())

        # Temporary schema holder
        temp_doc = {key: None for key in all_keys}
        temp_id = collection.insert_one(temp_doc).inserted_id

        # Replace data
        collection.delete_many({"_id": {"$ne": temp_id}})
        collection.insert_many(new_data)
        collection.delete_one({"_id": temp_id})

    def _custom_process(self, json_config: dict) -> dict:
        try:
            collection_name = json_config.get("collectionName", None)
            column_to_encode = json_config.get("columnToEncode", None)

            if not collection_name:
                raise ValueError("'collectionName' is required.")
            if not column_to_encode:
                raise ValueError("'columnToEncode' is required.")

            db = connect_to_mongo()
            collection = db[collection_name]

            documents = list(collection.find())
            encoded_data = self._one_hot_encode_column(documents, column_to_encode)

            self._overwrite_collection(collection, encoded_data)

            self.results = {
                "status": "success",
                "message": f"Column '{column_to_encode}' one-hot encoded successfully."
            }

        except Exception as exc:
            go_print(f"Error: {exc}")
            return {"error": "Error occured: " + str(exc)}

        return self.results

if __name__ == "__main__":
    script = GoExecScriptAppend(json_params_dict, id_)
    script.start()  # Start the process and execute `_custom_process`