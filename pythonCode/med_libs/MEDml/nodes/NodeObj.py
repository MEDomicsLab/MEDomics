import ast
import copy
import json
import os
import sys
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, List, Union

import numpy as np
import pandas as pd
from colorama import Fore
from pycaret.internal.pipeline import Pipeline as PycaretPipeline
from sklearn.base import BaseEstimator
from sklearn.pipeline import Pipeline

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


def str2bool(v: str) -> bool:
    """
    Converts a string to a boolean
    Args:
        v: string to convert

    Returns:
        True if the string is "True", False otherwise
    """
    return v.lower() == "true"


def is_float(element: Any) -> bool:
    """
    Checks if an element is a float
    Args:
        element: element to check

    Returns:
        True if the element is a float, False otherwise
    """
    try:
        float(element)
        return True
    except ValueError:
        return False


def format_model(model: Union[BaseEstimator, Pipeline, PycaretPipeline]) -> Union[BaseEstimator, Pipeline, PycaretPipeline]:
    """
    Formats a model (e.g. if it is a Pipeline, it returns the last step of the Pipeline)
    Args:
        model: the model to format

    Returns:
        the formatted model
    """
    if isinstance(model, Pipeline) or isinstance(model, PycaretPipeline):
        model = model.steps[-1][1]
    return model


class Node(ABC):
    """
    Abstract class for all nodes
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Constructor for Node class
        Args:
            id_: the corresponding id of the node
            global_config_json: specifies the configuration of the node (e.g. settings, inputs, outputs)
        """
        print(
            Fore.BLUE + f"Node {id_} created : {global_config_json['nodes'][str(id_)]['data']['internal']['type']}" + Fore.RESET)
        self.global_config_json = global_config_json
        self.config_json = global_config_json['nodes'][str(id_)]
        self._code = self.config_json['data']['internal']['code']
        self.CodeHandler = NodeCodeHandler()
        self.settings = copy.deepcopy(
            self.config_json['data']['internal']['settings'])
        self.type = self.config_json['data']['internal']['type']
        self.username = self.config_json['data']['internal']['name']
        self.id = id_
        self.nameID = self.config_json['data']['internal'].get('nameID', None)
        self._has_run = False
        self.just_run = False
        self._info_for_next_node = {}
        for setting, value in self.settings.items():
            if isinstance(value, str):

                # Convert numeric strings
                if is_float(value):
                    if "." in value:
                        self.settings[setting] = float(value)
                    else:
                        self.settings[setting] = int(value)

                # Convert tuple strings like "(150, 80)"
                elif value.startswith("(") and value.endswith(")"):
                    try:
                        self.settings[setting] = ast.literal_eval(value)
                    except Exception:
                        print(f"Warning: Failed to convert tuple-like value: {setting}={value}")
                
    def has_run(self):
        """
        Returns whether the node has been executed or not
        Returns:
            True if the node has been executed, False otherwise
        """
        return self._has_run

    def has_changed(self):
        """
        Returns whether the node has been changed or not, if true, the node should be executed just like the following ones
        Returns:
            True if the node has been changed (or "just run" because it has to be re-run if changed), False otherwise
        """
        return self.just_run

    def get_info_for_next_node(self) -> json:
        """
        Returns the information that the node has to pass to the next node
        Returns:
            the information that the node has to pass to the next node
        """
        return self._info_for_next_node

    def execute(self, experiment: dict = None, **kwargs) -> json:
        """
        Executes the node (at the Parent level, it just sets the "just_run" flag to True and calls the _execute method)
        Args:
            experiment: dictionary containing the experiment information
            **kwargs: dictionary containing the information that the node receives from the previous node

        Returns:
            result of the execution of the node
        """
        self.CodeHandler.reset()
        self.CodeHandler.add_line("md", f"### This is {self.username}")
        if self.nameID is not None and self.type != "train_model" and self.type != "compare_models":
            self.CodeHandler.add_line("md", f"##### *Node ID: {self.nameID}*")
        self.just_run = True
        self._has_run = True

        return self._execute(experiment, **kwargs)

    def __eq__(self, other):
        """
        Checks if two nodes are equal (useful when comparing saved pipelines with new run request)\n
        Equality is defined by the id and the configuration of the node
        Args:
            other: an Node object to compare with

        Returns:
            True if the two nodes are equal, False otherwise
        """
        return self.id == other.id and self.config_json == other.config_json

    @abstractmethod
    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        Abstract method that has to be implemented by the child classes. \n
        It is called by the execute method and it is the one that actually executes the node
        Args:
            experiment: dictionary containing the experiment information
            **kwargs: dictionary containing the information that the node receives from the previous node

        Returns:
            result of the execution of the node
        """
        pass


class NodeCodeHandler:
    """
    Class used to handle the code of a node
    """
    @staticmethod
    def convert_dict_to_params(dictionary: dict) -> str:
        """
        Converts a dictionary to a string of parameters
        """
        params = ""
        for key, value in dictionary.items():
            if isinstance(value, str):
                params += f"{key}='{value}', "
            else:
                params += f"{key}={value}, "
        return params[:-2]

    def __init__(self, base_code: List[dict] = []) -> None:
        """
        Constructor for NodeCodeHandler class
        Args:
            base_code: base code of the node
        """
        self.code = base_code
        self.imports = []

    def add_import(self, import_name: str):
        """
        Adds an import to the code
        Args:
            import_name: name of the import

        Returns:
            None
        """
        self.imports.append(
            {"type": "code", "content": import_name, "indent": 0})

    def add_line(self, line_type: str, line: str, indent: int = 0):
        """
        Adds a line to the code
        Args:
            line_type: type of the line (e.g. "code" or "md")
            line: content of the line
            indent: indentation of the line

        Returns:
            None
        """
        indent_str = "    " * indent
        self.code.append(
            {"type": line_type, "content": indent_str+line, "indent": indent})

    def add_function(self, func_name, func_params, func_body):
        """
        Adds a function to the code
        Args:
            func_name: name of the function
            func_params: parameters of the function
            func_body: body of the function

        Returns:
            None
        """
        self.add_line("code", f"def {func_name}({func_params}):", 0)
        for line in func_body:
            self.add_line("code", line, 1)

    def newLine(self):
        """
        Adds a new line to the code
        Returns:
            None
        """
        self.add_line("code", "\n", 0)

    def add_seperator(self):
        """
        Adds a seperator to the code
        Returns:
            None
        """
        self.add_line("seperator", "---------------------", 0)

    def reset(self):
        """
        Resets the code
        Returns:
            None
        """
        self.code = []

    def get_code(self):
        """
        Returns the code
        Returns:
            the code
        """
        return self.code

    def get_imports(self):
        """
        Returns the imports
        Returns:
            the imports
        """
        return self.imports
