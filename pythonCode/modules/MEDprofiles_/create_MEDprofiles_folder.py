import json
import os
import sys
from pathlib import Path

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecCreateMEDprofilesFolder(GoExecutionScript):
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
        Method called at the opening of the MEDprofiles module in order to create a folder
        relative to the MEDprofiles data. 

        Returns: self.results : dict containing the json request and the generated MEDprofiles folder path.
        """
        go_print(json.dumps(json_config, indent=4))
        
        # Set local variables
        root_data_folder = json_config["rootDataFolder"]

        # Create MEDprofiles folder
        path_MEDprofiles = os.path.join(root_data_folder, "MEDprofiles")
        if not os.path.exists(path_MEDprofiles):
            os.mkdir(path_MEDprofiles)
        path_master_tables = os.path.join(path_MEDprofiles, "master_tables")
        if not os.path.exists(path_master_tables):
            os.mkdir(path_master_tables)
        json_config["MEDprofiles_folder"] = path_MEDprofiles
        self.results = json_config

        return self.results


script = GoExecCreateMEDprofilesFolder(json_params_dict, id_)
script.start()
