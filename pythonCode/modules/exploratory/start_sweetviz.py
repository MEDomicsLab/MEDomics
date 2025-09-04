import json
import os
import sys
import tempfile
from pathlib import Path

import pandas as pd
import pymongo
import sweetviz as sv

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class StartSweetviz(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self._progress["type"] = "process"

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script of the execution of the process from Go
        """
        go_print(json.dumps(json_config, indent=4))

        # MongoDB setup
        mongo_client = pymongo.MongoClient("mongodb://localhost:54017/")
        database = mongo_client["data"]
        collection1 = database[json_config["mainDataset"]["id"]]
        target = json_config['target']

        # Set first collection as pandas dataframe
        collection1_data = collection1.find({}, {'_id': False})
        collection1_df = pd.DataFrame(list(collection1_data))
        collection1_name = json_config["mainDataset"]['name'].split(".")[0].capitalize()

        # Set pairwise_analysis
        if collection1_df.columns.size > 200:
            pairwise_analysis = 'off'   # Turn off pairwise analysis for large datasets, very time consuming
        else:
            pairwise_analysis = 'auto'

        # Set second collection as pandas dataframe
        if json_config["compDataset"] != "":
            self.set_progress(label="Loading dataset", now=50)
            collection2 = database[json_config["compDataset"]["id"]]
            collection2_data = collection2.find({}, {'_id': False})
            collection2_df = pd.DataFrame(list(collection2_data))
            collection2_name = json_config["compDataset"]['name'].split(".")[0].capitalize()
            self.set_progress(label="Comparing reports", now=75)
            final_report = sv.compare([collection1_df, collection1_name], [collection2_df, collection2_name], target, pairwise_analysis=pairwise_analysis)
        else:
            self.set_progress(label="Calculating report", now=75)
            final_report = sv.analyze(collection1_df, target, pairwise_analysis=pairwise_analysis)

        # Save report to HTML
        self.set_progress(label="Saving report", now=90)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".html") as f:
            temp_html_path = f.name
            final_report.show_html(f.name, False, 'vertical')
        # Read the HTML content from the temporary file
        with open(temp_html_path, "r", encoding="utf-8") as html_file:
            html_content = html_file.read()
        # Remove the temporary file
        os.remove(temp_html_path)
        # Save to mongoDB
        database[json_config['htmlFileID']].insert_one({"htmlContent": html_content})

        # Get results
        self.set_progress(label="Done!", now=100)
        return self.results


script = StartSweetviz(json_params_dict, id_)
script.start()
