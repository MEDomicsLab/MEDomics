from MEDfl.LearningManager.params_optimiser import ParamsOptimiser
import pandas as pd
from sklearn.model_selection import train_test_split
import os
import json
import sys
from pathlib import Path
import time
import plotly.io as pio
import base64

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

#  MEDfl imports

# MEDfl imports

json_params_dict, id_ = parse_arguments()


class GoExecScriptParamOptimFromMEDfl(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The json params of the execution
            _id: The id of the execution
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def fig_to_base64(self, fig):
        img_bytes = pio.to_image(fig, format='png')
        img_str = base64.b64encode(img_bytes).decode('utf-8')
        return img_str 
    
    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script of the execution of the process from Go
        """

        self.set_progress(label="Reading dataset", now=20)
        data = pd.read_csv(json_config['flConfig']["dataset"])
        # Define features and target variable
        features = [col for col in data.columns if col !=
                    json_config['flConfig']["target"]]
        target = json_config['flConfig']["target"]

        X_train, X_test, y_train, y_test = train_test_split(
            data[features], data[target], test_size=0.2, random_state=42)

        # Initiate the ParamsOptimiser class
        trainer = ParamsOptimiser(X_train, y_train, X_test, y_test)
        print(json_config['flConfig'])
        self.set_progress(label="Model optimisation", now=30)

        if (json_config['flConfig']["type"] == 'gridSearch'):
            grid_search_results = trainer.perform_grid_search(
                json_config['flConfig']["param_grid"], scoring_metric=json_config['flConfig']["metric"])
        else:
            study = trainer.optuna_optimisation(
                direction=json_config['flConfig']["direction"], params=json_config['flConfig']["param_grid"])
            
            # Generate the plots
            opt_history = trainer.plot_optimization_history()
            param_importance = trainer.plot_param_importances()
            parallel_coordinates = trainer.plot_parallel_coordinate()

            # Convert plots to base64 strings
            opt_history_base64 = self.fig_to_base64(opt_history)
            param_importance_base64 = self.fig_to_base64(param_importance)
            parallel_coordinates_base64 = self.fig_to_base64(parallel_coordinates)


        self.set_progress(label="Getting params", now=90)

        if (json_config['flConfig']["type"] == 'gridSearch'):
            self.results = {
                "data": {
                    "Best Parameters": grid_search_results.best_params_,
                    "Best Score": grid_search_results.best_score_,
                    "Metric": json_config['flConfig']["metric"]
                },
                "stringFromBackend": "Best gridsearch params returned"}
        else:
            self.results = {
                "data": {
                    "Best Parameters": study.best_params,
                    "Best Score": study.best_value,
                    "Metric": json_config['flConfig']["metric"] , 
                    'opt_history' : opt_history_base64 , 
                    'param_importance' : param_importance_base64 , 
                    'parallel_coordinates' : parallel_coordinates_base64
                },
                "stringFromBackend": "Best optuna params returned"}
        self.set_progress(label="Best hyperparameters are ready", now=100)
        return self.results


fl_db_config = GoExecScriptParamOptimFromMEDfl(json_params_dict, id_)
fl_db_config.start()
