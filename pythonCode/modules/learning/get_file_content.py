import json
import os
import sys
from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)



class GoExecScriptMerge(GoExecutionScript):
    """
        This class is used to execute the merge script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function reads the content of a file

        Args:
            json_config: The input json params
        """
        go_print(json.dumps(json_config, indent=4))

        try:
            # Set local variables
            file_path = json_config["filePath"]

            # Check if the file exists
            if not os.path.exists(file_path):
                return {"error": "File not found"}

            # Read the file content
            with open(file_path, "r") as file:
                content = file.read()

            # Detect the file extension
            prog_lang = os.path.splitext(file_path)[1].lower().replace(".", "")
            if prog_lang == "py" or prog_lang == "ipynb":
                prog_lang = "python"
            elif prog_lang == "md":
                prog_lang = "markdown"
            elif prog_lang == "txt":
                prog_lang = "text"

            # Return the file content and extension
            return {
                "content": content,
                "language": prog_lang
            }

        except Exception as e:
            return {"error": str(e)}
    
script = GoExecScriptMerge(json_params_dict, id_)
script.start()
