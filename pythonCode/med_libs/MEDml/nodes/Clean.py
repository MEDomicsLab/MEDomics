import pandas as pd
import numpy as np
import json
from typing import Union
from .NodeObj import *
from typing import Union
from colorama import Fore
from ..logger.MEDml_logger_pycaret import MEDml_logger
from ..MEDexperiment_learning import create_pycaret_exp


DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class Clean(Node):
    """
    This class represents the Clean node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json. 
        """
        super().__init__(id_, global_config_json)
        self.df = None

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        print()
        print(Fore.BLUE + "=== cleaning === " +
              Fore.YELLOW + f"({self.username})" + f"({self.settings})" + Fore.RESET)

        medml_logger = MEDml_logger()
        pycaret_exp = create_pycaret_exp(
            ml_type=self.global_config_json['MLType'])
        pycaret_exp.setup(
            data=experiment['df'],
            **kwargs["setup_settings"],
            log_experiment=medml_logger,
            log_plots=True,
            log_data=True,
            **self.settings
        )
        setup_settings = kwargs["setup_settings"]
        self.CodeHandler.add_line(
            "code", f"pycaret_exp = {self.global_config_json['MLType'].capitalize()}Experiment()")
        if len(self.settings.keys()) > 0:
            self.CodeHandler.add_line(
                "code", f"pycaret_exp.setup(data=temp_df, {self.CodeHandler.convert_dict_to_params(setup_settings)}, {self.CodeHandler.convert_dict_to_params(self.settings)})")
        else:
            self.CodeHandler.add_line(
                "code", f"pycaret_exp.setup(data=temp_df, {self.CodeHandler.convert_dict_to_params(setup_settings)})")
        self.CodeHandler.add_line(
            "code", f"dataset = pycaret_exp.get_config('X').join(pycaret_exp.get_config('y'))")
        self._info_for_next_node = kwargs
        return {
            "experiment": {
            'pycaret_exp': pycaret_exp,
            'medml_logger': medml_logger,
            },
            "table": "dataset",
            "paths": ["path"],
        }
