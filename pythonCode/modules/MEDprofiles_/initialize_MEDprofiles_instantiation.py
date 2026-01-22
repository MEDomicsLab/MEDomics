import json
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

MODULE_DIR = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent / 'submodules' / 'MEDprofiles')
sys.path.append(MODULE_DIR)

SUBMODULE_DIR = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent.parent)
sys.path.append(SUBMODULE_DIR)


from submodules.MEDprofiles.MEDprofiles.src.back.instantiate_data_from_master_table import *
from submodules.MEDprofiles.MEDprofiles.src.back.constant import *

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecInitializeMEDprofilesInstantiation(GoExecutionScript):
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
        Prepare binary file and patient list for MEDprofiles instantiation by batch. 

        Returns: self.results : dict containing the json request, the generated binary file path and the list of MEDprofiles.
        """
        go_print(json.dumps(json_config, indent=4))
        
        # Set local variables
        master_table_id = json_config["masterTableID"]
        MEDprofiles_folder = json_config["MEDprofilesFolderPath"]
        MEDclasses_module = os.path.join(MEDprofiles_folder, "MEDclasses")
        if MEDclasses_module not in sys.path:
            sys.path.append(MEDclasses_module)
                
        # Connect to MongoDB and get the master table
        db = connect_to_mongo()
        master_table = pd.DataFrame(list(db[master_table_id].find())).drop('_id', axis=1)

        # Append indexes to the master table top row
        master_table.loc[-1] = master_table.columns
        master_table.index += 1  # shifting index
        master_table.sort_index(inplace=True)
        master_table = master_table.drop(INDEX_TYPE_ROW).drop(INDEX_ATTRIBUTE_ROW)

        # Get all the patient id
        patient_list = list(master_table.transpose().loc[FIXED_COLUMNS[0]].drop_duplicates())

        # Convert all patient ids to string
        patient_list = [str(patient) for patient in patient_list]        
        json_config["patient_list"] = patient_list

        self.results = json_config
        return self.results


script = GoExecInitializeMEDprofilesInstantiation(json_params_dict, id_)
script.start()
