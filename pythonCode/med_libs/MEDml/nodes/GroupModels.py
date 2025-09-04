from __future__ import annotations

import copy
import json
from typing import List, Union

import numpy as np
import pandas as pd
from colorama import Fore

from .NodeObj import Node, format_model, NodeCodeHandler


DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE    = Union[int, str, list, tuple, np.ndarray, pd.Series]

# Only two PyCaret functions are admissible because they expect a *list* input
ALLOWED_OPT_FUNCS = {"blend_models", "stack_models"}

def format_model_process(settings: dict) -> List[dict]:
    """
    Translate a settings dict into PyCaret code fragments
    (used elsewhere for HTML export / code generation).
    """
    codeHandler = NodeCodeHandler()
    codeHandler.reset()
    settings_cp = copy.deepcopy(settings)

    fct_type = settings_cp.pop("fct_type", None)

    if fct_type == "compare_models":
        codeHandler.add_line(
            "code",
            f"pycaret_exp.compare_models({codeHandler.convert_dict_to_params(settings_cp)})"
        )
    elif fct_type == "train_model":
        codeHandler.add_line(
            "code",
            f"pycaret_exp.create_model({codeHandler.convert_dict_to_params(settings_cp)})"
        )
    return codeHandler.get_code()


class GroupModels(Node):
    """
    Legacy-compatible node that now *optionally* blends or stacks the
    collected models.

    • The engine may call `_execute()` several times (one per upstream branch).
    • We store every incoming list until all `associated_id`s have reported.
    • On the last pass we call the chosen ensemble function (if any).
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        super().__init__(id_, global_config_json)

        # buffer used in the original implementation
        self.config_json["instance"] = 0

        # list of expected upstream node IDs (provided by the designer)
        self.models_list: List[str] = sorted(self.config_json["associated_id"].split("."))

        # original accumulation keys
        self.config_json["cur_models_list_id"]      = []
        self.config_json["cur_models_list_obj"]     = []
        self.config_json["cur_models_list_settings"] = []

        # NEW — optional optimisation settings
        self.optimize_fct: str | None = self.settings.get("optimize_fct")
        self.optimize_params: dict    = self.settings.get("optimize_params", {})

        # validate optimisation choice early
        if self.optimize_fct and self.optimize_fct not in ALLOWED_OPT_FUNCS:
            raise ValueError(
                f"[GroupModels] optimise_fct='{self.optimize_fct}' is not allowed. "
                f"Pick one of {ALLOWED_OPT_FUNCS} or leave the field empty."
            )

        print(f"GroupModels – waiting for: {self.models_list}")

    # --------------------------------------------------------------------- #
    # execution – called once per branch                                    #
    # --------------------------------------------------------------------- #
    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        kwargs expected (legacy contract):
            id      : "nodeId*instance"
            models  : list of trained estimators
            settings: (optional) dict
        """
        self.config_json["instance"] += 1
        branch_id = kwargs["id"].split("*")[0]

        # ------------------------------------------------------------------
        # 1) accumulate current call                                        #
        # ------------------------------------------------------------------
        self.config_json["cur_models_list_id"].append(branch_id)
        self.config_json["cur_models_list_obj"].extend(kwargs["models"])
        if "settings" in kwargs:
            self.config_json["cur_models_list_settings"].append(kwargs["settings"])

        print(
            Fore.BLUE + "=== GroupModels === "
            + Fore.YELLOW + f"({self.username})" + Fore.RESET
        )
        for mdl in kwargs["models"]:
            print(
                Fore.CYAN + f"Grouping: {format_model(mdl).__class__.__name__}"
                + Fore.RESET
            )

        # forward the *current* list (even if incomplete) to downstream nodes
        self._info_for_next_node = {
            "models": self.config_json["cur_models_list_obj"],
            "id"    : self.id,
        }

        # create / update the exported code
        if not hasattr(self, "CodeHandler"):
            self.CodeHandler = NodeCodeHandler()
            self.CodeHandler.add_line("code", "trained_models = []")
        self.CodeHandler.add_line(
            "code",
            "trained_models += [  # add batch\n" +
            ", ".join(mdl.__class__.__name__ for mdl in kwargs["models"]) +
            "]"
        )

        # ------------------------------------------------------------------
        # 2) have we collected every expected branch?                       #
        # ------------------------------------------------------------------
        is_last_pass = (
            sorted(self.config_json["cur_models_list_id"]) == self.models_list
        )
        if not is_last_pass:
            return {"prev_node_complete": False}   # keep children on hold

        # ------------------------------------------------------------------
        # 3) last pass – optional optimisation                              #
        # ------------------------------------------------------------------
        if self.optimize_fct:
            if len(self.config_json["cur_models_list_obj"]) < 2:
                raise ValueError(
                    f"[GroupModels] {self.optimize_fct} needs at least 2 models "
                    f"(received {len(self.config_json['cur_models_list_obj'])})."
                )

            print(Fore.GREEN + f"→ Optimising via {self.optimize_fct}" + Fore.RESET)

            pycaret_exp      = experiment["pycaret_exp"]
            optimise_call    = getattr(pycaret_exp, self.optimize_fct)
            optimised_model  = optimise_call(
                self.config_json["cur_models_list_obj"],
                **self.optimize_params
            )

            # replace list with the single optimised model
            self.config_json["cur_models_list_obj"] = [optimised_model]
            self._info_for_next_node["models"]      = [optimised_model]

            # write matching code line
            params_str = self.CodeHandler.convert_dict_to_params(self.optimize_params)
            self.CodeHandler.add_line(
                "code",
                f"optimized_model = pycaret_exp.{self.optimize_fct}(trained_models, {params_str})"
            )
            self.CodeHandler.add_line("code", "trained_models = [optimized_model]")

        # ------------------------------------------------------------------
        # 4) build a lightweight JSON dump for logging                      #
        # ------------------------------------------------------------------
        trained_models_json = {}
        for mdl in self.config_json["cur_models_list_obj"]:
            mdl_copy = copy.deepcopy(mdl)
            trained_models_json[mdl_copy.__class__.__name__] = {
                k: (v.tolist() if isinstance(v, np.ndarray) else v)
                for k, v in mdl_copy.__dict__.items()
            }
        return trained_models_json
