import json
import sys
import numpy as np
import os
import pandas as pd
from pathlib import Path
sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from concurrent.futures import ThreadPoolExecutor, as_completed
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print

# To deal with the DB
from pymongo import MongoClient

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)

class GoExecScriptCreateNewCollection(GoExecutionScript):
    """
        This class is used to execute the CreateNewCollection script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is used to create a new collection in the database

        Args:
            json_config: The input json params
        """

        # Get the Data from the JsonToSend
        database_name = json_config["database_name"]
        collection_id = json_config["collection"]
        data = json_config["data"]
        newName = json_config["new_collection_name"]
        
        # Connect to the database and connect to the tag_collection
        client = MongoClient('localhost', 54017)
        db = client[database_name]
        collection = db[collection_id]

        # Create the new collection with the new data
        new_collection = db[newName]
        new_collection.insert_many(data)

        return {"status": "success"}


script = GoExecScriptCreateNewCollection(json_params_dict, id_)
script.start()