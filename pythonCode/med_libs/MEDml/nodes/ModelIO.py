import copy
import json
import os
import pickle
import sys
import uuid
from pathlib import Path
from typing import Union

import numpy as np
import pandas as pd
from colorama import Fore
from sklearn.pipeline import Pipeline

from .NodeObj import Node, format_model

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from MEDDataObject import MEDDataObject
from mongodb_utils import (get_child_id_by_name,
                           get_pickled_model_from_collection,
                           insert_med_data_object_if_not_exists,
                           overwrite_med_data_object_content)

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]
MONGO_BSON_MAX = 16_777_216 # 16MB
MONGO_SAFETY_MARGIN = 1_000_000 # 1MB safety margin


class ModelIO(Node):
    """
    This class represents the ModelIO node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json.
        """
        super().__init__(id_, global_config_json)
        self.model_extension = '.medmodel'

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        print(Fore.BLUE + "=== model io === " + Fore.YELLOW + f"({self.username})" + Fore.RESET)
        print(Fore.CYAN + f"Using {self.type}" + Fore.RESET)
        settings = copy.deepcopy(self.settings)
        pycaret_exp = experiment['pycaret_exp']
        return_val = {}
        
        if self.type == 'save_model':
            self.CodeHandler.add_line("code", f"for model in trained_models:")
            for model in kwargs['models']:
                model = format_model(model)
                # Model's name
                if 'model_name' in settings.keys() and settings['model_name']:
                    model_name = settings['model_name']
                else:
                    model_name = model.__class__.__name__

                # Path save model (if too big for MongoDB)
                if 'pathSave' in settings.keys() and settings['pathSave']:
                    path_save = settings['pathSave']
                    os.makedirs(path_save, exist_ok=True)

                # Serialize model
                model = pycaret_exp.save_model(model, model_name)
                serialized_model = pickle.dumps(model[0])

                # Model's threshold
                model_threshold = None
                if hasattr(model[0], 'steps'):
                    classifier = model[0].steps[-1][1]
                    if hasattr(classifier, 'probability_threshold'):
                        model_threshold = classifier.probability_threshold

                # Remove model save locally
                os.remove(model[1])

                # .medmodel object
                model_med_object = MEDDataObject(
                    id = str(uuid.uuid4()),
                    name = model_name + ".medmodel",
                    type = "medmodel",
                    parentID = self.global_config_json['identifiers']['models'],
                    childrenIDs = [],
                    inWorkspace = False
                )

                # Check if the model size is less than MongoDB BSON limit (16MB)
                fits_mongo = len(serialized_model) <= (MONGO_BSON_MAX - MONGO_SAFETY_MARGIN)
                if not fits_mongo:
                    if 'pathSave' not in settings.keys() or not settings['pathSave']:
                        raise ValueError("Model is too large to be stored in MongoDB. Please provide a valid 'pathSave' setting to save the model locally.")
                    model_med_object.inWorkspace = True
                    model_med_object.path = path_save + f"/{model_name}_model.pkl"
                model_med_object_id = insert_med_data_object_if_not_exists(model_med_object, None)

                settings_copy = copy.deepcopy(settings)
                settings_copy['model_name'] = model_name
                """ getattr(experiment['pycaret_exp'], self.type)(model, **settings_copy) """
                self.CodeHandler.add_line(
                    "code", 
                    f"pycaret_exp.save_model(model, {self.CodeHandler.convert_dict_to_params(settings_copy)})", 
                    1
                )
                
                # .medmodel model
                serialized_model_med_object = MEDDataObject(
                    id=str(uuid.uuid4()),
                    name = "model.pkl",
                    type = "pkl",
                    parentID = model_med_object_id,
                    childrenIDs = [],
                    inWorkspace = False
                )

                if fits_mongo:
                    serialized_model_id = insert_med_data_object_if_not_exists(serialized_model_med_object, [{'model': serialized_model}])
                    # If model already existed we overwrite its content
                    if serialized_model_id != serialized_model_med_object.id:
                        success_pkl = overwrite_med_data_object_content(serialized_model_id, [{'model': serialized_model}])
                        print("pickle overwrite succeed : ", success_pkl)
                else:
                    # Save model locally
                    path_save = Path(path_save) / f"{model_name}_model.pkl"
                    with open(path_save, "wb") as f:
                        f.write(serialized_model)
                    # Read it back as binary to store the path in the database
                    serialized_model_id = insert_med_data_object_if_not_exists(serialized_model_med_object, [{'model_path': str(path_save)}])
                    # If model already existed we overwrite its content
                    if serialized_model_id != serialized_model_med_object.id:
                        success_pkl = overwrite_med_data_object_content(serialized_model_id, [{'model_path': str(path_save)}])
                        print("pickle overwrite succeed : ", success_pkl)

                # .medmodel metadata
                metadata_med_object = MEDDataObject(
                    id=str(uuid.uuid4()),
                    name = "metadata.json",
                    type = "json",
                    parentID = model_med_object_id,
                    childrenIDs = [],
                    inWorkspace = False
                )
                to_write = {
                    "columns": self.global_config_json["columns"],
                    "target": self.global_config_json["target_column"],
                    "steps": self.global_config_json["steps"],
                    "ml_type": self.global_config_json["MLType"]
                }
                if 'selectedTags' in self.global_config_json:
                    to_write['selectedTags'] = self.global_config_json['selectedTags']
                if 'selectedVariables' in self.global_config_json:
                    to_write['selectedVariables'] = self.global_config_json['selectedVariables']
                if model_threshold is not None:
                    to_write['model_threshold'] = model_threshold

                metadata_model_id = insert_med_data_object_if_not_exists(metadata_med_object, [to_write])
                if metadata_model_id != metadata_med_object.id:
                    # If model already existed we overwrite its content
                    success_metadata = overwrite_med_data_object_content(metadata_model_id, [to_write])
                    print("metadata overwrite succeed : ", success_metadata)
                return_val[model_name] = metadata_model_id

        elif self.type == 'load_model':
            serialized_model_id = get_child_id_by_name(settings['model_to_load']['id'], "model.pkl")
            pickle_model = get_pickled_model_from_collection(serialized_model_id)
            trained_model: Pipeline = pickle_model
            settings_copy = copy.deepcopy(settings)
            settings_copy['model_name'] = settings['model_to_load']['name'].removesuffix('.medmodel')
            del settings_copy['model_to_load']
            self.CodeHandler.add_line(
                "code",
                f"pycaret_exp.load_model({self.CodeHandler.convert_dict_to_params(settings_copy)})"
            )
            self._info_for_next_node = {'models': [trained_model], 'id': self.id}

        return return_val
