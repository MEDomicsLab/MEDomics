import json
import os
import sys
import uuid
from pathlib import Path

import pandas as pd

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.MEDDataObject import MEDDataObject
from med_libs.mongodb_utils import (connect_to_mongo, get_child_id_by_name,
                                    get_dataset_as_pd_df,
                                    get_pickled_model_from_collection,
                                    insert_med_data_object_if_not_exists,
                                    overwrite_med_data_object_content)
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecScriptPredict(GoExecutionScript):
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
            This function predicts from a model, a dataset, and a new dataset
        """
        go_print(json.dumps(json_config, indent=4))
        pred_name = "target.csv"

        # MongoDB connection
        db = connect_to_mongo()

        # Get Model
        model_infos = json_config['entry']['model']
        model_metadata_id = get_child_id_by_name(model_infos['id'], 'metadata.json')
        model_metadata = dict(db[model_metadata_id].find_one({}))
        pickle_object_id = get_child_id_by_name(model_infos['id'], "model.pkl")
        model = get_pickled_model_from_collection(pickle_object_id)

        # Get Dataset (if entry is dataset) and prediction
        if json_config['entry']["type"] == "table":
            dataset_infos = json_config['entry']['dataset']
            dataset_original = get_dataset_as_pd_df(dataset_infos['id'])
            if model_metadata["target"] in dataset_original.columns:
                dataset_original = dataset_original.drop(columns=[model_metadata['target']])
            dataset = dataset_original.copy()
            y_pred = model.predict(dataset)
            pred_name = "pred_" + dataset_infos['name']

        # Get manual entry (if entry is manual) and prediction
        else:
            data = json_config['entry']['data']
            dataset = pd.DataFrame(data)

            # Convert data if it's not in the right format
            #TODO : preserve data type in mongoDB to avoid this conversion
            def convert_column_to_type(col):
                # First, convert everything to string
                col = col.astype(str)
                
                # Now check each value to see if it's an integer or a float
                def convert_value(value):
                    try:
                        # Try to convert to float
                        value = float(value)
                        # Check if integer
                        if value.is_integer():
                            value = int(value)
                        return value
                    except ValueError:
                        pass
                    
                    try:
                        # Try to convert to string if integer conversion fails
                        value = str(value)
                        return value
                    except ValueError:
                        pass
                    
                    # Return as it is if it's neither integer nor float
                    return value
                
                # Apply the conversion to each element in the column
                return col.apply(convert_value)

            # Loop through each column and apply the conversion function
            for col in dataset.columns:
                if dataset[col].dtype == 'object':  #TODO : preserve data type in mongoDB to avoid this conversion
                    dataset[col] = convert_column_to_type(dataset[col])
            
            y_pred = model.predict(dataset)
            pred_name = str("pred_" + model_metadata['target']) + ".csv"

        # Save predictions
        dataset[str("pred_" + model_metadata['target'])] = y_pred
        prediction_object = MEDDataObject(id=str(uuid.uuid4()),
                    name = pred_name,
                    type = "csv",
                    parentID = json_config["parentId"],
                    childrenIDs = [],
                    inWorkspace = False)
        prediction_med_object_id = insert_med_data_object_if_not_exists(prediction_object, dataset.to_dict(orient="records"))
        # If the prediction already exists we update the content
        if prediction_med_object_id != prediction_object.id:
            overwrite_med_data_object_content(prediction_med_object_id, dataset.to_dict(orient="records"))
        self.results = {"collection_id": prediction_med_object_id}
        return self.results


script = GoExecScriptPredict(json_params_dict, id_)
script.start()
