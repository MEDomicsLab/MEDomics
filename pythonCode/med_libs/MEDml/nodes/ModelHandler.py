import copy
import json
from typing import Union

import numpy as np
import pandas as pd
from colorama import Fore
from pycaret.classification import *
from pycaret.utils.generic import check_metric

from .NodeObj import Node

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]

class ModelHandler(Node):
    """
    This class represents the ModelHandler node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json.
        """
        super().__init__(id_, global_config_json)
        if self.type == 'train_model':
            self.isTuningEnabled = self.config_json['data']['internal'].get('isTuningEnabled', False)
            if self.isTuningEnabled:
                self.settingsTuning = self.config_json['data']['internal'].get('settingsTuning', {})
                self.useTuningGrid = self.config_json['data']['internal'].get('useTuningGrid', False)
            self.ensembleEnabled = self.config_json['data']['internal'].get('ensembleEnabled', False)
            if self.ensembleEnabled:
                self.settingsEnsemble = self.config_json['data']['internal'].get('settingsEnsembling', {})
            self.calibrateEnabled = self.config_json['data']['internal'].get('calibrateEnabled', False)
            if self.calibrateEnabled:
                self.settingsCalibrate = self.config_json['data']['internal'].get('settingsCalibration', {})
            self.model_id = self.config_json['associated_id']
            model_obj = self.global_config_json['nodes'][self.model_id]
            self.model_name_id = model_obj['data']['internal'].get('nameID', None)
            self.config_json['data']['estimator'] = {
                "type": model_obj['data']['internal']['selection'],
                "settings": model_obj['data']['internal']['settings']
            }

    def __custom_train_and_evaluate(
            self, 
            pycaret_exp, 
            folds: list,
            X_processed: pd.DataFrame, 
            y_processed: pd.Series, 
            random_state=42, 
            finalize=False,
            **ml_settings
        ) -> None:
        """
        Custom function to train and evaluate models using PyCaret's create_model and tune_model functions.

        Args:
            pycaret_exp (object): The PyCaret experiment object.
            model_id (str): The model ID to train and evaluate.
            folds (list): List of fold data for cross-validation.
            X_processed (pd.DataFrame): Processed feature data.
            y_processed (pd.Series): Processed target data.
            random_state (int): Random state for reproducibility.
            ml_settings (dict): Additional settings for model training and evaluation.
        
        Returns:
            None
        """
        if folds is None:
            raise ValueError("Folds should not be None. Check the iteration data.")

        # Initialization
        trained_models = []
        fold_performances = []
        optimization_metric = 'Accuracy'

        # Update code handler with parameters
        self.CodeHandler.add_line("code", "\n# Initializing model training and evaluation")
        self.CodeHandler.add_line("code", "trained_models = []")
        self.CodeHandler.add_line("code", "fold_performances = []")
        self.CodeHandler.add_line("code", f"optimization_metric = '{optimization_metric}'")
        
        # Iterate through each fold and train the model
        for fold_data in folds:
            fold_num = fold_data['fold']
            train_indices = fold_data['train_indices']
            test_indices = fold_data['test_indices']
           
            # Fold data extraction
            try:
                X_train_fold = X_processed.iloc[train_indices]
                y_train_fold = y_processed.iloc[train_indices]
                X_test_fold = X_processed.iloc[test_indices]
                y_test_fold = y_processed.iloc[test_indices]
            except IndexError as e:
                raise ValueError(f"Index error during fold data extraction on fold {fold_num}: {e}")

            # Model Instantiation
            try:
                # Use PyCaret's create_model instead of manual instantiation
                model = pycaret_exp.create_model(verbose=False, **ml_settings)
            except Exception as e:
                raise ValueError(f"Failed to create model on fold {fold_num}. Error: {e}")

            # Model Training
            try:
                # Set random_state if the model supports it
                if hasattr(model, 'random_state'):
                    setattr(model, 'random_state', random_state)
                
                # Try fitting with specific train-test data
                model.fit(X_train_fold, y_train_fold)
            except Exception as e:
                raise ValueError(f"Failed to fit model on fold {fold_num}. Error: {e}")

            # Model Tuning
            try:
                if self.isTuningEnabled:
                    # Check if optimization metric is set
                    if 'optimize' in self.settingsTuning and self.settingsTuning['optimize']:
                        optimization_metric = self.settingsTuning['optimize']
                    
                    # Check if a custom grid is provided
                    if self.useTuningGrid and self.model_id in list(self.config_json['data']['internal'].keys()) and 'custom_grid' in list(self.config_json['data']['internal'][self.model_id].keys()):
                        self.settingsTuning['custom_grid'] = self.config_json['data']['internal'][self.model_id]['custom_grid']
                    
                    # Tune the model
                    model = pycaret_exp.tune_model(model, **self.settingsTuning)
            except Exception as e:
                raise ValueError(f"Failed to tune model on fold {fold_num}. Error: {e}")

            # Testing on the test set for this fold
            try:
                # Make predictions on the test set
                y_pred = model.predict(X_test_fold)
                
                # Get predictions for probability-based metrics if available
                if optimization_metric.lower() == 'auc' and hasattr(model, 'predict_proba'):
                    y_pred = model.predict_proba(X_test_fold)[:, 1]
                
                # Store the model and its performance
                fold_score = check_metric(y_test_fold, pd.Series(y_pred), metric=optimization_metric)
                fold_performances.append({
                    'fold': fold_num,
                    'model': model,
                    'score': fold_score,
                    'test_indices': test_indices
                })
            except Exception as e:
                raise ValueError(f"Failed to evaluate model on fold {fold_num}. Error: {e}")

            # Store Results for the fold
            trained_models.append(model)

        # Update code handler with training loop
        self.CodeHandler.add_line("code", f"\n# Training and evaluating models for {len(folds)} folds")
        self.CodeHandler.add_line("code", f"for fold_data in folds:")
        self.CodeHandler.add_line("code", f"fold_num = fold_data['fold']", indent=1)
        self.CodeHandler.add_line("code", f"train_indices = fold_data['train_indices']", indent=1)
        self.CodeHandler.add_line("code", f"test_indices = fold_data['test_indices']", indent=1)
        self.CodeHandler.add_line("code", f"X_train_fold = X_processed.iloc[train_indices]", indent=1)
        self.CodeHandler.add_line("code", f"y_train_fold = y_processed.iloc[train_indices]", indent=1)
        self.CodeHandler.add_line("code", f"X_test_fold = X_processed.iloc[test_indices]", indent=1)
        self.CodeHandler.add_line("code", f"y_test_fold = y_processed.iloc[test_indices]", indent=1)
        self.CodeHandler.add_line("code", f"# Create and fit model", indent=1)
        self.CodeHandler.add_line("code", f"model = pycaret_exp.create_model(verbose=False, {self.CodeHandler.convert_dict_to_params(ml_settings)})", indent=1)
        self.CodeHandler.add_line("code", f"if hasattr(model, 'random_state'):", indent=1)
        self.CodeHandler.add_line("code", f"setattr(model, 'random_state', {random_state})", indent=2)
        self.CodeHandler.add_line("code", f"model.fit(X_train_fold, y_train_fold)", indent=1)
        self.CodeHandler.add_line("code", f"# Making predictions on the test set", indent=1)
        self.CodeHandler.add_line("code", f"y_pred = model.predict(X_test_fold)", indent=1)
        self.CodeHandler.add_line("code", f"# Assess performance", indent=1)
        self.CodeHandler.add_line("code", f"if optimization_metric.lower() == 'auc' and hasattr(model, 'predict_proba'):", indent=1)
        self.CodeHandler.add_line("code", f"y_pred = model.predict_proba(X_test_fold)[:, 1]", indent=2)
        self.CodeHandler.add_import("from pycaret.utils.generic import check_metric")
        self.CodeHandler.add_line("code", f"fold_score = check_metric(y_test_fold, pd.Series(y_pred), metric=optimization_metric)", indent=1)
        self.CodeHandler.add_line("code", f"fold_performances.append({{'fold': fold_num, 'model': model, 'score': fold_score, 'test_indices': test_indices}})", indent=1)
        self.CodeHandler.add_line("code", f"trained_models.append(model)", indent=1)

        # Select the best model based on performance
        if fold_performances:
            # Sort by score (higher is better) and select the best model
            best_model = sorted(fold_performances, key=lambda x: x['score'], reverse=True)[0]['model']

            # Update code handler with best model selection
            self.CodeHandler.add_line("code", "\n# Selecting the best model based on performance")
            self.CodeHandler.add_line("code", f"best_model = sorted(fold_performances, key=lambda x: x['score'], reverse=True)[0]['model']")
            
            # Final evaluation on the entire dataset if needed
            try:
                # Ensure the final model has the same random state
                if hasattr(best_model, 'random_state'):
                    setattr(best_model, 'random_state', random_state)

                    # Update code handler
                    self.CodeHandler.add_line("code", f"setattr(best_model, 'random_state', {random_state})")
                
                # Final fit on the entire dataset
                best_model.fit(X_processed, y_processed)

                # Update code handler with final fit
                self.CodeHandler.add_line("code", f"best_model.fit(X_processed, y_processed)")
                if self.isTuningEnabled:
                    self.CodeHandler.add_line("code", f"# Tuning model", indent=0)
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.tune_model(best_model, {self.CodeHandler.convert_dict_to_params(self.settingsTuning)})", indent=0)
                if self.ensembleEnabled:
                    self.CodeHandler.add_line("code", f"# Ensembling model", indent=0)
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.ensemble_model(best_model, {self.CodeHandler.convert_dict_to_params(self.settingsEnsemble)})", indent=0)
                if self.calibrateEnabled:
                    self.CodeHandler.add_line("code", f"# Calibrating model", indent=0)
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.calibrate_model(best_model, {self.CodeHandler.convert_dict_to_params(self.settingsCalibrate)})", indent=0)

                # Finalize the model
                if finalize:
                    best_model = pycaret_exp.finalize_model(best_model)
                    self.CodeHandler.add_line("code", "\n# Finalizing model")
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.finalize_model(best_model)")
                
                # Store the final model
                self.CodeHandler.add_line("code", f"trained_models = [best_model]")
                
                return best_model
            except Exception as e:
                raise ValueError(f"Failed to fit the best model on the entire dataset. Error: {e}")
        else:
            raise ValueError("No fold performances were recorded. Check the training process.")

    def __handle_splitted_data(self, experiment: dict, settings: dict, **kwargs) -> None:
        """
        Trains and evaluates models using PyCaret's create_model and tune_model functions based on user-defined splits.

        Args:
            experiment (dict): The experiment dictionary containing the PyCaret experiment object.
            settings (dict): The settings for the model training and evaluation.
            **kwargs: Additional arguments including dataset and iteration_result.

        Returns:
            None
        """

        # Initialize variables
        iteration_data = kwargs["split_indices"]
        pycaret_exp = experiment['pycaret_exp']
        random_state = kwargs.get("random_state", 42)
        finalize = kwargs.get("finalize", False)

        # Setup models to train and evaluate 
        try:
            if self.type != 'train_model':
                raise ValueError(f"Something went wrong, the type of the node is {self.type}, but it should be 'train_model'.")
            # For train_model, we can use the model_id from the configuration
            settings.update(self.config_json['data']['estimator']['settings'])
            settings.update({'estimator': self.config_json['data']['estimator']['type']})
            model_to_evaluate = self.config_json['data']['estimator']['type']
                
        except Exception as e:
            print(f"ERROR: Failed to retrieve models using pycaret_exp.models(). Error: {e}")
            model_to_evaluate = 'lr'

        split_type = iteration_data['type']
        folds = iteration_data['folds']

        # Iterate through models to train and evaluate
        trained_model = None
        if split_type == "cross_validation":
            # Check if estimator is already set in settings
            if 'estimator' in settings:
                if model_to_evaluate != settings['estimator']:
                    raise ValueError(f"Model ID {model_to_evaluate} does not match the estimator in settings. Please check your configuration.")
            else:
                settings['estimator'] = model_to_evaluate
                self.CodeHandler.add_line("code", f"# Training model: {model_to_evaluate}")

            # Use PyCaret's create_model instead of manual instantiation
            trained_model = pycaret_exp.create_model(**settings)
            self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.create_model({self.CodeHandler.convert_dict_to_params(settings)})]")

            if finalize:
                self.CodeHandler.add_line("md", "##### *Finalizing models*")
                self.CodeHandler.add_line("code", f"for model in trained_models:")
                self.CodeHandler.add_line(
                    "code",
                    f"model = pycaret_exp.finalize_model(model)",
                    1
                )
                trained_model = pycaret_exp.finalize_model(trained_model)
        else:
            # Retrieve processed data from PyCaret
            X_processed = pycaret_exp.get_config('X_transformed')
            y_processed = pycaret_exp.get_config('y_transformed')

            # Update code handler
            self.CodeHandler.add_line("code", "# Retrieve processed data from PyCaret")
            self.CodeHandler.add_line("code", f"X_processed = pycaret_exp.get_config('X_transformed')")
            self.CodeHandler.add_line("code", f"y_processed = pycaret_exp.get_config('y_transformed')")

            # Custom training and evaluation function
            trained_model = self.__custom_train_and_evaluate(
                pycaret_exp, 
                folds, 
                X_processed, 
                y_processed, 
                random_state, 
                finalize,
                **settings
            )
        return [trained_model]

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        print()
        print(Fore.BLUE + "=== fit === " + Fore.YELLOW + f"({self.username})" + Fore.RESET)
        print(Fore.CYAN + f"Using {self.type}" + Fore.RESET)
        if self.model_name_id is not None:
            self.CodeHandler.add_line("md", f"##### *Model ID: {self.model_name_id}*")
        else:
            self.CodeHandler.add_line("md", f"##### *Model ID: {self.username}*")
        trained_models = None
        trained_models_json = {}
        settings = copy.deepcopy(self.settings)
        if 'useTuningGrid' in list(settings.keys()):
            del settings['useTuningGrid']
        splitted = kwargs.get("splitted", None)
        finalize = kwargs.get("finalize", False)
        if splitted:
            trained_models = self.__handle_splitted_data(experiment, settings, **kwargs)
        elif self.type == 'compare_models':
            models = experiment['pycaret_exp'].compare_models(**settings)
            print(models)
            self.CodeHandler.add_line("code", f"trained_models = pycaret_exp.compare_models({self.CodeHandler.convert_dict_to_params(settings)})")
            if isinstance(models, list):
                trained_models = models
            else:
                trained_models = [models]
                self.CodeHandler.add_line("code", "# pycaret_exp.compare_models() returns a single model, but we want a list of models")
                self.CodeHandler.add_line("code", "trained_models = [trained_models]")

        elif self.type == 'train_model':
            settings.update(self.config_json['data']['estimator']['settings'])
            settings.update({'estimator': self.config_json['data']['estimator']['type']})
            trained_models = [experiment['pycaret_exp'].create_model(**settings)]
            self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.create_model({self.CodeHandler.convert_dict_to_params(settings)})]")
            if self.isTuningEnabled:
                # Check if a custom grid is provided
                if self.useTuningGrid and self.model_id in list(self.config_json['data']['internal'].keys()) and 'custom_grid' in list(self.config_json['data']['internal'][self.model_id].keys()):
                    self.settingsTuning['custom_grid'] = self.config_json['data']['internal'][self.model_id]['custom_grid']
                trained_models = [experiment['pycaret_exp'].tune_model(trained_models[0], **self.settingsTuning)]
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.tune_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsTuning)})]")

            if self.ensembleEnabled:
                trained_models = [experiment['pycaret_exp'].ensemble_model(trained_models[0], **self.settingsEnsemble)]
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.ensemble_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsEnsemble)})]")

            if self.calibrateEnabled:
                trained_models = [experiment['pycaret_exp'].calibrate_model(trained_models[0], **self.settingsCalibrate)]
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.calibrate_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsCalibrate)})]")

            if finalize:
                self.CodeHandler.add_line("md", "##### *Finalizing models*")
                self.CodeHandler.add_line("code", f"for model in trained_models:")
                self.CodeHandler.add_line(
                    "code",
                    f"model = pycaret_exp.finalize_model(model)",
                    1
                )
                trained_models = [experiment['pycaret_exp'].finalize_model(model) for model in trained_models]
        else:
            raise ValueError(f"Unsupported type: {self.type}. Expected 'compare_models' or 'train_model'.")
        trained_models_copy = trained_models.copy()
        settings_for_next = copy.deepcopy(settings)
        settings_for_next['fct_type'] = self.type
        trained_models_json['models'] = trained_models
        self._info_for_next_node = {'models': trained_models, 'id': self.id, 'settings': settings_for_next}
        for model in trained_models_copy:
            model_copy = copy.deepcopy(model)
            trained_models_json[model_copy.__class__.__name__] = model_copy.__dict__
            for key, value in model_copy.__dict__.items():
                if isinstance(value, np.ndarray):
                    trained_models_json[model_copy.__class__.__name__][key] = value.tolist()
        return trained_models_json

    def set_model(self, model_id: str) -> None:
        """
        This function sets the model configuration for the current node based on the given model_id.
        """
        try:
            model_obj = self.global_config_json['nodes'][model_id]
            self.config_json['data']['estimator'] = {
                "type": model_obj['data']['selection'],
                "settings": model_obj['data']['settings']
            }
            if self.isTuningEnabled:
                self.config_json['data']['internal']['settingsTuning'] = model_obj['data']['internal'].get('settingsTuning', {})
        except KeyError as e:
            print(f"ERROR: Failed to set model {model_id}. Missing key: {e}")
            raise ValueError(f"Model configuration for {model_id} not found in the global config.")
        except Exception as e:
            print(f"ERROR: An error occurred while setting the model: {e}")
            raise ValueError(f"An error occurred while setting model {model_id}.")

    def set_model(self, model_id: str) -> None:
        # self.model_id = model_id
        model_obj = self.global_config_json['nodes'][model_id]
        self.config_json['data']['estimator'] = {
            "type": model_obj['data']['selection'],
            "settings": model_obj['data']['settings']
        }
