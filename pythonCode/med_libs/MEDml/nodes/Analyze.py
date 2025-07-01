import copy
import io
import json
import os
from pathlib import Path
import platform
import tempfile
import uuid
from typing import Union

import numpy as np
import pandas as pd
from colorama import Fore
from MEDDataObject import MEDDataObject
from mongodb_utils import (insert_med_data_object_if_not_exists, overwrite_med_data_object_content)
from PIL import Image

from .NodeObj import Node, format_model

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class Analyze(Node):
    """
    This class represents the Analyze node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json.
        """
        super().__init__(id_, global_config_json)

    def _execute(self,  experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        self._info_for_next_node = kwargs  # Pass all kwargs to finalze and save models
        selection = self.config_json['data']['internal']['selection']
        if selection not in ['interpret_model', 'plot_model', 'dashboard']:
            selection = 'plot_model'  # Default to plot_model if not specified
        print()
        print(Fore.BLUE + "=== Analysing === " +
              Fore.YELLOW + f"({self.username})" + Fore.RESET)
        print(Fore.CYAN + f"Using {selection}" + Fore.RESET)
        settings = copy.deepcopy(self.settings)
        plot_paths = {}
        settings.update({'save': True})
        #settings.update({"plot_kwargs": {}})
        """ if selection == 'interpret_model':
            settings.update({'save': self.global_config_json["tmp_path"]}) """

        self.CodeHandler.add_line("code", f"for model in trained_models:")
        print_settings = copy.deepcopy(settings)
        if 'save' in print_settings:
            del print_settings['save']
        self.CodeHandler.add_line(
            "code", f"pycaret_exp.{selection}(model, {self.CodeHandler.convert_dict_to_params(print_settings)})", 1)
        for model in kwargs['models']:
            model = format_model(model)
            # Convert plot settings to lowercase
            if 'plot' in settings and type(settings['plot']) == str:
                settings['plot'] = settings['plot'].lower()
            # Set saving path for plot_model
            settings['save'] = Path("/tmp") if platform.system().lower() == "darwin" else True
            plot_image = experiment['pycaret_exp'].plot_model(model, **settings)

            # Save Image into MongoDB
            image_med_object = MEDDataObject(
                id=str(uuid.uuid4()),
                name = model.__class__.__name__ + '_' + plot_image,
                type = "png",
                parentID = self.global_config_json['identifiers']['plots'],
                childrenIDs = [],
                inWorkspace = False
            )
            PIL_image = Image.open(plot_image)
            image_bytes = io.BytesIO()
            PIL_image.save(image_bytes, format='PNG')
            image_data = {
                'data': image_bytes.getvalue()
            }
            image_med_object_id = insert_med_data_object_if_not_exists(image_med_object, [image_data])
            if image_med_object_id != image_med_object.id:
                # If image already existed we overwrite its content
                overwrite_succeed = overwrite_med_data_object_content(image_med_object_id, [image_data])
                print("image overwrite succeed : ", overwrite_succeed)

            # Remove the plot image file
            if os.path.exists(plot_image):
                os.remove(plot_image)

            plot_paths[model.__class__.__name__] = image_med_object_id

        return plot_paths
