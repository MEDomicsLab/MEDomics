import copy
import pandas as pd
import numpy as np
import json
import os
from .NodeObj import Node
from typing import Union
from colorama import Fore


DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class ModelHandler(Node):
    """
    This class represents the ModelHandler node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json.
        """
        super().__init__(id_, global_config_json)
        if self.type == 'train_model':
            self.isTuningEnabled = self.config_json['data']['internal']['isTuningEnabled']
            if self.isTuningEnabled:
                self.settingsTuning = self.config_json['data']['internal']['settingsTuning']
            self.model_id = self.config_json['associated_id']
            model_obj = self.global_config_json['nodes'][self.model_id]
            self.config_json['data']['estimator'] = {
                "type": model_obj['data']['internal']['selection'],
                "settings": model_obj['data']['internal']['settings']
            }

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        print()
        print(Fore.BLUE + "=== fit === " + Fore.YELLOW +
              f"({self.username})" + Fore.RESET)
        print(Fore.CYAN + f"Using {self.type}" + Fore.RESET)
        trained_models = None
        trained_models_json = {}
        settings = copy.deepcopy(self.settings)
        splitted = kwargs.get("splitted", None)
        if self.type == 'compare_models':
            models = experiment['pycaret_exp'].compare_models(**settings)
            print(models)
            self.CodeHandler.add_line(
                "code", f"trained_models = pycaret_exp.compare_models({self.CodeHandler.convert_dict_to_params(settings)})")
            if isinstance(models, list):
                trained_models = models
            else:
                trained_models = [models]
                self.CodeHandler.add_line(
                    "code", f"# pycaret_exp.compare_models() returns a single model, but we want a list of models")
                self.CodeHandler.add_line(
                    "code", f"trained_models = [trained_models]")

        elif self.type == 'train_model':
            settings.update(self.config_json['data']['estimator']['settings'])
            settings.update({'estimator': self.config_json['data']['estimator']['type']})
            trained_models = [experiment['pycaret_exp'].create_model(**settings)]
            self.CodeHandler.add_line(
                "code", 
                f"trained_models = [pycaret_exp.create_model({self.CodeHandler.convert_dict_to_params(settings)})]"
            )
            if self.isTuningEnabled:
                trained_models = [experiment['pycaret_exp'].tune_model(trained_models[0], **self.settingsTuning)]
                self.CodeHandler.add_line(
                    "code", 
                    f"trained_models = [pycaret_exp.tune_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsTuning)})]"
                )
        trained_models_copy = trained_models.copy()
        settings_for_next = copy.deepcopy(settings)
        settings_for_next['fct_type'] = self.type
        self._info_for_next_node = {'models': trained_models, 'id': self.id, 'settings': settings_for_next}
        for model in trained_models_copy:
            model_copy = copy.deepcopy(model)
            trained_models_json[model_copy.__class__.__name__] = model_copy.__dict__
            for key, value in model_copy.__dict__.items():
                if isinstance(value, np.ndarray):
                    trained_models_json[model_copy.__class__.__name__][key] = value.tolist()
        return trained_models_json

    def set_model(self, model_id: str) -> None:
        # self.model_id = model_id
        model_obj = self.global_config_json['nodes'][model_id]
        self.config_json['data']['estimator'] = {
            "type": model_obj['data']['selection'],
            "settings": model_obj['data']['settings']
        }
