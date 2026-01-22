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



class GoExecScriptCreatePCA(GoExecutionScript):
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
        This function is used to compute PCA from a dataset, 
        a set of the dataset columns and a number of principal
        components to keep.

        Args:
            json_config: The input json params
        """
        go_print(json.dumps(json_config, indent=4))
        # Set local variables
        columns = json_config["columns"]
        n_components = json_config["nComponents"]
        column_prefix = json_config["columnPrefix"]
        keep_unselected_columns = json_config["keepUnselectedColumns"]
        overwrite = json_config["overwrite"]
        export_transformation = json_config["exportTransformation"]
        collection_name = json_config["collectionName"]
        new_collection_name = json_config["newCollectionName"]
        new_PCA_collection_name = json_config["newPCATransformationName"]

        # Connect to MongoDB
        db = connect_to_mongo()
        collection = db[collection_name]

        # Fetch data and convert to DataFrame 
        data = list(collection.find())
        df = pd.DataFrame(data)
        df = df.drop('_id', axis=1)
        
        if df.empty:
            print("DataFrame is empty. Exiting script.")
            sys.exit() 

        # Remove columns containing only 0 values
        zero_columns = df.columns[df.eq(0).all()]
        filtered_columns = [x for x in columns if x not in zero_columns]

        # Keep extracted features columns
        if set(filtered_columns).issubset(df.columns):
            extracted_features = df[filtered_columns]
        else:
            print("Error: One or more filtered columns are not in DataFrame.")
            sys.exit()

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
        # Sort the corresponding eigenvectors accordingly
        eigenvectors = eigenvectors[:,idx]

        # PCA component or unit matrix
        u = eigenvectors[:,:n_components]
        pca_component = pd.DataFrame(u,
                                    index = filtered_columns,
                                    columns = [column_prefix + '_attr' + str(i) for i in range(n_components)]
                                    )
    
        # Matrix multiplication or dot Product
        print(extracted_features)
        print(pca_component)

        extracted_features_pca = extracted_features @ pca_component

        # Concatenate PCA with the unselected columns
        if keep_unselected_columns:
            unselected_columns = [x for x in df.columns if x not in columns]
            extracted_features_pca = pd.concat([df[unselected_columns], extracted_features_pca], axis=1)

        if export_transformation:
            # If overwrite option
            if overwrite:
                collection.delete_many({})
                collection.insert_many(extracted_features_pca.to_dict(orient='records'))
                db.create_collection(new_PCA_collection_name)
                collection2 = db[new_PCA_collection_name]
                collection2.insert_many(pca_component.to_dict(orient='records'))
                return
            
            # If overwrite option is not selected
            else:
                db.create_collection(new_collection_name)
                collection = db[new_collection_name]
                collection.insert_many(extracted_features_pca.to_dict(orient='records'))
                db.create_collection(new_PCA_collection_name)
                collection2 = db[new_PCA_collection_name]
                collection2.insert_many(pca_component.to_dict(orient='records'))
                return
            
        # export transformation is unselected
        else:
            # If overwrite option
            if overwrite:
                collection.delete_many({})
                collection.insert_many(extracted_features_pca.to_dict(orient='records'))
                return
                
            else:
                db.create_collection(new_collection_name)
                collection = db[new_collection_name]
                collection.insert_many(extracted_features_pca.to_dict(orient='records'))
                return
       
        

script = GoExecScriptCreatePCA(json_params_dict, id_)
script.start()
