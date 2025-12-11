import json
import os
import sys
from pathlib import Path

from pycaret.internal.pipeline import Pipeline as PycaretPipeline
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import (get_child_id_by_name,
                                    get_pickled_model_from_collection)
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

        # Get Model
        model_infos = json_config['model']
        pickle_object_id = get_child_id_by_name(model_infos['id'], "model.pkl")

        # Check if pickle_object_id is None
        if pickle_object_id is None:
            raise ValueError("Could not find the model.pkl in the database.")
        
        # Load the model
        model = get_pickled_model_from_collection(pickle_object_id)

        # Check if model is not None
        if model is None:
            raise ValueError("The model could not be loaded from the database.")

        # Get imputated columns if any
        imputed_columns = []
        for step in model.steps:
            if "imputer" in step[0]:
                if len(step[1].include) > 0:
                    imputed_columns.extend(list(step[1].include))

        imputed_columns = list(set(imputed_columns))
        results = {"imputed_columns": imputed_columns, "is_calibrated": False}

        # Check if model is calibrated
        if isinstance(model, Pipeline) or isinstance(model, PycaretPipeline):
            final_estimator = model.steps[-1][1]
            if isinstance(final_estimator, CalibratedClassifierCV):
                results["is_calibrated"] = True
        return results
    
script = GoExecScriptPredict(json_params_dict, id_)
script.start()
