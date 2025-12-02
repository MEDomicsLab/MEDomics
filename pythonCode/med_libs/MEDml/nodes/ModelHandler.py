import copy
import json
from typing import Union

import numpy as np
import pandas as pd
from colorama import Fore
from pycaret.classification import *
from pycaret.utils.generic import check_metric
from sklearn.metrics import (accuracy_score, cohen_kappa_score,
                             f1_score, matthews_corrcoef,
                             precision_score, recall_score, roc_auc_score)

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
        self.model_name_id = None
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
            self.optimize_threshold = self.config_json['data']['internal'].get('optimizeThreshold', False)
            if self.optimize_threshold:
                self.threshold_optimization_metric = self.config_json['data']['internal'].get('threshOptimizationMetric', 'Accuracy')
            self.model_id = self.config_json['associated_id']
            model_obj = self.global_config_json['nodes'][self.model_id]
            self.model_name_id = model_obj['data']['internal'].get('nameID', None)
            self.config_json['data']['estimator'] = {
                "type": model_obj['data']['internal']['selection'],
                "settings": model_obj['data']['internal']['settings']
            }

    def __calculate_all_metrics(self, y_true, y_pred, y_pred_proba=None):
        """
        Calculate comprehensive classification metrics manually
        """
        metrics = {}
        
        try:
            # Probability-based metrics (if available)
            if y_pred_proba is not None:
                try:
                    # For binary classification
                    if len(np.unique(y_true)) == 2:
                        metrics['AUC'] = round(roc_auc_score(y_true, y_pred_proba), 3)
                    else:
                        # For multiclass - use one-vs-rest
                        metrics['AUC'] = round(roc_auc_score(y_true, y_pred_proba, multi_class='ovr', average='weighted'), 3)
                except Exception as e:
                    print(f"Warning: Could not calculate probability metrics: {e}")
                    metrics['AUC'] = "N/A"
            else:
                metrics['AUC'] = "N/A"

            # Basic classification metrics
            metrics['Accuracy'] = round(accuracy_score(y_true, y_pred), 3)
            metrics['Precision'] = round(precision_score(y_true, y_pred, zero_division=0), 3)
            metrics['Recall'] = round(recall_score(y_true, y_pred, zero_division=0), 3)
            metrics['F1'] = round(f1_score(y_true, y_pred, zero_division=0), 3)

            # Additional metrics
            metrics['Kappa'] = round(cohen_kappa_score(y_true, y_pred), 3)
            metrics['MCC'] = round(matthews_corrcoef(y_true, y_pred), 3)
        except Exception as e:
            print(f"Error calculating metrics: {e}")
            # Set default values for all metrics
            default_metrics = ['Accuracy', 'AUC', 'Recall', 'Precision', 'F1', 'Kappa', 'MCC']
            for metric in default_metrics:
                metrics[metric] = 0
        
        return metrics

    def __calculate_overall_metrics(self, fold_metrics):
        """Calculate mean and std of metrics across all folds"""
        overall_metrics = {}
        log_metrics = {}
        
        if not fold_metrics:
            return overall_metrics
        
        # Get all metric names from first fold
        first_fold_metrics = list(fold_metrics.values())[0]
        
        for metric_name in first_fold_metrics.keys():
            metric_values = []
            for _, metrics in fold_metrics.items():
                if metric_name in metrics:
                    metric_values.append(metrics[metric_name])
            
            if metric_values:
                overall_metrics[metric_name] = {
                    'mean': round(float(np.mean(metric_values)), 3),
                    'std': round(float(np.std(metric_values)), 3),
                    'min': round(float(np.min(metric_values)), 3),
                    'max': round(float(np.max(metric_values)), 3),
                }
                log_metrics[metric_name] = overall_metrics[metric_name]['mean']
        
        return overall_metrics, log_metrics
    
    def __get_cv_metrics(self, cv_metrics: dict):
        """Extract mean and std from PyCaret's cv_metrics dictionary"""
        overall_metrics = {}
        for metric_name, values in cv_metrics.items():
            overall_metrics[metric_name] = {
                'mean': round(float(values['Mean']), 3),
                'std': round(float(values['SD']), 3),
                'min': round(float(values['Min']), 3),
                'max': round(float(values['Max']), 3),
            }
        return overall_metrics
    
    def __custom_train_and_evaluate(
            self, 
            pycaret_exp, 
            folds: list,
            X_processed: pd.DataFrame, 
            y_processed: pd.Series, 
            random_state=42, 
            finalize=False,
            final_setup_kwargs: dict = {},
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

        # Store all metrics for each fold
        all_fold_metrics = {}

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
            if 'log_experiment' in list(final_setup_kwargs.keys()):
                del final_setup_kwargs['log_experiment']
            # Create a new Pycaret experiment for each fold if needed
            fold_exp = copy.deepcopy(pycaret_exp)
            fold_exp.setup(
                data=pd.concat([X_train_fold, y_train_fold], axis=1),
                test_data=pd.concat([X_test_fold, y_test_fold], axis=1),
                log_experiment=False,
                index=False,
                **final_setup_kwargs
            )
            # Use PyCaret's create_model instead of manual instantiation
            model = fold_exp.create_model(verbose=False, **ml_settings)
            
            # For logging purposes
            _ = pycaret_exp.create_model(verbose=False, **ml_settings)

            # Model Tuning
            if self.isTuningEnabled:
                # Check if optimization metric is set
                if 'optimize' in self.settingsTuning and self.settingsTuning['optimize']:
                    optimization_metric = self.settingsTuning['optimize']
                
                # Check if a custom grid is provided
                if self.useTuningGrid and self.model_id in list(self.config_json['data']['internal'].keys()) and 'custom_grid' in list(self.config_json['data']['internal'][self.model_id].keys()):
                    self.settingsTuning['custom_grid'] = self.config_json['data']['internal'][self.model_id]['custom_grid']
                
                # Tune the model
                model = fold_exp.tune_model(model, **self.settingsTuning)
            
            # Model Ensembling
            try:
                if self.ensembleEnabled:
                    model = fold_exp.ensemble_model(model, **self.settingsEnsemble)
            except Exception as e:
                raise ValueError(f"Failed to ensemble model on fold {fold_num}. Error: {e}")
            
            # Model Calibration
            try:
                if self.calibrateEnabled:
                    model = fold_exp.calibrate_model(model, **self.settingsCalibrate)
            except Exception as e:
                raise ValueError(f"Failed to calibrate model on fold {fold_num}. Error: {e}")

            # Testing on the test set for this fold
            # Make predictions on the test set
            y_pred = model.predict(X_test_fold)
            y_proba = model.predict_proba(X_test_fold)[:, 1] if hasattr(model, 'predict_proba') else None

            # Calculate all metrics manually
            fold_metric_results = self.__calculate_all_metrics(y_test_fold, y_pred, y_proba)
            
            # Store metrics for this fold
            all_fold_metrics[fold_num] = fold_metric_results
            
            # Get predictions for probability-based metrics if available
            if optimization_metric.lower() == 'auc' and hasattr(model, 'predict_proba'):
                y_pred = model.predict_proba(X_test_fold)[:, 1]
            
            # Store the model and its performance
            fold_score = check_metric(y_test_fold, pd.Series(y_pred), metric=optimization_metric)
            fold_performances.append({
                'fold': fold_num,
                'model': model,
                'experiment': fold_exp,
                'score': fold_score,
                'test_indices': test_indices
            })

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

        # Calculate overall metrics across all folds
        overall_metrics, log_metrics = self.__calculate_overall_metrics(all_fold_metrics)

        # Manually log metrics
        custom_logger = pycaret_exp.get_config('logging_param').loggers[0]
        custom_logger.log_metrics(log_metrics)

        # Select the best model based on performance
        if fold_performances:
            # Sort by score (higher is better) and select the best model
            best_model = sorted(fold_performances, key=lambda x: x['score'], reverse=True)[0]['model']
            best_exp = sorted(fold_performances, key=lambda x: x['score'], reverse=True)[0]['experiment']

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

                # Optimize model's threshold if enabled
                if self.optimize_threshold:
                    best_model = best_exp.optimize_threshold(best_model, optimize=self.threshold_optimization_metric)

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
                if self.optimize_threshold:
                    self.CodeHandler.add_line("code", f"# Optimizing model threshold based on {self.threshold_optimization_metric}", indent=0)
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.optimize_threshold(best_model, metric='{self.threshold_optimization_metric}')", indent=0)

                # Finalize the model
                if finalize:
                    best_model = best_exp.finalize_model(best_model)
                    self.CodeHandler.add_line("code", "\n# Finalizing model")
                    self.CodeHandler.add_line("code", f"best_model = best_exp.finalize_model(best_model)")
                
                # Store the final model
                self.CodeHandler.add_line("code", f"trained_models = [best_model]")
                return {'model': best_model, 'overall_metrics': overall_metrics}
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
        final_setup_kwargs = kwargs.get("final_setup_kwargs", {})
        iteration_data = kwargs["split_indices"]
        pycaret_exp = experiment['pycaret_exp']
        random_state = kwargs.get("random_state", 42)
        finalize = kwargs.get("finalize", False)
        overall_metrics = {}

        # Setup models to train and evaluate 
        try:
            if self.type != 'train_model':
                raise ValueError(f"Something went wrong, the type of the node is {self.type}, but it should be 'train_model'.")
            # For train_model, we can use the model_id from the configuration
            settings.update(self.config_json['data']['estimator']['settings'])
            
            import ast

            # Convert hidden_layer_sizes if it is a string
            if "hidden_layer_sizes" in settings:
                val = settings["hidden_layer_sizes"]
                if isinstance(val, str) and val.startswith("(") and val.endswith(")"):
                    print("Converting hidden_layer_sizes:", val)
                    try:
                        settings["hidden_layer_sizes"] = ast.literal_eval(val)
                    except Exception as e:
                        raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val}") from e

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

            # tune model if enabled
            if self.isTuningEnabled:
                # Check if a custom grid is provided
                if self.useTuningGrid and self.model_id in list(self.config_json['data']['internal'].keys()) and 'custom_grid' in list(self.config_json['data']['internal'][self.model_id].keys()):
                    self.settingsTuning['custom_grid'] = self.config_json['data']['internal'][self.model_id]['custom_grid']
                trained_model = pycaret_exp.tune_model(trained_model, **self.settingsTuning)
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.tune_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsTuning)})]")

            # Ensemble model if enabled
            if self.ensembleEnabled:
                trained_model = pycaret_exp.ensemble_model(trained_model, **self.settingsEnsemble)
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.ensemble_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsEnsemble)})]")

            # Calibrate model if enabled
            if self.calibrateEnabled:
                trained_model = pycaret_exp.calibrate_model(trained_model, **self.settingsCalibrate)
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.calibrate_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsCalibrate)})]")

            # Optimize model's threshold if enabled
            # Optimize threshold only for binary, non-calibrated, non-ensemble models
            if self.optimize_threshold:

                # Do not optimize if data is multiclass
                if len(pycaret_exp.get_config('y').unique()) != 2:
                    print("Skipping threshold optimization (multiclass not supported).")
                
                # Do not optimize if ensemble was applied
                elif self.ensembleEnabled:
                    print("Skipping threshold optimization (ensemble not supported).")

                # Do not optimize if calibration was applied
                elif self.calibrateEnabled:
                    print("Skipping threshold optimization (calibrated model not supported).")

                else:
                    trained_model = pycaret_exp.optimize_threshold(
                        trained_model,
                        optimize=self.threshold_optimization_metric
                    )
                    self.CodeHandler.add_line(
                        "code",
                        f"trained_models = [pycaret_exp.optimize_threshold(trained_models[0], metric='{self.threshold_optimization_metric}')]"
                    )

                #trained_model = pycaret_exp.optimize_threshold(trained_model, optimize=self.threshold_optimization_metric)
                #self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.optimize_threshold(trained_models[0], metric='{self.threshold_optimization_metric}')]")

            if finalize:
                self.CodeHandler.add_line("md", "##### *Finalizing models*")
                self.CodeHandler.add_line("code", f"for model in trained_models:")
                self.CodeHandler.add_line(
                    "code",
                    f"model = pycaret_exp.finalize_model(model)",
                    1
                )
                trained_model = pycaret_exp.finalize_model(trained_model)
            
            # Get final metrics dict
            final_metrics = pycaret_exp.pull().to_dict(orient='records')
            for fold in final_metrics[:-2]:   # Exclude 'Mean' and 'Std' rows
                for metric in list(fold.keys()):
                    if metric not in list(overall_metrics.keys()):
                        overall_metrics[metric] = []
                    overall_metrics[metric].append(fold[metric])
            
            for metric in list(overall_metrics.keys()):
                overall_metrics[metric] = {
                    'mean': round(float(np.mean(overall_metrics[metric])), 3),
                    'std': round(float(np.std(overall_metrics[metric])), 3),
                    'min': round(float(np.min(overall_metrics[metric])), 3),
                    'max': round(float(np.max(overall_metrics[metric])), 3),
                }
            return {'model': trained_model, 'overall_metrics': overall_metrics}
        else:
            # Retrieve processed data from PyCaret
            X_processed = pycaret_exp.get_config('X_transformed')
            y_processed = pycaret_exp.get_config('y_transformed')

            # Update code handler
            self.CodeHandler.add_line("code", "# Retrieve processed data from PyCaret")
            self.CodeHandler.add_line("code", f"X_processed = pycaret_exp.get_config('X_transformed')")
            self.CodeHandler.add_line("code", f"y_processed = pycaret_exp.get_config('y_transformed')")

            # Custom training and evaluation function
            results = self.__custom_train_and_evaluate(
                pycaret_exp, 
                folds, 
                X_processed, 
                y_processed, 
                random_state, 
                finalize,
                final_setup_kwargs,
                **settings
            )
        return results

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        print(Fore.BLUE + "=== fit === " + Fore.YELLOW + f"({self.username})" + Fore.RESET)
        print(Fore.CYAN + f"Using {self.type}" + Fore.RESET)
        if self.type == "train_model" and getattr(self, "model_name_id", None) is not None:
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
            results = self.__handle_splitted_data(experiment, settings, **kwargs)
            trained_models = [results['model']]
            all_metrics = results['overall_metrics']
            trained_models_json['overall_metrics'] = all_metrics
        elif self.type == 'compare_models':
            models = experiment['pycaret_exp'].compare_models(**settings)
            self.CodeHandler.add_line("code", f"trained_models = pycaret_exp.compare_models({self.CodeHandler.convert_dict_to_params(settings)})")
            if isinstance(models, list):
                trained_models = models
            else:
                trained_models = [models]
                self.CodeHandler.add_line("code", "# pycaret_exp.compare_models() returns a single model, but we want a list of models")
                self.CodeHandler.add_line("code", "trained_models = [trained_models]")

        elif self.type == 'train_model':
            settings.update(self.config_json['data']['estimator']['settings'])
            
            import ast

            # Convert hidden_layer_sizes if it is a string
            if "hidden_layer_sizes" in settings:
                val = settings["hidden_layer_sizes"]
                if isinstance(val, str) and val.startswith("(") and val.endswith(")"):
                    print("Converting hidden_layer_sizes:", val)
                    try:
                        settings["hidden_layer_sizes"] = ast.literal_eval(val)
                    except Exception as e:
                        raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val}") from e

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

            if self.optimize_threshold:
                trained_models = [experiment['pycaret_exp'].optimize_threshold(trained_models[0], optimize=self.threshold_optimization_metric)]
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.optimize_threshold(trained_models[0], metric='{self.threshold_optimization_metric}')]")

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
