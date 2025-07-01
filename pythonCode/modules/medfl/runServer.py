from MEDfl.rw.server import FederatedServer, Strategy
import multiprocessing

import os
import json
import sys

from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

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

    def _start_server(self, json_config: dict):
        """The function that starts the Flower server."""
        go_print("Starting the Federated Learning Server with the following configuration:")
        custom_strategy = Strategy(
            name=json_config['strategy_name'],
            fraction_fit=json_config['fraction_fit'],
            min_fit_clients=json_config['min_fit_clients'],
            min_evaluate_clients=json_config['min_evaluate_clients'],
            min_available_clients=json_config['min_available_clients'],
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

