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



class GoExecScriptTransformColumns(GoExecutionScript):
    """
        This class is used to execute the transform columns script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is used to delete selected columns

        Args:
            json_config: The input json params
        """

        # Get the Data from the JsonToSend
        columns = json_config["columns"]
        collection_id = json_config["collection"]
        type = json_config["type"]

        # Connect to the database
        db = connect_to_mongo()
        collection = db[collection_id]

        # if the type is binary, replace every cell that has a value with 1, and every cell that is empty with 0
        # if the type is non-empty, keep every cell that has a value intact, and replace every cell that is empty with a 0

        if type == "Binary":
            for column in columns:
                collection.update_many(
                    {column: {"$exists": True}},
                    {"$set": {column: 1}}
                )
                collection.update_many(
                    {column: {"$exists": False}},
                    {"$set": {column: 0}}
                )
            return {"{columns}transformed to {type} successfully"}

        elif type == "Non-empty":
            for column in columns:
                collection.update_many(
                    {column: {"$exists": False}},
                    {"$set": {column: 0}}
                )
                collection.update_many(
                    {column: {"$in": [None, ""]}},
                    {"$set": {column: 0}}
                )
            return {"Columns transformed to {type} successfully"}

    

script = GoExecScriptTransformColumns(json_params_dict, id_)
script.start()
