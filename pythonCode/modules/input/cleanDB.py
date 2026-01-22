import json
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.input_utils.dataframe_utilities import clean_columns, clean_rows
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
        This function is used to clean a dataset by removing rows or columns
        with missing values.

        Args:
            json_config: The input json params
        """
        
        go_print(json.dumps(json_config, indent=4))
        # Set local variables
        processing_type = json_config["type"]
        clean_method = json_config["cleanMethod"]
        overwrite = json_config["overwrite"]
        collection_name = json_config["collectionName"]
        dataset_name = json_config["newDatasetName"]
        columns_to_clean = json_config["columnsToClean"]
        rows_to_clean = json_config["rowsToClean"]

        # Connect to MongoDB
        db = connect_to_mongo()
        collection = db[collection_name]

        # Fetch data and convert to DataFrame 
        data = list(collection.find())
        df = pd.DataFrame(data)
        df = df.drop('_id', axis=1)

        # Process
        if processing_type == "columns":
            df = clean_columns(df, columns_to_clean, clean_method)
        elif processing_type == "rows":
            rows_to_clean = [int(row) for row in rows_to_clean]
            df = clean_rows(df, rows_to_clean, clean_method)
        elif processing_type == "all":
            start_with = json_config["startWith"]
            if start_with == "Columns":
                df = clean_columns(df, columns_to_clean, clean_method)
                rows_to_clean = [int(row) for row in rows_to_clean]
                df = clean_rows(df, rows_to_clean, clean_method)
            else:
                rows_to_clean = [int(row) for row in rows_to_clean]
                df = clean_rows(df, rows_to_clean, clean_method)
                df = clean_columns(df, columns_to_clean, clean_method)
        
        print(df)

        # Save the dataset
        if overwrite:
            # Delete the content of the collection and insert the new data
            collection.delete_many({})
            data_dict = df.where(pd.notnull(df), None).to_dict(orient='records')
            collection.insert_many(data_dict)
            return
        else:
            # Create new collection, call it the dataset_name, and add the data
            db.create_collection(dataset_name)
            collection = db[dataset_name]
            data_dict = df.where(pd.notnull(df), None).to_dict(orient='records')
            collection.insert_many(data_dict)
        return


script = GoExecScriptClean(json_params_dict, id_)
script.start()
