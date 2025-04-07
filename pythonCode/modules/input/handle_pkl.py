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



class GoExecScriptHandlePKL(GoExecutionScript):
    """
        This class is used to execute the handlePKL script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is used to handle .pkl files when dragged into the app and opened

        Args:
            json_config: The input json params
        """
        
        go_print(json.dumps(json_config, indent=4))
       
        # Set local variables
        path = json_config["path"]
        new_collection_name = json_config["newCollectionName"]

        # Connect to MongoDB
        db = connect_to_mongo()

        # Attempt to create a dataframe from the pkl file
        try:
            data = pd.read_pickle(path)
        except Exception as e:
            # Handle errors in reading the .pkl file
            print(f"Error reading .pkl file: {e}")
            return {"status": "error", "message": "Failed to read .pkl file. The file may not be formatted properly."}

        # Check if data is a dictionary and convert to DataFrame if necessary
        if isinstance(data, dict):
            # Check if all values in the dictionary are scalar (not lists or arrays)
            if all(isinstance(value, (str, int, float, bool)) for value in data.values()):
                # Since all values are scalar, create a DataFrame with a single row
                df = pd.DataFrame([data])
            else:
                # If not all values are scalar, it's safe to create a DataFrame directly
                df = pd.DataFrame(data)
        else:
            df = data

        print(df)

        # Create a new collection in the database
        collection = db[new_collection_name]

        # Insert data into the collection
        collection.insert_many(df.to_dict(orient='records'))

        return

script = GoExecScriptHandlePKL(json_params_dict, id_)
script.start()
