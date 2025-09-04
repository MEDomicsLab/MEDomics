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

from submodules.MEDprofiles.MEDprofiles.src.back.constant import *
from submodules.MEDprofiles.MEDprofiles.src.back.create_classes_from_master_table import *

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecCreateMEDclasses(GoExecutionScript):
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
        Create MEDclasses given a master table specified by a json request in a specified folder.
        Use the create_classes_from_master_table.main function from the MEDprofiles submodule. 

        Returns: self.results : dict containing the json request and the generated MEDclasses folder path.
        """
        go_print(json.dumps(json_config, indent=4))

        # Set local variables
        master_table_id = json_config["masterTableID"]
        MEDprofiles_folder = json_config["MEDprofilesFolderPath"]
    
        # Connect to MongoDB
        db = connect_to_mongo()

        # Get the master csv from the database
        master_table = pd.DataFrame(list(db[master_table_id].find())).drop('_id', axis=1)

        # Append indexes to the master table top row
        master_table.loc[-1] = master_table.columns
        master_table.index += 1  # shifting index
        master_table.sort_index(inplace=True)

        # MEDclasses creation
        MEDclasses_folder_path = os.path.join(MEDprofiles_folder, "MEDclasses")
        if not os.path.exists(MEDclasses_folder_path):
            os.mkdir(MEDclasses_folder_path)
        self.create_classes(master_table, MEDclasses_folder_path)

        # Add MEDclasses folder to the sys.path
        if MEDclasses_folder_path not in sys.path:
            sys.path.append(MEDclasses_folder_path)
        
        # Set the generated MEDclasses folder path in the json_config
        MEDclasses_pkg = os.path.join(MEDclasses_folder_path, "MEDclasses")
        json_config["generated_MEDclasses_folder"] = MEDclasses_pkg
        self.results = json_config

        return self.results
    
    def create_classes(self, df: pd.DataFrame, path_gen_pkg_MEDclasses: str = '../../MEDclasses'):
        """
        Main function for class creation.

        Args:
            df (pd.DataFrame): The master table
            path_gen_pkg_MEDclasses (str): The path of the generated MEDclasses folder

        Returns: None

        """
        # Group attributes by classes
        classes_attributes_dict = get_classes_from_df(df.drop(FIXED_COLUMNS, axis=1))

        # Create directory MEDclasses for classes
        directory_name = 'MEDclasses'
        if os.path.exists(path_gen_pkg_MEDclasses): # Remove the directory if already exists because it may contains truncated content
            shutil.rmtree(path_gen_pkg_MEDclasses)
        
        path_pkg_MEDclasses = __import__('MEDprofiles').__path__[0]
        path_pkg_MEDclasses = os.path.join(path_pkg_MEDclasses, directory_name)
        path_pycache = os.path.join(path_pkg_MEDclasses, "__pycache__") # Remove pycache file
        if os.path.exists(path_pycache):
            shutil.rmtree(path_pycache)
        path_MEDclasses = os.path.join(path_gen_pkg_MEDclasses, directory_name)
        shutil.copytree(path_pkg_MEDclasses, path_MEDclasses)

        init_pkg_path = os.path.join(path_gen_pkg_MEDclasses, "__init__.py") # Create __init__ file for the pkg
        f = open(init_pkg_path, "x")
        f.close()

        # Create classes
        for class_ in classes_attributes_dict:
            create_class_file(path_MEDclasses, class_, classes_attributes_dict[class_], "MEDbaseObject", directory_name)

        # Set dynamic attributes in MEDtab class
        add_attributes_to_class(
            path_MEDclasses,
            "MEDtab", 
            list(classes_attributes_dict.keys()),
            list(classes_attributes_dict.keys()), 
            "MEDbaseObject"
        )

        # Set constant attributes in MEDtab class
        add_attributes_to_class(
            path_MEDclasses, 
            "MEDtab", 
            FIXED_COLUMNS[1:], 
            FIXED_COLUMNS_TYPES[1:], 
            "MEDbaseObject",
            False
        )

        # Create __init__ file
        init_path = os.path.join(path_MEDclasses, "__init__.py")
        with open(init_path, "a") as file:
            for class_ in list(classes_attributes_dict.keys()):
                file.write("from " + "." + class_ + " import " + class_ + "\n")
        file.close()

        # Set the created module in the sys.path
        sys.path.append(path_gen_pkg_MEDclasses)


script = GoExecCreateMEDclasses(json_params_dict, id_)
script.start()
