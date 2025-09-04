import pandas as pd
import copy
import numpy as np
import json

from sklearn.pipeline import Pipeline

from .NodeObj import Node, format_model
from typing import Union
from colorama import Fore

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class Optimize(Node):
    """
    This class represents the Optimize node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json.
        """
        super().__init__(id_, global_config_json)

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        print()
        print(Fore.BLUE + "=== optimizing === " +
              Fore.YELLOW + f"({self.username})" + Fore.RESET)
        settings = copy.deepcopy(self.settings)
        trained_models = []
        trained_models_json = {}
        input_models = []
        for model in kwargs['models']:
            input_models.append(format_model(model))
        if "models" in self.type:
            self.CodeHandler.add_line(
                "code",
                f"optimized_model = pycaret_exp.{self.type}(trained_models, {self.CodeHandler.convert_dict_to_params(settings)})", 1)
            trained_models.append(getattr(experiment['pycaret_exp'], self.type)(input_models, **settings))
        else:
            self.CodeHandler.add_line("code", f"trained_models_optimized = []")
            self.CodeHandler.add_line("code", f"for model in trained_models:")
            self.CodeHandler.add_line(
                "code",
                f"optimized_model = pycaret_exp.{self.type}(model, {self.CodeHandler.convert_dict_to_params(settings)})",
                1)
            self.CodeHandler.add_line(
                "code", f"trained_models_optimized.append(optimized_model)", 1)
            for model in input_models:

                print(Fore.CYAN +
                      f"optimizing: {model.__class__.__name__}" + Fore.RESET)
                trained_models.append(
                    getattr(experiment['pycaret_exp'], self.type)(model, **settings))


        self.CodeHandler.add_line(
            "code", f"trained_models = trained_models_optimized")
        trained_models_copy = trained_models.copy()
        self._info_for_next_node = {'models': trained_models, 'id': self.id}
        for model in trained_models_copy:
            model_copy = copy.deepcopy(model)
            trained_models_json[model_copy.__class__.__name__] = model_copy.__dict__
            for key, value in model_copy.__dict__.items():
                if isinstance(value, np.ndarray):
                    trained_models_json[model_copy.__class__.__name__][key] = value.tolist()
        return trained_models_json
