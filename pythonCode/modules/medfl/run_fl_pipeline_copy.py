from MEDfl.LearningManager.model import Model
from MEDfl.NetManager.node import Node
from MEDfl.NetManager.flsetup import FLsetup
from MEDfl.NetManager.network import Network
from MEDfl.NetManager.database_connector import DatabaseManager
from MEDfl.LearningManager.flpipeline import FLpipeline
from MEDfl.LearningManager.server import FlowerServer
from MEDfl.LearningManager.strategy import Strategy
from MEDfl.LearningManager.utils import *

import os
import json
import sys
from pathlib import Path
from datetime import datetime
import time

import joblib  # <-- for loading the sklearn Pipeline .pkl

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
)

from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments


json_params_dict, id_ = parse_arguments()


import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.preprocessing import StandardScaler

def fit_and_apply_global_scaler_save_normalized(
    master_path: str,
    client_paths: list[str],
    target: str,
    id_like_cols: list[str] = None,
    scaler_save_path: str = None,
    suffix: str = "_normalized",
):
    id_like_cols = id_like_cols or []

    def out_path(p: str) -> str:
        p = Path(p)
        return str(p.with_name(p.stem + suffix + p.suffix))

    # --- master ---
    master_df = pd.read_csv(master_path)

    numeric_cols = master_df.select_dtypes(include=[np.number]).columns.tolist()
    scale_cols = [c for c in numeric_cols if c != target and c not in id_like_cols]

    scaler = StandardScaler()
    scaler.fit(master_df[scale_cols])

    master_df.loc[:, scale_cols] = scaler.transform(master_df[scale_cols])
    master_norm_path = out_path(master_path)
    master_df.to_csv(master_norm_path, index=False)

    # --- clients ---
    client_norm_paths = []
    for p in client_paths:
        df = pd.read_csv(p)

        missing = [c for c in scale_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Client dataset {p} missing columns required for scaling: {missing}")

        df.loc[:, scale_cols] = scaler.transform(df[scale_cols])
        p_norm = out_path(p)
        df.to_csv(p_norm, index=False)
        client_norm_paths.append(p_norm)

    if scaler_save_path:
        joblib.dump({"scaler": scaler, "scale_cols": scale_cols, "target": target}, scaler_save_path)

    return master_norm_path, client_norm_paths, scale_cols


class SklearnMLPToTorch(nn.Module):
    """
    PyTorch MLP that mirrors a scikit-learn MLPClassifier:
    - same layer sizes
    - same activation (tanh / relu, etc.)
    - we load weights from sklearn.coefs_ and sklearn.intercepts_
    """

    def __init__(self, input_dim, hidden_layer_sizes, output_dim, activation="tanh"):
        super().__init__()

        # Ensure hidden_layer_sizes is a list
        if isinstance(hidden_layer_sizes, int):
            hidden_layer_sizes = [hidden_layer_sizes]

        # [in, h1, h2, ..., out]
        layer_sizes = [input_dim] + list(hidden_layer_sizes) + [output_dim]

        self.layers = nn.ModuleList(
            [nn.Linear(layer_sizes[i], layer_sizes[i + 1]) for i in range(len(layer_sizes) - 1)]
        )

        if activation == "tanh":
            self.activation = torch.tanh
        elif activation == "relu":
            self.activation = F.relu
        else:
            # Default fallback (you can extend if needed: 'logistic', 'identity', etc.)
            self.activation = torch.tanh

    def forward(self, x):
        for i, layer in enumerate(self.layers):
            x = layer(x)
            if i < len(self.layers) - 1:
                x = self.activation(x)
        return x


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
        # Optional: store info about pretrained models loaded from .pkl files
        self.pretrained_models_info = []

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script of the execution of the process from Go
        """

        global_results = []

        set_db_config(json_config["dbConfigfile"])

        db_manager = DatabaseManager()

        # =======================================================
        self.set_progress(label=" Creating MEDfl DB", now=2)
        # Create the master dataset
        db_manager.create_MEDfl_db(
            path_to_csv=json_config["flConfig"][0]["masterDatasetNode"]["path"]
        )

        master_path = json_config["flConfig"][0]["masterDatasetNode"]["path"]
        client_paths = [c["dataset"]["path"] for c in json_config["flConfig"][0]["Network"]["clients"]]
        target = json_config["flConfig"][0]["masterDatasetNode"]["target"]

        master_norm, client_norms, scale_cols = fit_and_apply_global_scaler_save_normalized(
            master_path=master_path,
            client_paths=client_paths,
            target=target,
            scaler_save_path="global_scaler.joblib",
        )

        # ✅ Replace paths in config so MEDfl uses normalized CSVs everywhere
        json_config["flConfig"][0]["masterDatasetNode"]["path"] = master_norm

        for i, c in enumerate(json_config["flConfig"][0]["Network"]["clients"]):
            c["dataset"]["path"] = client_norms[i]


        for index, config in enumerate(json_config["flConfig"]):

            print(config)

            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating the Network", now=5
            )
            # Create Network
            microseconds = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f").split(".")[1]
            Net_1 = Network(f"{config['Network']['name']}_{microseconds}")
            Net_1.create_network()

            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating the MasterDataset", now=10
            )
            # Creating the masterdataset
            Net_1.create_master_dataset(config["masterDatasetNode"]["path"])

            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating the FL setup", now=20
            )
            # auto FLsetup creation
            microseconds = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f").split(".")[1]
            autoFl = FLsetup(
                name=f"_{microseconds}", description="experiment", network=Net_1
            )
            autoFl.create()

            # Create nodes
            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating the FL clients", now=25
            )

            for client in config["Network"]["clients"]:

                microseconds = datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S.%f"
                ).split(".")[1]

                hospital = Node(
                    name=f"{client['name']}_{microseconds}",
                    train=1 if client["type"] == "Train node" else 0,
                )
                Net_1.add_node(hospital)
                hospital.upload_dataset("datasetName", client["dataset"]["path"])

            # Create FLDataSet
            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating the Federated dataset",
                now=35,
            )

            fl_dataset = autoFl.create_federated_dataset(
                output=config["masterDatasetNode"]["target"],
                fit_encode=[],
                to_drop=[config["masterDatasetNode"]["target"] ],
            )

            # Create the model
            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating The model", now=40
            )

            if config["flModelNode"]["activateTl"] == "true":
                # ====================================================
                # Use the sklearn Pipeline .pkl
                # ====================================================
                pkl_path = config["flModelNode"]["file"]["path"]

                # 1) Load sklearn pipeline
                pipeline = joblib.load(pkl_path)

                # 2) Get the MLPClassifier from the pipeline
                # 2) Get the MLPClassifier from the pipeline
                # Try 'trained_model' first, fall back to 'actual_estimator'
                if "trained_model" in pipeline.named_steps:
                    skl_model = pipeline.named_steps["trained_model"]
                elif "actual_estimator" in pipeline.named_steps:
                    skl_model = pipeline.named_steps["actual_estimator"]
                else:
                    raise ValueError("Pipeline must contain either 'trained_model' or 'actual_estimator' step")
                

                # 3) Extract hyperparameters and coefficients
                skl_params = skl_model.get_params()
                coefs = skl_model.coefs_  # list of np arrays (n_in, n_out)
                intercepts = skl_model.intercepts_  # list of np arrays (n_out,)

                input_dim = coefs[0].shape[0]
                hidden_layer_sizes = skl_params["hidden_layer_sizes"]
                output_dim = coefs[-1].shape[1]
                activation = skl_params.get("activation", "tanh")

                # (Optional) store architecture/params info
                model_architecture = {
                    "input_dim": int(input_dim),
                    "hidden_layers": list(
                        hidden_layer_sizes
                        if isinstance(hidden_layer_sizes, (list, tuple))
                        else [hidden_layer_sizes]
                    ),
                    "output_dim": int(output_dim),
                    "activation": activation,
                    "sklearn_hyperparameters": skl_params,
                }

                # 4) Build equivalent PyTorch model
                model = SklearnMLPToTorch(
                    input_dim=input_dim,
                    hidden_layer_sizes=hidden_layer_sizes,
                    output_dim=output_dim,
                    activation=activation,
                )

                # 5) Load weights from sklearn into PyTorch
                with torch.no_grad():
                    for i, layer in enumerate(model.layers):
                        w = coefs[i]  # (n_in, n_out)
                        b = intercepts[i]  # (n_out,)
                        # PyTorch: (out_features, in_features)
                        layer.weight.data = torch.tensor(
                            w.T, dtype=layer.weight.data.dtype
                        )
                        layer.bias.data = torch.tensor(
                            b, dtype=layer.bias.data.dtype
                        )

                # Keep info for later (results / logs / UI)
                self.pretrained_models_info.append(
                    {
                        "config_index": index,
                        "pkl_path": pkl_path,
                        "architecture": model_architecture,
                        # If you ever want raw weights in JSON, uncomment:
                        # "weights": [w.tolist() for w in coefs],
                        # "biases": [b.tolist() for b in intercepts],
                    }
                )

            else:
                # ====================================================
                # Original dynamic BinaryClassifier (no TL / no pkl)
                # ====================================================
                class BinaryClassifier(nn.Module):
                    def __init__(self, input_size, num_layers, layer_size):
                        super(BinaryClassifier, self).__init__()

                        # Input layer
                        self.layers = [nn.Linear(input_size, layer_size)]

                        # Hidden layers
                        for _ in range(num_layers - 1):
                            self.layers.append(nn.Linear(layer_size, layer_size))

                        # Output layer
                        self.layers.append(nn.Linear(layer_size, 1))

                        # ModuleList to handle dynamic number of layers
                        self.layers = nn.ModuleList(self.layers)

                    def forward(self, x):
                        for layer in self.layers[:-1]:
                            x = F.relu(layer(x))
                        x = self.layers[-1](x)
                        return x

                # Create the model with the suggested hyperparameters
                model = BinaryClassifier(
                    input_size=fl_dataset.size,
                    num_layers=config["flModelNode"]["Number of layers"],
                    layer_size=config["flModelNode"]["Hidden size"],
                )

            # Optimizer
            if config["flModelNode"]["optimizer"] == "Adam":
                optimizer = optim.Adam(
                    model.parameters(), lr=config["flModelNode"]["learning rate"]
                )
            elif config["flModelNode"]["optimizer"] == "SGD":
                optimizer = optim.SGD(
                    model.parameters(), lr=config["flModelNode"]["learning rate"]
                )
            elif config["flModelNode"]["optimizer"] == "RMSprop":
                optimizer = optim.RMSprop(
                    model.parameters(), lr=config["flModelNode"]["learning rate"]
                )
            else:
                # Fallback (Adam) if something unexpected comes
                optimizer = optim.Adam(
                    model.parameters(), lr=config["flModelNode"]["learning rate"]
                )

            pos_weight = torch.tensor([4.0])

            criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

            # Creating a new Model instance using the specific model
            global_model = Model(model, optimizer, criterion)

            # Get the initial params of the model
            init_params = global_model.get_parameters()

            # Create the strategy
            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating The Server strategy",
                now=45,
            )

            aggreg_algo = Strategy(
                config["flStrategyNode"]["Aggregation algorithm"],
                fraction_fit=config["flStrategyNode"]["Training fraction"],
                fraction_evaluate=config["flStrategyNode"]["Evaluation fraction"],
                min_fit_clients=config["flStrategyNode"][
                    "Minimal used clients for training"
                ],
                min_evaluate_clients=config["flStrategyNode"][
                    "Minimal used clients for evaluation"
                ],
                min_available_clients=config["flStrategyNode"][
                    "Minimal available clients"
                ],
                initial_parameters=init_params,
            )
            aggreg_algo.create_strategy()

            # Create The server
            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating The Server", now=55
            )

            client_resources = None
            if (
                config["flStrategyNode"]["clientRessources"] == "Use GPU"
                and torch.cuda.is_available()
            ):
                client_resources = {"num_gpus": 1}

            server = FlowerServer(
                global_model,
                strategy=aggreg_algo,
                num_rounds=config["Network"]["server"]["nRounds"],
                num_clients=len(fl_dataset.trainloaders),
                fed_dataset=fl_dataset,
                diff_privacy=True
                if config["Network"]["server"]["activateDP"] == "Activate"
                else False,
                # You can change the resources allocated for each client based on your machine
                client_resources=client_resources,
            )

            # Create the pipeline
            self.set_progress(
                label=f"Configuration : {index + 1 }, Creating The pipeline", now=65
            )

            microseconds = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f").split(".")[1]

            ppl_1 = FLpipeline(
                name=f"pipeline_{microseconds}",
                description="",
                server=server,
            )

            # Run the Training of the model
            self.set_progress(
                label=f"Configuration : {index + 1 }, Running the FL pipeline", now=75
            )
            history = ppl_1.server.run()

            # Test the model
            self.set_progress(
                label=f"Configuration : {index + 1 }, Testing the model", now=95
            )
            report = ppl_1.auto_test()

            # Debugging: Print the classification reports before parsing
            for report_item in report:
                print(
                    f"Raw classification_report: {report_item['classification_report']}"
                )
                try:
                    report_item["classification_report"] = json.loads(
                        report_item["classification_report"].replace("'", '"')
                    )
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON: {e}")
                    report_item["classification_report"] = {}  # fallback

            results = {
                "results": server.auc,
                "test_results": report,
            }

            global_results.append(results)

            print(results)
            # =========================================

        for result in global_results:
            if not isinstance(result, dict):
                raise ValueError("All entries in global_results must be dictionaries")

        print(
            f"this is the global results =========================================> \n {global_results}"
        )
        self.set_progress(label="The results are ready !", now=99)
        time.sleep(1)

        self.results = {
            "stats": {"results": len(global_results)},
            "data": global_results,
            "stringFromBackend": "Pipeline training completed!",
            # expose information about any pretrained models loaded from .pkl
            "pretrained_models_info": self.pretrained_models_info,
        }

        return self.results


fl_pipeline = GoExecScriptRunPipelineFromMEDfl(json_params_dict, id_)
fl_pipeline.start()
