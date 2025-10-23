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

        # Check if pickle_object_id is None
        if pickle_object_id is None:
            raise ValueError("Could not find the model.pkl in the database.")
        
        # Load the model
        model = get_pickled_model_from_collection(pickle_object_id)

        # Check if model is not None
        if model is None:
            raise ValueError("The model could not be loaded from the database.")

        # Get Dataset (if entry is dataset) and prediction
        pred_target = ""
        pred_score = ""
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
            y_pred = model.predict(dataset)
            pred_score = model.predict_proba(dataset).max()
            pred_target = str(y_pred[0])
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
        self.results = {"collection_id": prediction_med_object_id, "pred_target": pred_target, "pred_score": f"{pred_score:.2f}" if pred_score != "" else ""}
        return self.results


script = GoExecScriptPredict(json_params_dict, id_)
script.start()
