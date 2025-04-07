import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)



class GoExecScriptComputeEigenvalues(GoExecutionScript):
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
        This function is used to compute eigenvalues from a dataset 
        and a set of the dataset columns.

        Args:
            json_config: The input json params
        """
        go_print(json.dumps(json_config, indent=4))

        # Set local variables
        columns = json_config["columns"]
        collection_name = json_config["collectionName"]

        # Connect to MongoDB
        db = connect_to_mongo()
        collection = db[collection_name]

        # Fetch data and convert to DataFrame 
        data = list(collection.find())
        df = pd.DataFrame(data)
        df = df.drop('_id', axis=1)

        # Remove columns containing only 0 values
        zero_columns = df.columns[df.eq(0).all()]
        filtered_columns = [x for x in columns if x not in zero_columns]

        # Keep extracted features columns
        extracted_features = df[filtered_columns]

        # Mean
        extracted_features_mean = extracted_features.mean()
        # Standard deviation
        extracted_features_std = extracted_features.std()
        # Standardization
        extracted_features_standardized = (extracted_features - extracted_features_mean) / extracted_features_std
        # Covariance
        c = extracted_features_standardized.cov()   

        # Get eigenvalues
        eigenvalues, eigenvectors = np.linalg.eig(c)
        # Index the eigenvalues in descending order
        idx = eigenvalues.argsort()[::-1]
        # Sort the eigenvalues in descending order
        eigenvalues = eigenvalues[idx]
        explained_var = np.cumsum(eigenvalues) / np.sum(eigenvalues)
        if np.iscomplexobj(explained_var):
            tmp = [{"real": np.real(x), 'imaginary': np.imag(x)} for x in explained_var]
            explained_var = tmp
        else:
            explained_var = explained_var.tolist()

        # Get results
        json_config["explained_var"] = explained_var
        self.results = json_config

        return self.results


script = GoExecScriptComputeEigenvalues(json_params_dict, id_)
script.start()
