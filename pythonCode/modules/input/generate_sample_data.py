import json
import os
import sys
from pathlib import Path

from pycaret.datasets import get_data
import pandas as pd

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)



class GoExecScriptClean(GoExecutionScript):
    """
        This class is used to execute the clean script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is used generate a file with sample data for users.

        Args:
            json_config: The input json params
        """
        
        go_print(json.dumps(json_config, indent=4))
        # Set local variables
        dataset_name = json_config["datasetRequested"]
        sample_id = json_config["newSampleID"]

        data = get_data(dataset_name)
        # Remove spaces from column names
        data.columns = data.columns.str.replace(' ', '_')

        # Setup the new mongo collection
        db = connect_to_mongo()
        db.create_collection(sample_id)
        new_collection = db[sample_id]

        # Insert sample data in collection
        data_dict = pd.DataFrame(data).to_dict(orient="records")
        new_collection.insert_many(data_dict)

        return

script = GoExecScriptClean(json_params_dict, id_)
script.start()
