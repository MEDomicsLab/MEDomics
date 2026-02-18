import json
import os
import sys
from pathlib import Path
import pandas as pd

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)




class GoExecScriptOverwrite(GoExecutionScript):
    """
    This class overwrites data in a MongoDB collection.

    Args:
        json_params: Input JSON parameters
        _id: Request ID (optional)
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = None  # Initially set to None

    def __one_hot_encode_column(self, data, column_name):
        df = pd.DataFrame(data)

        # One-hot encode the column
        encoded = pd.get_dummies(df[column_name], prefix=column_name)

        # Replace original column with encoded columns
        df = df.drop(columns=[column_name]).join(encoded)
        
        return df.to_dict(orient='records')

    def _custom_process(self, json_config: dict) -> dict:
        """
        Overwrites the specified collection with new data.

        Args:
            json_config: Input JSON parameters
        """
        try:
            # Set local variables
            collection_name = json_config["collectionName"]
            column_to_encode = json_config.get("columnToEncode", None)
            if not collection_name or not column_to_encode:
                raise ValueError("Invalid JSON format: 'collectionName' or 'columnToEncode' missing.")

            # Connect to MongoDB
            db = connect_to_mongo()
            collection = db[collection_name]
            new_data = list(collection.find())

            # One-hot encode column
            new_data = self.__one_hot_encode_column(new_data, column_to_encode)

            # Overwrite the data
            go_print(f"Overwriting data in collection: {collection_name}")
            collection.drop()
            collection.insert_many(new_data)

            # Return success
            self.results = {"status": "success", "message": "Data overwritten successfully."}
        except Exception as e:
            # Handle exceptions
            go_print(f"Error: {str(e)}")
            return {"error": "Error occured: " + str(e)}

        return self.results


# Start the script
script = GoExecScriptOverwrite(json_params_dict, id_)
script.start()