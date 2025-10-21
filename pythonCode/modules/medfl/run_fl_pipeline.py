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

            if config['flModelNode']['activateTl'] == "true": 
                model = Model.load_model(config['flModelNode']['file']['path'])
            
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
                    
                
                # Create the model with the suggested hyperparameters
                model = BinaryClassifier(input_size=fl_dataset.size,
                                         num_layers=config['flModelNode']['Number of layers'],
                                         layer_size=config['flModelNode']['Hidden size'],)
                pass 

            
            

            if config['flModelNode']['optimizer'] == 'Adam':
                optimizer = optim.Adam(
                    model.parameters(), lr=config['flModelNode']['learning rate'])
            elif config['flModelNode']['optimizer'] == 'SGD':
                optimizer = optim.SGD(model.parameters(),
                                    lr=config['flModelNode']['learning rate'])
            elif config['flModelNode']['optimizer'] == 'RMSprop':
                optimizer = optim.RMSprop(
                    model.parameters(), lr=config['flModelNode']['learning rate'])
            
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

                         
            server = FlowerServer(global_model,
                                strategy=aggreg_algo,
                                num_rounds=config['Network']['server']['nRounds'],
                                num_clients=len(fl_dataset.trainloaders),
                                fed_dataset=fl_dataset,
                                diff_privacy=True if config['Network'][
                                    'server']['activateDP'] == "Activate" else False,
                                # You can change the resources alocated for each client based on your machine

                                client_resources = client_resources
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
                'test_results': report
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
