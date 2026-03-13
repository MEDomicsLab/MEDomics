import json
import sys
import os
from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)) 
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecScriptConnectionTest(GoExecutionScript):
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
        This function is used to test if the connection to the server is working.

        Args:
            json_config: The input json params
        """
        go_print(json.dumps(json_config, indent=4))

        # Get the directory where the current script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))

        # Define the path for your new text file
        file_path = os.path.join(script_dir, "test.txt")

        # Write something to the file
        with open(file_path, "w") as f:
            f.write("This is a test file created next to connection_test_request.py.\n")
    
        self.results = {
            "status": "success",
            "message": "Connection test successful",
            "data": "yippie"
        }
        return self.results


script = GoExecScriptConnectionTest(json_params_dict, id_)
script.start()