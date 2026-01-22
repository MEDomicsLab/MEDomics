import json
import os
import pickle
import sys
from pathlib import Path

import gridfs

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

MODULE_DIR = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent / 'submodules' / 'MEDprofiles')
sys.path.append(MODULE_DIR)

SUBMODULE_DIR = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent.parent)
sys.path.append(SUBMODULE_DIR)

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecLoadPickleCohort(GoExecutionScript):
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
        Function reading MEDprofiles binary data given a binary file and MEDclasses
        specified by a json request and converting it into json data.
        
        args:
            json_config (dict): The input json params
        
        Returns:
            dict: Json results in case of error.
        """
        go_print(json.dumps(json_config, indent=4))
        
        # Set local variables
        MEDclasses_folder_path = json_config["MEDclassesFolder"]
        MEDprofiles_bin_id = json_config["MEDprofilesBinaryFileID"]
        medprofiles_json_id = json_config["MEDprofilesJsonFileID"]
        MEDclasses_module_path = os.path.dirname(MEDclasses_folder_path)

        # Add MEDclasses module to sys.path if not present
        if MEDclasses_module_path not in sys.path:
            sys.path.append(MEDclasses_module_path)

        # Import MEDclasses module
        import MEDclasses as medclasses_module

        # Load the pickle file
        db = connect_to_mongo()

        # Create a GridFS instance
        fs = gridfs.GridFS(db)

        # Load the pickle file from GridFS using file_id
        try:
            grid_out = fs.get_last_version(id=MEDprofiles_bin_id)
        except Exception:
            return {"error": "Binary file not found, try instantiating MEDprofiles first."}
        
        # Deserialize the pickle file content
        list_MEDprofile = pickle.loads(grid_out.read())

        # Get the cohort
        cohort = medclasses_module.MEDcohort(list_MEDprofile=list_MEDprofile)
        json_data = cohort.to_json()

        # If a file with the same file_id exists, delete it
        if fs.exists({"filename": "MEDprofiles.json"}):
            fs.delete(fs.get_last_version("MEDprofiles.json")._id)

        # Save the JSON file back into GridFS
        fs.put(json_data.encode('utf-8'), filename="MEDprofiles.json", id=medprofiles_json_id)


script = GoExecLoadPickleCohort(json_params_dict, id_)
script.start()
