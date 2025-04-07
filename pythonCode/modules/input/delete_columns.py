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



class GoExecScriptDeleteColumns(GoExecutionScript):
    """
        This class is used to execute the delete columns script

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

        print("columns", columns)
        print("collection_id", collection_id)

        # Connect to the database and connect to the tag_collection
        db = connect_to_mongo()
        collection = db[collection_id]

        # Delete the columns from the collection
        for column in columns:
            collection.update_many({}, {"$unset": {column: ""}})

        return {"data": "Columns deleted successfully"}  # Return the results

script = GoExecScriptDeleteColumns(json_params_dict, id_)
script.start()
