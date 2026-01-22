import json
import os
import pickle
import sys
import typing
from pathlib import Path

import gridfs
import pandas as pd
from tqdm import tqdm

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

MODULE_DIR = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent / 'submodules' / 'MEDprofiles')
sys.path.append(MODULE_DIR)

SUBMODULE_DIR = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent.parent)
sys.path.append(SUBMODULE_DIR)

from submodules.MEDprofiles.MEDprofiles.src.back.constant import *

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecInstantiateMEDprofiles(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None, isProgressInThread: bool = True):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        Instantiate MEDprofiles data as binary file given a master table and MEDclasses
        specified by a json request. Uses the same code as in instantiate_data_from_master_table.main 
        function from the MEDprofiles submodule.

        Args:
            json_config (dict): The input json params.

        Returns: 
            dict: The json request and the generated binary file path.
        """
        go_print(json.dumps(json_config, indent=4))
        
        # Retrieve the parameters from the json request
        master_table_id = json_config["masterTableID"]
        MEDclasses_folder_path = json_config["MEDclassesFolder"]
        patient_list = json_config["patientList"]
        pickle_file_obj = json_config["pickleFileObject"]
        last_chunk = json_config["lastChunk"]
        root_dir = json_config["rootDir"]
        root_dir = os.path.join(root_dir, ".medomics")

        # Connect to MongoDB
        db = connect_to_mongo()

        # Retrieve the master table
        master_table = pd.DataFrame(list(db[master_table_id].find())).drop('_id', axis=1)

        # Append indexes to the master table top row
        master_table.loc[-1] = master_table.columns
        master_table.index += 1  # shifting index
        master_table.sort_index(inplace=True)
        master_table = master_table.drop(INDEX_TYPE_ROW).drop(INDEX_ATTRIBUTE_ROW)

        # Add MEDclasses to the path
        MEDclasses_folder_path = os.path.dirname(MEDclasses_folder_path)
        if MEDclasses_folder_path not in sys.path:
            sys.path.append(MEDclasses_folder_path)

        self.create_medprofile(master_table, pickle_file_obj, root_dir, last_chunk, patient_list)

    def create_medprofile(self, df_master, pickle_file_obj, root_dir, last_chunk, patient_id_list=[]):
        """
        Instantiate a list of MEDPatient objects from a csv file in MEDPatientData file with pickle
        and the list of patient we want to get data from. This functions is the same as in the main function
        in the instantiate_data_from_master_table.py file from the MEDprofiles submodule.

        Args:
            df_master (pd.DataFrame): The master table.
            pickle_file_obj (dict): The pickle file object containing instanced of the MEDprofiles.
            root_dir (str): The root directory.
            last_chunk (bool): The last chunk of data.
            patient_id_list (list, optional): The list of patient id. If not provided, it will be extracted from the master table. Defaults to [].

        Returns:
            None
        """
        # Import MEDclasses module
        import MEDclasses as medclasses_module

        global progress
        progress = 0

        # Get all the patient id and create an empty list for MEDPatients
        if len(patient_id_list) == 0:
            patient_id_list = df_master.transpose().loc[FIXED_COLUMNS[0]].drop_duplicates()
        med_profile_list = []

        # Get data for each MEDPatient
        for patientID, _ in zip(patient_id_list, tqdm(range(len(patient_id_list)))):
            # To set dynamically the required attributes (without knowing their names), we have to pass through a dictionary
            init = {FIXED_COLUMNS[0]: patientID, 'list_MEDtab': None}
            med_profile = medclasses_module.MEDprofile(**init)
            profile_data = df_master.loc[df_master[FIXED_COLUMNS[0]].astype(str) == patientID].dropna(how='all')
            med_tab_list = []

            # Create MEDTab object for each row
            for row in range(len(profile_data)):
                med_tab = medclasses_module.MEDtab()

                # For each attribute of MEDTab class
                for field in med_tab.__dict__:

                    # Fixed attributes are just str or float
                    if field in FIXED_COLUMNS:
                        if str(typing.get_type_hints(med_tab)[field]).__contains__("datetime.date") \
                            or str(typing.get_type_hints(med_tab)[field]).__contains__("datetime.datetime"):
                            med_tab.__setattr__(field, med_tab.parse_date(profile_data[field].iloc[row]))
                        else:
                            med_tab.__setattr__(field, profile_data[field].iloc[row])

                    # Other attributes are class objects
                    else:
                        class_object = medclasses_module.__dict__[field]()

                        for attribute in class_object.__dict__:
                            # Class attributes follow the naming convention "className_attributeName"
                            if str(field + '_' + attribute) in profile_data.columns:
                                null = profile_data[field + '_' + attribute].isnull().iloc[row]
                                if not null:
                                    # Set the attribute with the good type
                                    class_object.__setattr__(attribute, profile_data[field + '_' + attribute].iloc[row])

                        med_tab.__setattr__(field, class_object)
                med_tab_list.append(med_tab)
            
            # MEDProfile is composed by a list of MEDTab
            med_profile.__setattr__('list_MEDtab', med_tab_list)
            med_profile_list.append(med_profile)
            progress += 1/len(patient_id_list) * 100

        # Create MEDprofiles binary file
        destination_file = os.path.join(root_dir, pickle_file_obj["name"])
        if os.path.exists(destination_file):
            with open(destination_file, 'rb') as f:
                try:
                    existing_med_profile_list = pickle.load(f)
                except EOFError:
                    existing_med_profile_list = []
        else:
            existing_med_profile_list = []
        existing_med_profile_list += med_profile_list
        
        with open(destination_file, 'wb') as data_file:
            pickle.dump(existing_med_profile_list, data_file)

        if last_chunk:
            data_file.close()
            # Create MEDprofiles binary file if not exists
            db = connect_to_mongo()
            
            # Push file to MongoDB using GridFS
            fs = gridfs.GridFS(db)
            if fs.exists({"filename": pickle_file_obj["name"]}):
                fs.delete(fs.find_one({"filename": pickle_file_obj["name"]})._id)
            
            # upload the file to GridFS
            with open(destination_file, 'rb') as f:
                fs.put(f, filename=pickle_file_obj["name"], id=pickle_file_obj["id"])
            
            # Remove the file locally after saving data to the mongo database
            os.remove(destination_file)
        else:
            data_file.close()


script = GoExecInstantiateMEDprofiles(json_params_dict, id_)
script.start()
