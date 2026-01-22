import json
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)



class GoExecScriptApplyPCA(GoExecutionScript):
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
        This function is used to compute PCA from a dataset
        and a given PCA transformation.

        Args:
            json_config: The input json params
        """
        go_print(json.dumps(json_config, indent=4))
        # Set local variables
        columns = json_config["columns"]
        keep_unselected_columns = json_config["keepUnselectedColumns"]
        overwrite = json_config["overwrite"]
        collection_name = json_config["collectionName"]
        new_collection_name = json_config["newCollectionName"]
        transformationCollection = json_config["transformationCollection"]

        # Connect to MongoDB
        db = connect_to_mongo()
        collection = db[collection_name]

        # Fetch data and convert to DataFrame 
        data = list(collection.find())
        df = pd.DataFrame(data)
        df = df.drop('_id', axis=1)
        df_filtered = df[columns]

        transformationData = list(db[transformationCollection].find())
        transformation = pd.DataFrame(transformationData)
        transformation = transformation.drop('_id', axis=1)
        transformation["index"] = columns
        transformation.set_index("index", inplace=True)
        
        # Matrix multiplication or dot Product
        extracted_features_pca = df_filtered @ transformation

        # Concatenate PCA with the unselected columns
        if keep_unselected_columns:
            unselected_columns = [x for x in df.columns if x not in columns]
            extracted_features_pca = pd.concat([df[unselected_columns], extracted_features_pca], axis=1)
        
        # Create folder for reduced features and transformations if not exists and is necessary
        if overwrite:
            collection.delete_many({})
            collection.insert_many(extracted_features_pca.to_dict(orient="records"))
            return
        else:
            db.create_collection(new_collection_name)
            collection = db[new_collection_name]
            collection.insert_many(extracted_features_pca.to_dict(orient="records"))
            return


script = GoExecScriptApplyPCA(json_params_dict, id_)
script.start()
