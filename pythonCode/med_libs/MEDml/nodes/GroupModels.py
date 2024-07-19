import pandas as pd
import copy
import numpy as np
import json

from sklearn.pipeline import Pipeline

from .NodeObj import Node, format_model, NodeCodeHandler
from typing import Union
from colorama import Fore
from med_libs.server_utils import go_print

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class GroupModels(Node):
    """
    This class represents the GroupModels node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json.
        """
        super().__init__(id_, global_config_json)
        self.config_json['instance'] = 0
        # print(f"GroupModels: {json.dumps(self.global_config_json, indent=4)}")
        self.models_list = sorted(self.config_json['associated_id'].split('.'))
        self.config_json['cur_models_list_id'] = []
        self.config_json['cur_models_list_obj'] = []
        self.config_json['cur_models_list_settings'] = []
        print(f"GroupModels: {self.models_list}")
        print(f"{self.config_json['cur_models_list_id']}")

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        self.config_json['instance'] += 1
        self.config_json['cur_models_list_id'] += [kwargs['id'].split('*')[0]]
        self.config_json['cur_models_list_settings'] += [kwargs['settings']]
        print()
        print(Fore.BLUE + "=== GroupModels === " + Fore.YELLOW + f"({self.username})" + Fore.RESET)
        print(self.config_json['instance'])
        trained_models = kwargs['models']
        trained_models_json = {}

        for model in kwargs['models']:
            model = format_model(model)
            print(Fore.CYAN + f"Grouping: {model.__class__.__name__}" + Fore.RESET)

        trained_models_copy = trained_models.copy()
        self.config_json['cur_models_list_obj'] += trained_models_copy
        self._info_for_next_node = {'models': self.config_json['cur_models_list_obj'], 'id': self.id}
        self.CodeHandler.add_line("code", f"trained_models = []")

        isLast = sorted(self.config_json['cur_models_list_id']) == self.models_list or len(
            self.config_json['cur_models_list_id']) > len(self.models_list)
        if isLast:
            for settings in self.config_json['cur_models_list_settings']:
                model_string = format_model_process(settings)
                self.CodeHandler.add_line("code", f"trained_models += {[model_str['content'] for model_str in model_string]}".replace("\"", ""))
        return {"prev_node_complete": isLast}


def format_model_process(settings):
    """
    This function is used to format the model process.

    Args:
        settings (dict): The settings.

    Returns:
        List[dict] : The formatted model process.
    """
    codeHandler = NodeCodeHandler()
    codeHandler.reset()
    settings_cp = copy.deepcopy(settings)
    fct_type = settings_cp['fct_type']
    del settings_cp['fct_type']
    if fct_type == 'compare_models':
        codeHandler.add_line(
            "code",
            f"pycaret_exp.compare_models({codeHandler.convert_dict_to_params(settings_cp)})")

    elif fct_type == 'train_model':
        codeHandler.add_line(
            "code",
            f"pycaret_exp.create_model({codeHandler.convert_dict_to_params(settings_cp)})")

    return codeHandler.get_code()
