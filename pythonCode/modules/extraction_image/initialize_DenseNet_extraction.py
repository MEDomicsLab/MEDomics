import json
import os
import pandas as pd
import requests
import sys

from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecScriptInitializeDenseNetExtraction(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    
    def download_model(self, model):
        """
        Function used to download model from model name because TorchXRayVision downloading may cause errors on Windows.
        """
        if model == "densenet121-res224-all":
            url = "https://github.com/mlmed/torchxrayvision/releases/download/v1/nih-pc-chex-mimic_ch-google-openi-kaggle-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"
        elif model == "densenet121-res224-nih":
            url = "https://github.com/mlmed/torchxrayvision/releases/download/v1/nih-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"
        elif model == "densenet121-res224-pc":
            url = "https://github.com/mlmed/torchxrayvision/releases/download/v1/pc-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"
        elif model == "densenet121-res224-chex":
            url = "https://github.com/mlmed/torchxrayvision/releases/download/v1/chex-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"
        elif model == "densenet121-res224-rsna":
            url = "https://github.com/mlmed/torchxrayvision/releases/download/v1/kaggle-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"
        elif model == "densenet121-res224-mimic_nb":
            url = "https://github.com/mlmed/torchxrayvision/releases/download/v1/mimic_nb-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"
        elif model == "densenet121-res224-mimic_ch":
            url = "https://github.com/mlmed/torchxrayvision/releases/download/v1/mimic_ch-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"
        else: 
            return
        weights_filename = os.path.basename(url)
        weights_storage_folder = os.path.expanduser(os.path.join("~", ".torchxrayvision", "models_data"))
        if not os.path.exists(weights_storage_folder):
            os.makedirs(weights_storage_folder)
        weights_filename_local = os.path.expanduser(os.path.join(weights_storage_folder, weights_filename))
        with open(weights_filename_local, 'wb') as f:
            response = requests.get(url, stream=True)
            total = response.headers.get('content-length')

            if total is None:
                f.write(response.content)
            else:
                total = int(total)
                for data in response.iter_content(chunk_size=max(int(total / 1000), 1024 * 1024)):
                    f.write(data)


    def _custom_process(self, json_config: dict) -> dict:
        """
        Run intitialization of image extraction using DenseNet model.

        Returns: self.results : dict containing data relative to extraction.
        """
        go_print(json.dumps(json_config, indent=4))
        
        # Download weights for extraction
        weights = json_config["relativeToExtractionType"]["selectedWeights"]
        self.download_model(weights)

        # Create folder for extracted features if not exists
        '''data_folder_path = json_config["dataFolderPath"]
        extracted_folder_path = os.path.join(str(Path(data_folder_path)), "extracted_features")
        if not os.path.exists(extracted_folder_path):
            os.makedirs(extracted_folder_path)

        # Create csv file for data
        results_filename = json_config["filename"]
        csv_path = os.path.join(extracted_folder_path, str(Path(results_filename)))
        df = pd.DataFrame([])
        df.to_csv(csv_path, index=False)

        # Save csv result path
        json_config["csv_result_path"] = csv_path'''
        self.results = json_config

        return self.results


script = GoExecScriptInitializeDenseNetExtraction(json_params_dict, id_)
script.start()
