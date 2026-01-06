import json
from typing import Union

import numpy as np
import pandas as pd
from colorama import Fore

from ..logger.MEDml_logger_pycaret import MEDml_logger
from ..MEDexperiment_learning import create_pycaret_exp
from .NodeObj import *

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
        print(Fore.BLUE + "=== cleaning === " +
              Fore.YELLOW + f"({self.username})" + f"({self.settings})" + Fore.RESET)

        medml_logger = MEDml_logger()
        pycaret_exp = create_pycaret_exp(ml_type=self.global_config_json['MLType'])

        # --- Gather setup parameters from Dataset and Clean ---
        ds = kwargs.get("dataset_setup_settings", {})   # forwarded by Dataset
        cl = kwargs.get("setup_settings", {})           # UI of Clean (optional)

        # --- Detect conflicts (only for visibility in logs) ---
        overlap = set(ds.keys()) & set(cl.keys())
        if overlap:
            print("Conflicting setup keys (Clean overrides Dataset):", sorted(overlap))

        # --- Merge with priority: Clean > Dataset ---
        effective = {**ds, **cl, **self.settings}
        print("SETUP (Dataset):", ds)
        print("SETUP (Clean):", cl)
        print("SETUP (final):", effective)

        # --- Single setup() call with the merged dict (no self.settings here) ---
        pycaret_exp.setup(
            data=experiment['df'],
            log_experiment=medml_logger,
            log_plots=True,
            log_data=True,
            **effective
        )

        # Reflect the merged settings in generated code (no self.settings here)
        self.CodeHandler.add_line(
            "code", f"pycaret_exp = {self.global_config_json['MLType'].capitalize()}Experiment()"
        )
        self.CodeHandler.add_line(
            "code",
            "pycaret_exp.setup(data=temp_df, " +
            f"{self.CodeHandler.convert_dict_to_params(effective)})"
        )
        self.CodeHandler.add_line(
            "code", "dataset = pycaret_exp.get_config('X').join(pycaret_exp.get_config('y'))"
        )

        self._info_for_next_node = kwargs
        self._info_for_next_node["cleaning_settings"] = self.settings
        return {
            "experiment": {
            'pycaret_exp': pycaret_exp,
            'medml_logger': medml_logger,
            },
            "table": "dataset",
            "paths": ["path"],
        }
