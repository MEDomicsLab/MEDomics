import json
import os
import sys
from pathlib import Path

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

    def _custom_process(self, json_config: dict) -> dict:
        """
        Overwrites the specified collection with new data.

        Args:
            json_config: Input JSON parameters
        """
        try:
            # Set local variables
            collection_name = json_config["collectionName"]
            new_data = json_config["data"]

            # Connect to MongoDB
            db = connect_to_mongo()
            collection = db[collection_name]

            # Overwrite the data
            go_print(f"Overwriting data in collection: {collection_name}")
            collection.drop()
            collection.insert_many(new_data)

            # Return success
            self.results = {"status": "success", "message": "Data overwritten successfully."}
        except Exception as e:
            # Handle exceptions
            self.results = {"status": "error", "message": str(e)}
            go_print(f"Error: {str(e)}")

        return self.results


# Start the script
script = GoExecScriptOverwrite(json_params_dict, id_)
script.start()