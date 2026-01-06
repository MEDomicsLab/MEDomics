import json
import os
import sys
import uuid
from pathlib import Path

import pandas as pd

# --- Guard for pandas >= 2.0 (iteritems removed) ---
if not hasattr(pd.Series, "iteritems"):
    pd.Series.iteritems = pd.Series.items
if not hasattr(pd.DataFrame, "iteritems"):
    pd.DataFrame.iteritems = pd.DataFrame.items


from pycaret.classification.oop import ClassificationExperiment
from pycaret.regression.oop import RegressionExperiment

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.MEDDataObject import MEDDataObject
from med_libs.mongodb_utils import (connect_to_mongo, get_child_id_by_name,
                                    get_dataset_as_pd_df,
                                    get_pickled_model_from_collection,
                                    insert_med_data_object_if_not_exists,
                                    overwrite_med_data_object_content)
from med_libs.server_utils import go_print, load_med_standard_data

json_params_dict, id_ = parse_arguments()
go_print("running predict_test.py:" + id_)


class GoExecScriptPredictTest(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The json params of the execution
            _id: The id of the execution
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

        # Initialize data
        model_infos = json_config['model']
        dataset_infos = json_config['dataset']
        use_med_standard = json_config['useMedStandard']
        parentID = json_config["pageId"]

        # Load the model
        db = connect_to_mongo()
        model_metadata_id = get_child_id_by_name(model_infos['id'], 'metadata.json')
        model_metadata = dict(db[model_metadata_id].find_one({}))
        ml_type = model_metadata['ml_type']
        self.set_progress(label="Loading the model", now=10)
        pickle_object_id = get_child_id_by_name(model_infos['id'], "model.pkl")

        # Check if pickle_object_id is None
        if pickle_object_id is None:
            raise ValueError("Could not find the model.pkl in the database.")

        # Load the model
        model = get_pickled_model_from_collection(pickle_object_id)
        go_print(f"model loaded: {model}")

        # Check if model is not None
        if model is None:
            raise ValueError("The model could not be loaded from the database.")

        self.set_progress(label="Loading the dataset", now=20)
        
        if use_med_standard:
            dataset = load_med_standard_data(
                db,
                dataset_infos['selectedDatasets'], 
                json_config['selectedVariables'], 
                json_config['target']
            )
        elif 'id' in dataset_infos:
            dataset = get_dataset_as_pd_df(dataset_infos['id'])
        else:
            print("Dataset has no ID and is not MEDomicsLab standard")
            raise ValueError("Dataset has no ID and is not MEDomicsLab standard")

        # calculate the predictions
        self.set_progress(label="Setting up the experiment", now=30)
        if ml_type == 'regression':
            from pycaret.regression import predict_model
            self.set_progress(label="Predicting...", now=50)
            pred_unseen = predict_model(model, data=dataset)
        elif ml_type == 'classification':
            from pycaret.classification import predict_model
            self.set_progress(label="Predicting...", now=50)
            pred_unseen = predict_model(model, data=dataset)
        self.set_progress(now=70)
        
        # Save predictions
        prediction_object = MEDDataObject(
            id=str(uuid.uuid4()),
            name = "predictions.csv",
            type = "csv",
            parentID = parentID,
            childrenIDs = [],
            inWorkspace = False
        )
        prediction_med_object_id = insert_med_data_object_if_not_exists(prediction_object, pred_unseen.to_dict(orient="records"))
        
        # If the prediction already exists we update the content
        if prediction_med_object_id != prediction_object.id:
            overwrite_med_data_object_content(prediction_med_object_id, pred_unseen.to_dict(orient="records"))
        
        self.results = {"collection_id": prediction_med_object_id}
        self.set_progress(label="Compiling results ...", now=80)
        
        return self.results


predictTest = GoExecScriptPredictTest(json_params_dict, id_)
predictTest.start()
