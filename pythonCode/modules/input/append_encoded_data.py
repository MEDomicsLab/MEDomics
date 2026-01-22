import json
import os
import sys
from pathlib import Path

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
        self.results = {"status": "error", "message": "Process not completed."}  # Default response

    def _custom_process(self, json_config: dict) -> dict:
        """
        Overwrites the specified collection with new data while preserving existing columns.
        """
        try:

            if "collectionName" not in json_config or "data" not in json_config:
                raise ValueError("Invalid JSON format: 'collectionName' or 'data' missing.")

            # Set local variables
            collection_name = json_config["collectionName"]
            new_data = json_config["data"]


            # Connect to MongoDB
            db = connect_to_mongo()
            collection = db[collection_name]

     
            existing_doc = collection.find_one({}, {"_id": 0})


            if existing_doc:
                all_keys = set(existing_doc.keys())
            else:
                all_keys = set()

            
            # Append new Data
            for doc in new_data:
                all_keys.update(doc.keys())

      
            temp_doc = {key: None for key in all_keys}  
            temp_id = collection.insert_one(temp_doc).inserted_id

 
            collection.delete_many({"_id": {"$ne": temp_id}})  
            collection.insert_many(new_data)
            collection.delete_one({"_id": temp_id})

        # Return success
            self.results = {
                "status": "success",
                "message": "Data overwritten successfully while keeping existing schema."
            }

        # Handle exceptions
        except Exception as e:
            self.results = {"status": "error", "message": str(e)}
            go_print(f"Error: {str(e)}")

        return self.results  



if __name__ == "__main__":
    script = GoExecScriptAppend(json_params_dict, id_)
    script.start()  # Start the process and execute `_custom_process`