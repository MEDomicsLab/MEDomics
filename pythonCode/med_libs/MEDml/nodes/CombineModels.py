from __future__ import annotations

import copy
import json
from typing import List, Union, Optional, Dict, Any

import numpy as np
import pandas as pd
from colorama import Fore

from .NodeObj import Node, format_model, NodeCodeHandler

# --------------------------------------------------------------------------- #
# types & constants                                                           #
# --------------------------------------------------------------------------- #
DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE    = Union[int, str, list, tuple, np.ndarray, pd.Series]

ALLOWED_MAIN_FUNCS = {"blend_models", "stack_models"}
ALLOWED_POST_FUNCS = {"ensemble_model", "calibrate_model"}


# --------------------------------------------------------------------------- #
# helper                                                                      #
# --------------------------------------------------------------------------- #
def _validate_choice(field: str, value: str, allowed: set[str]) -> None:
    if value not in allowed:
        raise ValueError(
            f"[CombineModels] {field}='{value}' is not supported. "
            f"Choose one of {sorted(allowed)} or leave the field empty."
        )


# --------------------------------------------------------------------------- #
# main class                                                                  #
# --------------------------------------------------------------------------- #
class CombineModels(Node):
    """
    Node that combines several incoming PyCaret models.

    Settings expected in ``self.settings`` (all optional):
    """

    # ---------------------- initialisation -------------------------------- #
    def __init__(self, id_: int, global_config_json: json) -> None:
        super().__init__(id_, global_config_json)

        # Upstream IDs expected (set in the designer, separated by '.')
        self.upstream_ids: List[str] = sorted(
            self.config_json["associated_id"].split(".")
        )

        # Buffers for progressive accumulation
        self._received_ids:   List[str] = []
        self._received_models: List[Any] = []        # list of estimators
        self._received_opts:   List[dict] = []       # optional settings

        # ------------------------------------------------------------------ #
        # read settings                                                      #
        # ------------------------------------------------------------------ #
        s: dict = self.settings
        self.post_action:  Optional[str]  = s.get("post_action", None)
        self.post_params:  Dict[str, Any] = s.get("post_params", {})
        self.method = s.get("optimize_fct")
        self.method_params = s.get("optimize_params", {})

        # Validation -------------------------------------------------------- #
        if self.method:
            _validate_choice("method", self.method, ALLOWED_MAIN_FUNCS)
        if self.post_action:
            _validate_choice("post_action", self.post_action, ALLOWED_POST_FUNCS)

        # Code handler used for export
        self.CodeHandler = NodeCodeHandler()
        self.CodeHandler.add_line("code", "# --- CombineModels ---")
        self.CodeHandler.add_line("code", "trained_models = []")
        
        # Check if calibrate is activated
        if s.get("calibrate", False):
            self.post_action = "calibrate_model"
            self.post_params = {}

    # ---------------------- execution (may be called several times) -------- #
    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        Parameters forwarded by upstream nodes
        --------------------------------------
        id      : str - pattern ``"{nodeId}*{instance}"`` (legacy)
        models  : list - list of trained estimators
        settings: dict - (optional) - training settings for HTML export
        """
        #branch_id = kwargs["id"].split("*")[0]
        #self._received_ids.append(branch_id)
        self._received_models.extend(kwargs["models"])

        # Register code for the incoming batch
        batch_repr = ", ".join(format_model(m).__class__.__name__ for m in kwargs["models"])
        self.CodeHandler.add_line("code", f"trained_models += [{batch_repr}]")

        # ------------------------------------------------------------------ #
        # always forward CURRENT list – lets downstream nodes start as soon  #
        # as we have at least one model (legacy behaviour)                   #
        # ------------------------------------------------------------------ #
        self._info_for_next_node = {
            "models": self._received_models,
            "id"    : self.id,
        }

        # If not every upstream branch has reported, stop here --------------
        #if sorted(self._received_ids) != self.upstream_ids:
            #return {"prev_node_complete": False}

        # ========== LAST PASS – we have every model ======================== #
        full_list: List[Any] = self._received_models

        # ---------- Main combination (blend / stack) ----------------------- #
        if self.method:
            if len(full_list) < 2:
                raise ValueError(f"CombineModels '{self.method}' needs ≥2 models (received {len(full_list)})")
            print(Fore.GREEN + f" {self.method}()" + Fore.RESET)

            pycaret_exp = experiment["pycaret_exp"]
            combined = getattr(pycaret_exp, self.method)(
                full_list, **self.method_params
            )

            params_str = self.CodeHandler.convert_dict_to_params(self.method_params)
            self.CodeHandler.add_line(
                "code",
                f"combined_model = pycaret_exp.{self.method}(trained_models, {params_str})"
            )
            self.CodeHandler.add_line("code", "trained_models = [combined_model] + trained_models")

            # combined model goes to the front of the list
            full_list = [combined]

        # ---------- Optional post-processing (ensemble / calibrate) -------- #
        if self.post_action:
            print(Fore.GREEN + f" post_action : {self.post_action}()" + Fore.RESET)

            pycaret_exp = experiment["pycaret_exp"]
            final_model = getattr(pycaret_exp, self.post_action)(
                full_list[0], **self.post_params
            )

            params_str = self.CodeHandler.convert_dict_to_params(self.post_params)
            self.CodeHandler.add_line(
                "code",
                f"final_model = pycaret_exp.{self.post_action}(trained_models[0], {params_str})"
            )
            self.CodeHandler.add_line("code", "trained_models[0] = final_model")

            full_list[0] = final_model

        # ---------- Forward FULL list downstream --------------------------- #
        self._info_for_next_node["models"] = full_list

        # ---------- Lightweight JSON export for the logs ------------------- #
        logged = {}
        for mdl in full_list:
            safe_copy = copy.deepcopy(mdl)
            logged[safe_copy.__class__.__name__] = {
                k: (v.tolist() if isinstance(v, np.ndarray) else v)
                for k, v in safe_copy.__dict__.items()
                if not k.startswith("__")
            }

        print(
            Fore.BLUE + f"[CombineModels #{self.id}] emits "
            f"{len(full_list)} model(s)" + Fore.RESET
        )

        return {
            "prev_node_complete": True,
            "trained_models": logged,
        }
