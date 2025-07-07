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

    def _load_initial_weights(self, model_path: str):
        """
        Load pretrained model weights and return as a list of numpy arrays.
        """
        from flwr.common import ndarrays_to_parameters

        go_print(f"Loading pretrained model from: {model_path}")
        loaded_model = Model.load_model(model_path)
        model = Net(7)
        model.load_state_dict(loaded_model)
        model.eval()

        state_dict = model.state_dict()
        weights = [val.cpu().numpy() for val in state_dict.values()]  # Include buffers
        return weights

    def _start_server(self, json_config: dict):
        """The function that starts the Flower server."""
        go_print("Starting the Federated Learning Server with the following configuration:")

        initial_weights = None

        if json_config.get("use_transfer_learning", False):
            go_print("Transfer learning enabled. Loading pretrained weights…")

            model_path = json_config.get("pretrained_model_path")
            if not model_path:
                raise ValueError("use_transfer_learning is true but no pretrained_model_path provided.")
            initial_weights = self._load_initial_weights(model_path)

        else:
            go_print("Transfer learning not enabled. Starting with random weights.")

        custom_strategy = Strategy(
            name=json_config['strategy_name'],
            fraction_fit=json_config['fraction_fit'],
            min_fit_clients=json_config['min_fit_clients'],
            min_evaluate_clients=json_config['min_evaluate_clients'],
            min_available_clients=json_config['min_available_clients'],
            initial_parameters=initial_weights
        )

        server = FederatedServer(
            host="0.0.0.0",
            port=json_config['port'],
            num_rounds=json_config['num_rounds'],
            strategy=custom_strategy,
        )
        server.start()

    def _custom_process(self, json_config: dict) -> dict:
        """Start the server as a subprocess and return its PID."""
        self.server_process = multiprocessing.Process(target=self._start_server, args=(json_config,))
        self.server_process.start()

        go_print(f"Server started with PID {self.server_process.pid}")
        self.results = {"pid": self.server_process.pid}
        return self.results


go_print("Parsing the arguments and starting the Federated Learning Server...")
fl_pipeline = GoExecScriptRunPipelineFromMEDfl(json_params_dict, id_)
fl_pipeline.start()