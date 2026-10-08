from turtle import pd

from MEDfl.rw.server import FederatedServer, Strategy
from MEDfl.LearningManager.model import Model
from MEDfl.rw.model import Net
import multiprocessing

import os
import json
import sys

from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
)

from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

go_print("Starting the Federated Learning Server...")
from datetime import datetime
import time

from MEDfl.LearningManager.shap import (
    SHAPConfig,
)


json_params_dict, id_ = parse_arguments()


class GoExecScriptRunPipelineFromMEDfl(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The json params of the execution
            _id: The id of the execution
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self.server_process = None

    def _load_initial_weights(self, model_path: str , json_config: dict):
        """
        Load pretrained model weights and return as a list of numpy arrays.
        """
        from flwr.common import ndarrays_to_parameters

        import torch

        go_print(f"Loading pretrained model from: {model_path}")
        # Only plain state_dicts are accepted (weights_only also refuses arbitrary pickled objects)
        try:
            state_dict = torch.load(model_path, map_location=torch.device('cpu'), weights_only=True)
        except Exception as e:
            raise ValueError(
                f"Could not load '{model_path}' as a state_dict. Save the pretrained model with "
                f"torch.save(model.state_dict(), path), not torch.save(model, path). Details: {e}")
        if not isinstance(state_dict, dict):
            raise ValueError(
                f"'{model_path}' does not contain a state_dict (got {type(state_dict).__name__}). "
                f"Save it with torch.save(model.state_dict(), path).")

        features_str = json_config['features']

        features_list = [f.strip() for f in features_str.split(",")]

        num_features = len(features_list)

        # Check the input size before training starts
        first_layer = state_dict.get('blocks.0.lin.weight')
        if first_layer is not None and first_layer.shape[1] != num_features:
            raise ValueError(
                f"The pretrained model expects {first_layer.shape[1]} input features, "
                f"but {num_features} features are selected.")

        # The clients always build MEDfl's default Net(num_features), so the pretrained model must match it
        model = Net(num_features)
        try:
            model.load_state_dict(state_dict, strict=True)
        except RuntimeError as e:
            raise ValueError(
                "The pretrained model does not match the real-world network architecture "
                f"(MEDfl Net with default hidden layers). Details: {e}")
        model.eval()

        state_dict = model.state_dict()
        weights = [val.cpu().numpy() for val in state_dict.values()]  # Include buffers
        return weights
    
    def _start_server(self, json_config: dict):
        go_print(str(json_config))
        """The function that starts the Flower server."""
        go_print("Starting the Federated Learning Server with the following configuration:")

        initial_weights = None

        if json_config.get("use_transfer_learning", False):
            go_print("Transfer learning enabled. Loading pretrained weights…")

            model_path = json_config.get("pretrained_model_path")
            if not model_path:
                raise ValueError("use_transfer_learning is true but no pretrained_model_path provided.")
            initial_weights = self._load_initial_weights(model_path , json_config)

        else:
            go_print("Transfer learning not enabled. Starting with random weights.")

        shap_config = None
         
        if json_config.get("flShapNode"):
            

            shap_config = SHAPConfig(
                enabled=True,

                # Required for XGBoost.
                explainer="gradient",

                # train, validation, or test
                data_split=json_config["flShapNode"].get("dataSplit", "validation"),

                # Used as TreeExplainer background data.
                background_size=json_config["flShapNode"].get("backgroundSize", 100),

                # Maximum samples explained per client.
                explanation_size=json_config["flShapNode"].get("explanationSize", 50),

                random_seed=json_config["flShapNode"].get("random_seed", 42),

                minimum_samples=json_config["flShapNode"].get("minimumSamples", 10),

                clipping_value=None,

                include_client_results=json_config["flShapNode"].get("includeClientResults", True),

            )

        custom_strategy = Strategy(
            name=json_config['strategy_name'],
            fraction_fit=json_config['fraction_fit'],
            min_fit_clients=json_config['min_fit_clients'],
            min_evaluate_clients=json_config['min_evaluate_clients'],
            min_available_clients=json_config['min_available_clients'],
            initial_parameters=initial_weights , 
            local_epochs=json_config['local_epochs'],
            learning_rate=json_config['learning_rate'],
            optimizer_name=json_config['optimizer'],
            threshold=json_config['threshold'],
            savingPath=None,
            saveOnRounds=json_config['saveOnRounds'],
            total_rounds=json_config['num_rounds'],
            
            features=json_config['features'],
            target=json_config['target'],
            val_fraction=json_config['val_fraction'],
            test_fraction=json_config['test_fraction'],
            split_mode=json_config['split_mode'],
            id_col=json_config['id_col'],
            client_fractions=json_config['client_fractions'],
           
        )

        server = FederatedServer(
            host="0.0.0.0",
            port=json_config['port'],
            num_rounds=json_config['num_rounds'],
            strategy=custom_strategy,
            shap_config=shap_config
        )
        self.server = server
        server.start()

    def _custom_process(self, json_config: dict) -> dict:
        """Start the server as a subprocess and return its PID."""
        go_print("Starting server in the same Python process...")
        self._start_server(json_config)
        self.results = {"status": "server_stopped" , "shap_results": self.server.federated_shap_result}
        return self.results


go_print("Parsing the arguments and starting the Federated Learning Server...")
fl_pipeline = GoExecScriptRunPipelineFromMEDfl(json_params_dict, id_)
fl_pipeline.start()