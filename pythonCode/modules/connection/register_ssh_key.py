import json
import sys
import os
from pathlib import Path
# add a .parent to the import if your script is in a subfolder of modules folder :
# sys.path.append(
    #str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent)) 
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecScriptRegisterSSHKey(GoExecutionScript):
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
        This function is used to register and validate an SSH key
        sent through the established tunnel.

        Args:
            json_config: The input json params
        """
        go_print(json.dumps(json_config, indent=4))
        
        return self.results


script = GoExecScriptRegisterSSHKey(json_params_dict, id_)
script.start()