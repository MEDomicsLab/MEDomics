import json
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecGetMasterCsv(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def file_matching_master_format(self, df):
        """
        Return True if the csv file in parameter match the master table format.
        """
        df_start = df.iloc[:1]  # Simulating nrows=1
        df = df.drop(index=0).reset_index(drop=True)  # Simulating skiprows=[1]
        
        # The column names must be 'PatientID', 'Date', 'Time_point' and the others must contains '_'
        if df.columns[0] != "PatientID" or df.columns[1] != "Date" or df.columns[2] != "Time_point":
            return False
        for i in range(3, len(df.columns)):
            if not '_' in df.columns[i]:
                return False

        # The 1st line (after columns) must contains 'string' or 'num' at 1st position, 'datetime.date' at 2nd and 'num' in all others
        first_line = list(df_start.iloc[0])
        if (first_line[0] != "string" and first_line[0] != "num") or first_line[1] != "datetime.date":
            return False
        for i in range(2, len(first_line)):
            if first_line[i] != "num":
                return False

        # The first column (removing 1st line) must contains str or int
        if first_line[0] != "num" and not (df.dtypes[0] == "object" and first_line[0] == "string"):
            return False

        # The second column (removing 1st line) must contains datetime values
        try:
            pd.to_datetime(df[df.columns[1]])
        except:
            return False

        # The third column (removing 1st line) must contains null or int values
        if df.dtypes[2] != "int64" and len(df[df.columns[2]].dropna()) > 0:
            return False

        # The others columns (removing 1st line) must contains num values
        for i in range(3, len(first_line)):
            if first_line[i] != "num":
                return False
            
        return True

    def file_matching_submaster_format(self, df):
        """
        Return True if the csv file in parameter match the submaster table format.
        """
        # The first column must be identifiers
        if df.dtypes[0] != "int64" and not (df.dtypes[0] == "object" and isinstance(df[df.columns[0]].values[0], str)):
            return False

        # The second column must be date
        try:
            pd.to_datetime(df[df.columns[1]])
        except:
            return False

        # All the others columns must be numerical features and their columns names must respect the format className_attributeName
        for i in range(2, len(df.dtypes)):
            if (df.dtypes[i] != "float64" and df.dtypes[i] != "int64") or not '_' in df.columns[i]:
                return False
        return True

    def _custom_process(self, json_config: dict) -> dict:
        """
        Get the csv files matching the submaster table format and the ones matching the master table
        format from a list of csv paths given in the request. 

        Returns: self.results : dict containing the json request and csv files paths matchings the formats.
        """
        go_print(json.dumps(json_config, indent=4))

        # Get csv path
        collections = json_config["csvCollections"]

        # Initialize lists of csv matching formats
        submaster_csv = []
        master_csv = []

        # Connect to MongoDB
        db = connect_to_mongo()

        # Identify csv paths matching the formats
        for collection in collections:
            df = pd.DataFrame(list(db[collection].find()))
            if '_id' in df.columns:
                df = df.drop('_id', axis=1)
                if self.file_matching_master_format(df):
                    master_csv.append(collection)
                if self.file_matching_submaster_format(df):
                    submaster_csv.append(collection)
        
        # Update json_config
        json_config["master_csv"] = master_csv
        json_config["submaster_csv"] = submaster_csv
        self.results = json_config

        return self.results


script = GoExecGetMasterCsv(json_params_dict, id_)
script.start()
