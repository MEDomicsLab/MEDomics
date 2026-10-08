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

import torch
import torch.nn.functional as F


sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))


from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

import time

import torch.optim as optim
import torch.nn as nn



import numpy as np
import pandas as pd
import xgboost as xgb

from MEDfl.LearningManager.utils import set_db_config
from MEDfl.NetManager.database_connector import DatabaseManager
from MEDfl.NetManager.network import Network
from MEDfl.NetManager.node import Node
from MEDfl.NetManager.flsetup import FLsetup

from MEDfl.LearningManager.xgboost import (
    XGBoostSimulationServer,
    XGBoostSimulationStrategy,
)

from MEDfl.LearningManager.xgboost.data import (
    SimulationXGBoostDataModule,
    dataloader_to_dmatrix,
)

from MEDfl.LearningManager.xgboost.metrics import (
    evaluate_predictions,
)

from MEDfl.LearningManager.shap import (
    SHAPConfig,
)



#  MEDfl imports
# LearningManager Imports

# Network Manager Imports


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

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script of the execution of the process from Go
        """

        global_results = []

        set_db_config(json_config['dbConfigfile'])

        db_manager = DatabaseManager()

        # =======================================================
        self.set_progress(label=f" Creating MEDfl DB", now=2)
        # Create the master dataset
        db_manager.create_MEDfl_db(
            path_to_csv=json_config['flConfig'][0]['masterDatasetNode']['path'])

        

        for index , config in enumerate(json_config['flConfig']) :

            print(config)

            self.set_progress(label=f"Configuration : {index +1 }, Creating the Network", now=5)
            # Create Network
            microseconds = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f").split('.')[1]
            Net_1 = Network( f"{config['Network']['name']}_{microseconds}")
            Net_1.create_network()

            self.set_progress(label=f"Configuration : {index +1 }, Creating the MasterDataset", now=10)
            # Creating the masterdataset
            Net_1.create_master_dataset(
                config['masterDatasetNode']['path'])

            self.set_progress(label=f"Configuration : {index +1 }, Creating the FL setup", now=20)
            # auto FLsetup creation
            microseconds = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f").split('.')[1]
            autoFl = FLsetup( name= f"_{microseconds}" ,
                            description="experiment", network=Net_1)
            autoFl.create()

            # Create nodes
            self.set_progress(label=f"Configuration : {index +1 }, Creating the FL clients", now=25)

            for client in config['Network']['clients']:

                microseconds = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f").split('.')[1]
                
                hospital = Node(
                    name= f"{client['name']}_{microseconds}" , train=1 if client['type'] == 'Train node' else 0)
                Net_1.add_node(hospital)
                hospital.upload_dataset("datasetName",  client["dataset"]['path'])

            # Create FLDataSet
            self.set_progress(label=f"Configuration : {index +1 }, Creating the Federated dataset", now=35)

            fl_dataset = autoFl.create_federated_dataset(
                output=config['masterDatasetNode']['target'],
                fit_encode=[],
                to_drop=[config['masterDatasetNode']['target']]
            )

            # Create the model
            self.set_progress(label=f"Configuration : {index +1 }, Creating The model", now=40)

            if str(config["flModelNode"].get("modelType", "nn")).lower() == "xgboost":

                self.set_progress(
                    label=f"Configuration : {index + 1}, Preparing XGBoost simulation",
                    now=40,
                )

                # ---------------------------------------------------------
                # 1. Resolve task and training configuration
                # ---------------------------------------------------------
                xgb_model_config = config["flModelNode"]
                strategy_config = config["flStrategyNode"]
                server_config = config["Network"]["server"]

                task = str(
                    xgb_model_config.get(
                        "task",
                        "binary",
                    )
                ).lower()

                if task not in {"binary", "regression", "multiclass"}:
                    raise ValueError(
                        f"Unsupported XGBoost task '{task}'. "
                        "Expected binary, regression, or multiclass."
                    )

                num_rounds = int(
                    server_config["nRounds"]
                )

                local_num_boost_round = int(
                    xgb_model_config.get(
                        "local_num_boost_round",
                        xgb_model_config.get(
                            "localNumBoostRound",
                            2,
                        ),
                    )
                )

                threshold = float(
                    xgb_model_config.get(
                        "threshold",
                        0.5,
                    )
                )

                # ---------------------------------------------------------
                # 2. Read feature names from the actual CSV
                # ---------------------------------------------------------
                master_dataset_path = config[
                    "masterDatasetNode"
                ]["path"]

                target_name = config[
                    "masterDatasetNode"
                ]["target"]

                master_df = pd.read_csv(
                    master_dataset_path
                )

                if target_name not in master_df.columns:
                    raise ValueError(
                        f"Target '{target_name}' was not found in "
                        f"{master_dataset_path}. "
                        f"Available columns: {master_df.columns.tolist()}"
                    )

                # Keep this synchronized with create_federated_dataset(to_drop=...)
                columns_to_drop = []

                feature_names = [
                    column
                    for column in master_df.columns
                    if column != target_name
                    and column not in columns_to_drop
                ]

                # The existing MEDfl preprocessing may remove database columns
                # or otherwise alter the final feature matrix.
                if len(feature_names) != fl_dataset.size:
                    print(
                        "[XGBoost simulation] Feature-name count mismatch:",
                        {
                            "csv_feature_names": feature_names,
                            "csv_feature_count": len(feature_names),
                            "federated_dataset_size": fl_dataset.size,
                        },
                        flush=True,
                    )

                    # Safe fallback. Training will still work, but importance
                    # will use f0, f1, ... instead of original column names.
                    feature_names = [
                        f"f{i}"
                        for i in range(fl_dataset.size)
                    ]

                print(
                    "[XGBoost simulation] Feature names:",
                    feature_names,
                    flush=True,
                )

                # ---------------------------------------------------------
                # 3. Build native XGBoost parameters
                # ---------------------------------------------------------
                default_objective = {
                    "binary": "binary:logistic",
                    "regression": "reg:squarederror",
                    "multiclass": "multi:softprob",
                }[task]

                default_eval_metric = {
                    "binary": "auc",
                    "regression": "rmse",
                    "multiclass": "mlogloss",
                }[task]

                xgb_params = {
                    "objective": xgb_model_config.get(
                        "objective",
                        default_objective,
                    ),
                    "eval_metric": xgb_model_config.get(
                        "eval_metric",
                        default_eval_metric,
                    ),
                    "tree_method": xgb_model_config.get(
                        "tree_method",
                        "hist",
                    ),
                    "max_depth": int(
                        xgb_model_config.get(
                            "max_depth",
                            3,
                        )
                    ),
                    "eta": float(
                        xgb_model_config.get(
                            "eta",
                            0.1,
                        )
                    ),
                    "subsample": float(
                        xgb_model_config.get(
                            "subsample",
                            1.0,
                        )
                    ),
                    "colsample_bytree": float(
                        xgb_model_config.get(
                            "colsample_bytree",
                            1.0,
                        )
                    ),
                    "seed": int(
                        xgb_model_config.get(
                            "seed",
                            42,
                        )
                    ),
                    # Ray already parallelizes clients.
                    # Avoid each XGBoost process using every CPU core.
                    "nthread": int(
                        xgb_model_config.get(
                            "nthread",
                            1,
                        )
                    ),
                }

                num_classes = None

                if task == "multiclass":
                    num_classes = int(
                        xgb_model_config.get(
                            "num_classes",
                            master_df[target_name].nunique(),
                        )
                    )

                    if num_classes < 2:
                        raise ValueError(
                            "Multiclass XGBoost requires at least two classes."
                        )

                    xgb_params["num_class"] = num_classes

                print(
                    "[XGBoost simulation] Parameters:",
                    xgb_params,
                    flush=True,
                )

                # ---------------------------------------------------------
                # 4. Validate that two or more training clients exist
                # ---------------------------------------------------------
                num_clients = len(
                    fl_dataset.trainloaders
                )

                if num_clients == 0:
                    raise ValueError(
                        "No training clients were created in the federated dataset."
                    )

                min_fit_clients = int(
                    strategy_config[
                        "Minimal used clients for training"
                    ]
                )

                min_evaluate_clients = int(
                    strategy_config[
                        "Minimal used clients for evaluation"
                    ]
                )

                min_available_clients = int(
                    strategy_config[
                        "Minimal available clients"
                    ]
                )

                if min_available_clients > num_clients:
                    raise ValueError(
                        "Minimal available clients is greater than the "
                        f"number of simulation clients: "
                        f"{min_available_clients} > {num_clients}"
                    )

                if min_fit_clients > num_clients:
                    raise ValueError(
                        "Minimal training clients is greater than the "
                        f"number of simulation clients: "
                        f"{min_fit_clients} > {num_clients}"
                    )

                if min_evaluate_clients > num_clients:
                    raise ValueError(
                        "Minimal evaluation clients is greater than the "
                        f"number of simulation clients: "
                        f"{min_evaluate_clients} > {num_clients}"
                    )

                # ---------------------------------------------------------
                # 5. Optional preflight DMatrix test
                # ---------------------------------------------------------
                self.set_progress(
                    label=f"Configuration : {index + 1}, Validating XGBoost data",
                    now=43,
                )

                client_0_data = SimulationXGBoostDataModule(
                    trainloader=fl_dataset.trainloaders[0],
                    valloader=fl_dataset.valloaders[0],
                    testloader=fl_dataset.testloaders[0],
                    feature_names=feature_names,
                )

                print(
                    "[XGBoost simulation] Client 0 metadata:",
                    client_0_data.metadata,
                    flush=True,
                )

                # ---------------------------------------------------------
                # 6. Create XGBoost strategy
                # ---------------------------------------------------------
                self.set_progress(
                    label=f"Configuration : {index + 1}, Creating XGBoost strategy",
                    now=45,
                )

                output_path = server_config.get(
                    "savingPath",
                    "./outputs/xgboost_simulation",
                )

                os.makedirs(
                    output_path,
                    exist_ok=True,
                )

                xgb_strategy = XGBoostSimulationStrategy(
                    mode="bagging",
                    fraction_fit=float(
                        strategy_config[
                            "Training fraction"
                        ]
                    ),
                    fraction_evaluate=float(
                        strategy_config[
                            "Evaluation fraction"
                        ]
                    ),
                    min_fit_clients=min_fit_clients,
                    min_evaluate_clients=min_evaluate_clients,
                    min_available_clients=min_available_clients,
                    task=task,
                    num_classes=num_classes,
                    xgb_params=xgb_params,
                    local_num_boost_round=local_num_boost_round,
                    threshold=threshold,

                    # Match the constructor that currently exists in your strategy.
                    savingPath=output_path,
                    save_on_rounds=int(
                        server_config.get(
                            "saveOnRounds",
                            1,
                        )
                    ),
                    total_rounds=num_rounds,
                )

                xgb_strategy.create_strategy()

                print(
                    "[XGBoost simulation] Strategy created:",
                    type(xgb_strategy.strategy_object),
                    flush=True,
                )

                # ---------------------------------------------------------
                # 7. Resolve client resources
                # ---------------------------------------------------------
                client_resources = {
                    "num_cpus": 1.0,
                    "num_gpus": 0.0,
                }

                # Keep CPU mode initially.
                # Allocating a Ray GPU alone does not configure XGBoost GPU use.
                if (
                    strategy_config.get("clientRessources") == "Use GPU"
                    and torch.cuda.is_available()
                ):
                    print(
                        "[XGBoost simulation] GPU was requested, but the "
                        "first simulation integration will use CPU. "
                        "XGBoost device configuration must be added separately.",
                        flush=True,
                    )

                # ---------------------------------------------------------
                # 8. Create XGBoost simulation server
                # ---------------------------------------------------------
                self.set_progress(
                    label=f"Configuration : {index + 1}, Creating XGBoost server",
                    now=55,
                )

                xgb_server = XGBoostSimulationServer(
                    strategy=xgb_strategy,
                    num_rounds=num_rounds,
                    fed_dataset=fl_dataset,
                    task=task,
                    xgb_params=xgb_strategy.xgb_params,
                    local_num_boost_round=local_num_boost_round,
                    threshold=threshold,
                    feature_names=feature_names,
                    client_resources=client_resources,
                )

                print(
                    "[XGBoost simulation] Server created.",
                    flush=True,
                )
                print(
                    "[XGBoost simulation] Number of clients:",
                    xgb_server.num_clients,
                    flush=True,
                )

                # ---------------------------------------------------------
                # 9. Run simulation
                # ---------------------------------------------------------
                self.set_progress(
                    label=f"Configuration : {index + 1}, Running XGBoost simulation",
                    now=75,
                )

                history = xgb_server.run()

                # ---------------------------------------------------------
                # 10. Validate final global model
                # ---------------------------------------------------------
                global_booster = xgb_strategy.current_booster

                if global_booster is None:
                    raise RuntimeError(
                        "XGBoost simulation completed without producing "
                        "a global booster."
                    )

                final_num_trees = int(
                    xgb_strategy.current_num_trees
                )

                print(
                    "[XGBoost simulation] Final tree count:",
                    final_num_trees,
                    flush=True,
                )

                # ---------------------------------------------------------
                # 11. Test global model on each client test loader
                # ---------------------------------------------------------
                self.set_progress(
                    label=f"Configuration : {index + 1}, Testing XGBoost model",
                    now=95,
                )

                test_results = []

                # Only test the partitions associated with training clients.
                for client_index in range(num_clients):
                    if client_index >= len(
                        fl_dataset.testloaders
                    ):
                        continue

                    testloader = fl_dataset.testloaders[
                        client_index
                    ]

                    if testloader is None:
                        continue

                    try:
                        if len(testloader.dataset) == 0:
                            continue
                    except Exception:
                        pass

                    dtest = dataloader_to_dmatrix(
                        testloader,
                        feature_names=feature_names,
                    )

                    if dtest is None:
                        continue

                    predictions = global_booster.predict(
                        dtest
                    )

                    metrics = evaluate_predictions(
                        task=task,
                        y_true=dtest.get_label(),
                        y_pred_or_prob=predictions,
                        threshold=threshold,
                        num_features=int(
                            dtest.num_col()
                        ),
                    )

                    test_results.append(
                        {
                            "client_id": str(
                                client_index
                            ),
                            "num_examples": int(
                                dtest.num_row()
                            ),
                            "metrics": metrics,
                        }
                    )

                # ---------------------------------------------------------
                # 12. Feature importance
                # ---------------------------------------------------------
                feature_importance = {
                    "gain": {
                        feature: float(value)
                        for feature, value in global_booster.get_score(
                            importance_type="gain"
                        ).items()
                    },
                    "weight": {
                        feature: float(value)
                        for feature, value in global_booster.get_score(
                            importance_type="weight"
                        ).items()
                    },
                    "cover": {
                        feature: float(value)
                        for feature, value in global_booster.get_score(
                            importance_type="cover"
                        ).items()
                    },
                }

                # Add unused features with importance 0.
                for importance_type in (
                    "gain",
                    "weight",
                    "cover",
                ):
                    for feature in feature_names:
                        feature_importance[
                            importance_type
                        ].setdefault(
                            feature,
                            0.0,
                        )

                # ---------------------------------------------------------
                # 13. Create frontend-compatible result
                # ---------------------------------------------------------
                results = {
                    "model_type": "xgboost",
                    "backend": "xgboost",
                    "task": task,
                    "num_clients": num_clients,
                    "num_rounds": num_rounds,
                    "local_num_boost_round": (
                        local_num_boost_round
                    ),
                    "final_num_trees": final_num_trees,
                    "training_results": (
                        xgb_strategy.round_history
                    ),
                    "test_results": test_results,
                    "feature_importance": (
                        feature_importance
                    ),
                    "losses_distributed": getattr(
                        history,
                        "losses_distributed",
                        [],
                    ),
                    "metrics_distributed": getattr(
                        history,
                        "metrics_distributed",
                        {},
                    ),
                    "metrics_distributed_fit": getattr(
                        history,
                        "metrics_distributed_fit",
                        {},
                    ),
                }

                global_results.append(results)

                print(
                    "[XGBoost simulation] Results:",
                    results,
                    flush=True,
                )
                

            else :
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

                def read_number(name, cast):
                    value = config['flModelNode'].get(name)
                    try:
                        value = cast(value)
                    except (TypeError, ValueError):
                        raise ValueError(f"Model node: '{name}' must be set to a valid number (got {value!r}).")
                    if value <= 0:
                        raise ValueError(f"Model node: '{name}' must be greater than 0 (got {value}).")
                    return value

                # The architecture is always rebuilt from the node settings, with or without transfer learning
                model = BinaryClassifier(input_size=fl_dataset.size,
                                        num_layers=read_number('Number of layers', int),
                                        layer_size=read_number('Hidden size', int),)

                if config['flModelNode']['activateTl'] == "true":
                    model_path = (config['flModelNode'].get('file') or {}).get('path')
                    if not model_path:
                        raise ValueError("Transfer learning is activated but no pretrained model file was provided.")

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

                    # Check the input size before training starts
                    first_layer = state_dict.get('layers.0.weight')
                    if first_layer is not None and first_layer.shape[1] != fl_dataset.size:
                        raise ValueError(
                            f"The pretrained model expects {first_layer.shape[1]} input features, "
                            f"but the federated dataset has {fl_dataset.size}.")

                    try:
                        model.load_state_dict(state_dict, strict=True)
                    except RuntimeError as e:
                        raise ValueError(
                            "The pretrained model does not match the architecture set in the Model node "
                            f"('Number of layers' / 'Hidden size'). Details: {e}")

                optimizers = {'adam': optim.Adam, 'sgd': optim.SGD, 'rmsprop': optim.RMSprop}
                optimizer_name = str(config['flModelNode'].get('optimizer') or '').lower()
                if optimizer_name not in optimizers:
                    raise ValueError(
                        f"Model node: unsupported optimizer {config['flModelNode'].get('optimizer')!r}. "
                        f"Choose one of Adam, SGD, RMSprop.")
                optimizer = optimizers[optimizer_name](model.parameters(), lr=read_number('learning rate', float))
                
                pos_weight = torch.tensor([4])


                criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)


                # Creating a new Model instance using the specific model created by DynamicModel
                global_model = Model(model, optimizer, criterion)

                # Get the initial params of the model
                init_params = global_model.get_parameters()

                # Create the strategy
                self.set_progress(label=f"Configuration : {index +1 }, Creating The Server strategy", now=45)

                aggreg_algo = Strategy(config['flStrategyNode']['Aggregation algorithm'],
                                    fraction_fit=config['flStrategyNode']['Training fraction'],
                                    fraction_evaluate=config['flStrategyNode']['Evaluation fraction'],
                                    min_fit_clients=config['flStrategyNode']['Minimal used clients for training'],
                                    min_evaluate_clients=config[
                                        'flStrategyNode']['Minimal used clients for evaluation'],
                                    min_available_clients=config[
                                        'flStrategyNode']['Minimal available clients'],
                                    initial_parameters=init_params)
                aggreg_algo.create_strategy()

                # Create The server
                self.set_progress(label=f"Configuration : {index +1 }, Creating The Server", now=55)

            

                client_resources = None
                if config['flStrategyNode']['clientRessources'] == "Use GPU" and torch.cuda.is_available():
                    client_resources = {"num_gpus": 1}

                shap_config = None

                if config["flShapNode"]:
                    master_dataset_path = config[
                                        "masterDatasetNode"
                                    ]["path"]
                    
                    target_name = config[
                        "masterDatasetNode"
                    ]["target"]
    
                    master_df = pd.read_csv(
                        master_dataset_path
                    )
    
                    if target_name not in master_df.columns:
                        raise ValueError(
                            f"Target '{target_name}' was not found in "
                            f"{master_dataset_path}. "
                            f"Available columns: {master_df.columns.tolist()}"
                        )
    
                    # Keep this synchronized with create_federated_dataset(to_drop=...)
                    columns_to_drop = []
    
                    feature_names = [
                        column
                        for column in master_df.columns
                        if column != target_name
                        and column not in columns_to_drop
                    ]
                    shap_config = SHAPConfig(
                        enabled=config["flShapNode"]["enabled"],

                        # Recommended for PyTorch tabular networks.
                        explainer=config["flShapNode"].get("explainer", "gradient"),

                        # Explain each client's validation partition.
                        data_split=config["flShapNode"].get("dataSplit", "validation"),

                        # Background data used by SHAP.
                        background_size=config["flShapNode"].get("backgroundSize", 100),

                        # Maximum explained samples per client.
                        explanation_size=config["flShapNode"].get("explanationSize", 50),

                        random_seed=config["flShapNode"].get("random_seed", 42),

                        feature_names=feature_names,

                        minimum_samples=config["flShapNode"].get("minimumSamples", 10),

                        # Keep None initially.
                        clipping_value=None,

                        include_client_results=config["flShapNode"].get("includeClientResults", True)
                    )

                            
                server = FlowerServer(global_model,
                                    strategy=aggreg_algo,
                                    num_rounds=config['Network']['server']['nRounds'],
                                    num_clients=len(fl_dataset.trainloaders),
                                    fed_dataset=fl_dataset,
                                    diff_privacy=True if config['Network'][
                                        'server']['activateDP'] == "Activate" else False,
                                    # You can change the resources alocated for each client based on your machine

                                    client_resources = client_resources , 
                                    shap_config=shap_config
                                    )

                # Create the pipeline
                self.set_progress(label=f"Configuration : {index +1 }, Creating The pipeline", now=65)

                microseconds = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f").split('.')[1]

                ppl_1 = FLpipeline(name= f"pipeline_{microseconds}" ,
                                description="",
                                server=server)

                # Run the Traning of the model
                self.set_progress(label=f"Configuration : {index +1 }, Running the FL pipeline", now=75)
                history = ppl_1.server.run()

                # Test the model
                self.set_progress(label=f"Configuration : {index +1 }, Testing the model", now=95)
                report = ppl_1.auto_test()
                
                # Debugging: Print the classification reports before parsing
                for report_item in report:
                    print(f"Raw classification_report: {report_item['classification_report']}")
                    try:
                        report_item['classification_report'] = json.loads(report_item['classification_report'].replace("'", "\""))
                    except json.JSONDecodeError as e:
                        print(f"Error decoding JSON: {e}")
                        report_item['classification_report'] = {}  # Set to an empty dict in case of error


                results = {
                    'results': server.auc,
                    'test_results': report , 
                    'federated_shap_result' :server.federated_shap_result
                }

                global_results.append(results)
                

                print(results)
                # =========================================

        for result in global_results:
            if not isinstance(result, dict):
                raise ValueError("All entries in global_results must be dictionaries")

        print(f'this is the global results =========================================> \n {global_results}')
        self.set_progress(label="The results are ready !", now=99)
        time.sleep(1)
        self.results = { "stats" : {"results" : len(global_results)} , 
            "data": global_results,
            "stringFromBackend": "Pipeline training completed!" , 
        }

        return self.results


fl_pipeline = GoExecScriptRunPipelineFromMEDfl(json_params_dict, id_)
fl_pipeline.start()
