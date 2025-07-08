import os
import json
import sys
from pathlib import Path

import signal

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print


json_params_dict, id_ = parse_arguments()



class GoExecScriptDBconfigFromMEDfl(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The json params of the execution
            _id: The id of the execution
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script of the execution of the process from Go
        """
        # string_received = json_config["stringFromFrontend"]
        try:
            os.kill(json_params_dict['pid'], signal.SIGTERM)
            go_print(f"Successfully stopped Flower server (PID: {json_params_dict['pid']})")
          
        except ProcessLookupError:
            go_print(f"No process found with PID {json_params_dict['pid']}. It may have already stopped.")
        return self.results


fl_db_config = GoExecScriptDBconfigFromMEDfl(json_params_dict, id_)
fl_db_config.start()
