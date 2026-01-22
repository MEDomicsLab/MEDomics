import json
import os
import sys
from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

import pandas as pd
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)



class GoExecScriptMerge(GoExecutionScript):
    """
        This class is used to execute the merge script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is used to merge datasets with Pandas

        Args:
            json_config: The input json params
        """
        go_print(json.dumps(json_config, indent=4))

        # Set local variables
        new_collection_name = json_config["newCollectionName"]
        merge_type = json_config["mergeType"]
        merge_on = json_config["columns"]
        collection_1 = json_config["collection1"]
        collection_2 = json_config["collection2"]

        # Connect to MongoDB
        db = connect_to_mongo()
        collection1 = db[collection_1]
        collection2 = db[collection_2]

         # Fetch data and convert to DataFrame 
        data1 = list(collection1.find())
        df1 = pd.DataFrame(data1)
        df1 = df1.drop('_id', axis=1)

        data2 = list(collection2.find())
        df2 = pd.DataFrame(data2)
        df2 = df2.drop('_id', axis=1)

        # Merge the two dataframes depending on the merge type
        max_size = 10**8  # Set a threshold for the maximum size (adjust as needed), 100 000 000 is more than enough!

        if merge_type == "inner":
            potential_size = min(len(df1), len(df2))  # Inner join will have at most the size of the smaller dataframe
            if potential_size > max_size:
                return {"error": f"Unable to perform an inner merge because the result file size would be too large -> {potential_size} rows."}
            merged_df = pd.merge(df1, df2, on=merge_on, how='inner')
        elif merge_type == "outer":
            potential_size = len(df1) + len(df2)  # Outer join will have at most the sum of both dataframes
            if potential_size > max_size:
                return {"error": f"Unable to perform an outer merge because the result file size would be too large -> {potential_size} rows."}
            merged_df = pd.merge(df1, df2, on=merge_on, how='outer')
        elif merge_type == "left":
            potential_size = len(df1)  # Left join will have at most the size of the left dataframe
            if potential_size > max_size:
                return {"error": f"Unable to perform a left merge because the result file size would be too large -> {potential_size} rows."}
            merged_df = pd.merge(df1, df2, on=merge_on, how='left')
        elif merge_type == "right":
            potential_size = len(df2)  # Right join will have at most the size of the right dataframe
            if potential_size > max_size:
                return {"error": f"Unable to perform a right merge because the result file size would be too large -> {potential_size} rows."}
            merged_df = pd.merge(df1, df2, on=merge_on, how='right')
        elif merge_type == "cross":
            potential_size = len(df1) * len(df2)  # Cross join will have the product of both dataframes' sizes
            if potential_size > max_size:
                return {"error": f"Unable to perform a cross merge because the result file size would be too large -> {potential_size} rows."}
            merged_df = pd.merge(df1, df2, how='cross')
        else:
            raise ValueError("The merge type is not valid")

        # Save the merged dataframe to a new collection and insert it into the database
        db.create_collection(new_collection_name)
        new_collection = db[new_collection_name]
        data_dict = merged_df.to_dict(orient='records')
        new_collection.insert_many(data_dict)

        return {"data": f"The {merge_type} merge was successful and generated a file of size {potential_size} rows."}
    
script = GoExecScriptMerge(json_params_dict, id_)
script.start()
