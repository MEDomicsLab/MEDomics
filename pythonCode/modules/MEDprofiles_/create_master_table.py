import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecCreateMasterTable(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        Create a master table from list of csv files paths given by a json request.
        The master table file is created following the specifications given in the json request.

        Args:
            json_config (dict): The input json params.

        Returns:
            dict: Dict with error message in case of error.

        """
        go_print(json.dumps(json_config, indent=4))

        # Set local variables
        id = json_config["id"]
        collections = json_config["csvCollections"]

        # Connect to MongoDB
        db = connect_to_mongo()
        
        # Initialize df_master from the first csv
        df_master_mongo = pd.DataFrame(list(db[collections[0]].find())).drop('_id', axis=1)
        columns = ['PatientID', 'Date'] + list(df_master_mongo.columns[2:])
        df_master_mongo.columns = columns

        # Merge all dataframes
        for collection in collections[1:]:
            df = pd.DataFrame(list(db[collection].find())).drop('_id', axis=1)
            columns = ['PatientID', 'Date'] + list(df.columns[2:])
            df.columns = columns
            df_master_mongo = df_master_mongo.merge(df, on=['PatientID', 'Date'], how='outer')
        
        # Sort the dataframe and insert a Time_point column
        df_master_mongo['Date'] = pd.to_datetime(df_master_mongo['Date'])
        df_master_mongo.sort_values(by=['PatientID', 'Date'], inplace=True)
        df_master_mongo.insert(2, 'Time_point', np.NaN)

        # Create a type list to add in the master table
        # All the attributes are numbers except the date and the patient id
        type_list = ['num' for _ in df_master_mongo.columns]
        type_list[1] = 'datetime.date'
        if df_master_mongo.dtypes[0] == 'object':
            type_list[0] = 'str'

        # Add types row to the dataframe
        df_types = pd.DataFrame([type_list], columns=df_master_mongo.columns)
        df_master_mongo = pd.concat([df_types, df_master_mongo]).reset_index(drop=True)

        # Save the merged dataframe to a new collection and insert it into the database
        db[id].insert_many(df_master_mongo.to_dict(orient='records'))


script = GoExecCreateMasterTable(json_params_dict, id_)
script.start()
