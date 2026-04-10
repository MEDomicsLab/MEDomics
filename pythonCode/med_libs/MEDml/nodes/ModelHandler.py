import ast
import copy
import json
from typing import Union

import numpy as np
import pandas as pd
from colorama import Fore
from pycaret.classification import *
from pycaret.utils.generic import check_metric
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             matthews_corrcoef, precision_score, recall_score,
                             roc_auc_score)

from .NodeObj import Node

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]

def sanitize_hyperparam(name, value):
    if value is None:
        return None

    # --- special case: max_features
    if name == "max_features":
        if isinstance(value, str):
            if value.isdigit():
                return int(value)
            try:
                return float(value)
            except ValueError:
                return value
        return value

    # --- default behavior for ALL other hyperparameters
    return value


def sanitize_custom_grid(custom_grid: dict) -> dict:
    """
    Sanitize all hyperparameters coming from frontend
    - cast values
    - remove None
    - drop empty parameters
    """
    clean_grid = {}

    for param, values in custom_grid.items():
        if not isinstance(values, list):
            continue

        sanitized_values = []
        for v in values:
            sv = sanitize_hyperparam(param, v)
            if sv is not None:
                sanitized_values.append(sv)

        # IMPORTANT : on ne garde le paramètre que s'il reste des valeurs
        if sanitized_values:
            clean_grid[param] = sanitized_values

    return clean_grid



class ModelHandler(Node):
    """
    This class represents the ModelHandler node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
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
                # Normalizing metric names for Pycaret
                METRIC_NAME_MAP = {
                    'Youden': 'Youden Index',
                    'BAC': 'Balanced Accuracy',
                    'Specificity': 'Specificity',
                    'NPV': 'NPV',
                }
                self.threshold_optimization_metric = METRIC_NAME_MAP.get(
                    self.threshold_optimization_metric, 
                    self.threshold_optimization_metric
                )
            self.model_id = self.config_json['associated_id']
            model_obj = self.global_config_json['nodes'][self.model_id]
            self.model_name_id = model_obj['data']['internal'].get('nameID', None)
            self.config_json['data']['estimator'] = {
                "type": model_obj['data']['internal']['selection'],
                "settings": model_obj['data']['internal']['settings']
            }

    def __calculate_all_metrics(self, y_true, y_pred, y_pred_proba=None):
        metrics = {}
        
        try:
            if y_pred_proba is not None:
                try:
                    if len(np.unique(y_true)) == 2:
                        metrics['AUC'] = round(roc_auc_score(y_true, y_pred_proba), 3)
                    else:
                        metrics['AUC'] = round(roc_auc_score(y_true, y_pred_proba, multi_class='ovr', average='weighted'), 3)
                except Exception as e:
                    print(f"Warning: Could not calculate probability metrics: {e}")
                    metrics['AUC'] = "N/A"
            else:
                metrics['AUC'] = "N/A"

            metrics['Sensitivity'] = round(recall_score(y_true, y_pred, zero_division=0), 3)
            metrics['Specificity'] = round(self.specificity(y_true, y_pred), 3)
            metrics['PPV'] = round(precision_score(y_true, y_pred, zero_division=0), 3)
            metrics['NPV'] = round(self.npv(y_true, y_pred), 3)
            metrics['Accuracy'] = round(accuracy_score(y_true, y_pred), 3)
            metrics['F1'] = round(f1_score(y_true, y_pred, zero_division=0), 3)
            metrics['MCC'] = round(matthews_corrcoef(y_true, y_pred), 3)

        except Exception as e:
            raise ValueError(f"Error calculating metrics: {e}")
        
        return metrics
    
    def __calculate_all_metrics_to_notebook(self):
        self.CodeHandler.add_line("code", "def calculate_all_metrics(y_true, y_pred, y_pred_proba=None):", indent=0)
        self.CodeHandler.add_line("code", "metrics = {}", indent=1)
        self.CodeHandler.add_line("code", "try:", indent=1)
        self.CodeHandler.add_line("code", "if y_pred_proba is not None:", indent=2)
        self.CodeHandler.add_line("code", "try:", indent=3)
        self.CodeHandler.add_line("code", "if len(np.unique(y_true)) == 2:", indent=4)
        self.CodeHandler.add_line("code", "metrics['AUC'] = round(roc_auc_score(y_true, y_pred_proba), 3)", indent=5)
        self.CodeHandler.add_line("code", "else:", indent=4)
        self.CodeHandler.add_line("code", "metrics['AUC'] = round(roc_auc_score(y_true, y_pred_proba, multi_class='ovr', average='weighted'), 3)", indent=5)
        self.CodeHandler.add_line("code", "except Exception as e:", indent=3)
        self.CodeHandler.add_line("code", "print(f\"Warning: Could not calculate probability metrics: {e}\")", indent=4)
        self.CodeHandler.add_line("code", "metrics['AUC'] = \"N/A\"", indent=4)
        self.CodeHandler.add_line("code", "metrics['Sensitivity'] = round(recall_score(y_true, y_pred, zero_division=0), 3)", indent=2)
        self.CodeHandler.add_line("code", "metrics['Specificity'] = round(specificity(y_true, y_pred), 3)", indent=2)
        self.CodeHandler.add_line("code", "metrics['PPV'] = round(precision_score(y_true, y_pred, zero_division=0), 3)", indent=2)
        self.CodeHandler.add_line("code", "metrics['NPV'] = round(npv(y_true, y_pred), 3)", indent=2)
        self.CodeHandler.add_line("code", "metrics['Accuracy'] = round(accuracy_score(y_true, y_pred), 3)", indent=2)
        self.CodeHandler.add_line("code", "metrics['F1'] = round(f1_score(y_true, y_pred, zero_division=0), 3)", indent=2)
        self.CodeHandler.add_line("code", "metrics['MCC'] = round(matthews_corrcoef(y_true, y_pred), 3)", indent=2)
        self.CodeHandler.add_line("code", "except Exception as e:", indent=1)
        self.CodeHandler.add_line("code", "raise ValueError(f\"Error calculating metrics: {e}\")", indent=2)
        self.CodeHandler.add_line("code", "return metrics", indent=1)

    def __calculate_overall_metrics(self, fold_metrics):
        overall_metrics = {}
        log_metrics = {}
        
        if not fold_metrics:
            return overall_metrics, log_metrics
        
        first_fold_metrics = list(fold_metrics.values())[0]
        
        for metric_name in first_fold_metrics.keys():
            metric_values = []
            for _, metrics in fold_metrics.items():
                if metric_name in list(metrics.keys()) and "N/A" not in str(metrics[metric_name]):
                    metric_values.append(metrics[metric_name])
            
            if metric_values:
                overall_metrics[metric_name] = {
                    'mean': round(float(np.mean(metric_values)), 3),
                    'median': round(float(np.median(metric_values)), 3),
                    'std': round(float(np.std(metric_values)), 3),
                    'min': round(float(np.min(metric_values)), 3),
                    'max': round(float(np.max(metric_values)), 3),
                }
                log_metrics[metric_name] = overall_metrics[metric_name]['mean']
        
        return overall_metrics, log_metrics
    
    def __calculate_overall_metrics_to_notebook(self):
        self.CodeHandler.add_line("code", "def calculate_overall_metrics(fold_metrics):", indent=0)
        self.CodeHandler.add_line("code", "overall_metrics = {}", indent=1)
        self.CodeHandler.add_line("code", "log_metrics = {}", indent=1)
        self.CodeHandler.add_line("code", "if not fold_metrics:", indent=1)
        self.CodeHandler.add_line("code", "return overall_metrics, log_metrics", indent=2)
        self.CodeHandler.add_line("code", "first_fold_metrics = list(fold_metrics.values())[0]", indent=1)
        self.CodeHandler.add_line("code", "for metric_name in first_fold_metrics.keys():", indent=1)
        self.CodeHandler.add_line("code", "metric_values = []", indent=2)
        self.CodeHandler.add_line("code", "for _, metrics in fold_metrics.items():", indent=2)
        self.CodeHandler.add_line("code", "if metric_name in list(metrics.keys()) and \"N/A\" not in str(metrics[metric_name]):", indent=3)
        self.CodeHandler.add_line("code", "metric_values.append(metrics[metric_name])", indent=4)
        self.CodeHandler.add_line("code", "if metric_values:", indent=2)
        self.CodeHandler.add_line("code", "overall_metrics[metric_name] = { 'mean': round(float(np.mean(metric_values)), 3), 'median': round(float(np.median(metric_values)), 3), 'std': round(float(np.std(metric_values)), 3), 'min': round(float(np.min(metric_values)), 3), 'max': round(float(np.max(metric_values)), 3) }", indent=3)
        self.CodeHandler.add_line("code", "log_metrics[metric_name] = overall_metrics[metric_name]['mean']", indent=3)
        self.CodeHandler.add_line("code", "return overall_metrics, log_metrics", indent=1)

    def __recalculate_metrics_with_threshold(self, model, X_test, y_test):
        """
        Recalculate all metrics using the model's optimized threshold.
        Reads 'probability_threshold' (PyCaret 3.x CustomProbabilityThresholdClassifier)
        with fallback to 'threshold' for compatibility with other versions.
        Used after optimize_threshold to ensure reported metrics reflect the actual threshold.
        """
        threshold = getattr(model, 'probability_threshold', getattr(model, 'threshold', 0.5))
        y_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else None

        if y_proba is not None:
            y_pred = (y_proba >= threshold).astype(int)
        else:
            y_pred = model.predict(X_test)
            y_proba = None

        metrics = self.__calculate_all_metrics(y_test, y_pred, y_proba)
        
        # Wrap in mean/std format to match overall_metrics structure
        return {
            k: {
                'mean': v,
                'median': v,
                'std': 0.0,
                'min': v,
                'max': v,
            } for k, v in metrics.items() if v != "N/A"
        }

    def __recalculate_metrics_with_threshold_to_notebook(self):
        self.CodeHandler.add_line("code", "def recalculate_metrics_with_threshold(model, X_test, y_test):", indent=0)
        self.CodeHandler.add_line("code", "threshold = getattr(model, 'probability_threshold', getattr(model, 'threshold', 0.5))", indent=1)
        self.CodeHandler.add_line("code", "y_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else None", indent=1)
        self.CodeHandler.add_line("code", "if y_proba is not None:", indent=1)
        self.CodeHandler.add_line("code", "y_pred = (y_proba >= threshold).astype(int)", indent=2)
        self.CodeHandler.add_line("code", "else:", indent=1)
        self.CodeHandler.add_line("code", "y_pred = model.predict(X_test)", indent=2)
        self.CodeHandler.add_line("code", "y_proba = None if y_proba is None else y_proba", indent=2)
        self.CodeHandler.add_line("code", "metrics = calculate_all_metrics(y_test, y_pred, y_proba)", indent=1)
        self.CodeHandler.add_line("code", "return {k: {'mean': v, 'median': v, 'std': 0.0, 'min': v, 'max': v} for k, v in metrics.items() if v != \"N/A\"}", indent=1)

    def __custom_train_and_evaluate(
            self, 
            pycaret_exp, 
            folds: list,
            X_processed: pd.DataFrame, 
            y_processed: pd.Series, 
            finalize=False,
            final_setup_kwargs: dict = {},
            **ml_settings
        ) -> None:

        if folds is None:
            raise ValueError("Folds should not be None. Check the iteration data.")

        # Functions required for code generation
        self.CodeHandler.add_import("import copy")
        self.CodeHandler.add_import("from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix, matthews_corrcoef")
        self.CodeHandler.add_line("md", "Utility functions for metric calculations")
        self.specificity_to_notebook()
        self.npv_to_notebook()
        self.__calculate_all_metrics_to_notebook()
        self.__calculate_overall_metrics_to_notebook()
        if self.optimize_threshold:
            self.__recalculate_metrics_with_threshold_to_notebook()

        # Initialization
        trained_models = []
        fold_performances = []
        optimization_metric = 'Accuracy'
        all_fold_metrics = {}

        self.CodeHandler.add_line("md", "Training and evaluating models for each fold")
        self.CodeHandler.add_line("code", "\n# Initializing model training and evaluation")
        self.CodeHandler.add_line("code", "trained_models = []")
        self.CodeHandler.add_line("code", "fold_performances = []")
        self.CodeHandler.add_line("code", f"optimization_metric = '{optimization_metric}'")
        self.CodeHandler.add_line("code", "all_fold_metrics = {}")
        
        for fold_data in folds:
            fold_num = fold_data['fold']
            train_indices = fold_data['train_indices']
            test_indices = fold_data['test_indices']
           
            try:
                X_train_fold = X_processed.iloc[train_indices]
                y_train_fold = y_processed.iloc[train_indices]
                X_test_fold = X_processed.iloc[test_indices]
                y_test_fold = y_processed.iloc[test_indices]
            except IndexError as e:
                raise ValueError(f"Index error during fold data extraction on fold {fold_num}: {e}")

            # setup a unique experiment for each fold
            if 'log_experiment' in list(final_setup_kwargs.keys()):
                del final_setup_kwargs['log_experiment']
            fold_exp = copy.deepcopy(pycaret_exp)
            fold_exp.setup(
                data=pd.concat([X_train_fold, y_train_fold], axis=1),
                test_data=pd.concat([X_test_fold, y_test_fold], axis=1),
                log_experiment=False,
                index=False,
                **final_setup_kwargs
            )
            model = fold_exp.create_model(verbose=False, **ml_settings)

            # This is only for logging purposes
            _ = pycaret_exp.create_model(verbose=False, **ml_settings)

            if self.isTuningEnabled:
                if 'optimize' in self.settingsTuning and self.settingsTuning['optimize']:
                    optimization_metric = self.settingsTuning['optimize']
                
                if self.useTuningGrid and self.model_id in list(self.config_json['data']['internal'].keys()) and 'custom_grid' in list(self.config_json['data']['internal'][self.model_id].keys()):
                    raw_grid = self.config_json['data']['internal'][self.model_id]['custom_grid']
                    self.settingsTuning['custom_grid'] = sanitize_custom_grid(raw_grid)
          
                    if "hidden_layer_sizes" in self.settingsTuning['custom_grid']:
                        val = self.settingsTuning['custom_grid']["hidden_layer_sizes"]
                        if isinstance(val, list):
                            for i in range(len(val)):
                                if isinstance(val[i], str) and val[i].startswith("(") and val[i].endswith(")"):
                                    try:
                                        val[i] = list(ast.literal_eval(val[i]))
                                    except Exception as e:
                                        raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val[i]}") from e
                        if isinstance(val, str) and val.startswith("(") and val.endswith(")"):
                            try:
                                self.settingsTuning['custom_grid']["hidden_layer_sizes"] = list(ast.literal_eval(val))
                            except Exception as e:
                                raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val}") from e
                
                model = fold_exp.tune_model(model, **self.settingsTuning)
                custom_logger = pycaret_exp.get_config('logging_param').loggers[0]
                custom_logger.log_params(model.get_params())
            
            try:
                if self.ensembleEnabled:
                    model = fold_exp.ensemble_model(model, **self.settingsEnsemble)
            except Exception as e:
                raise ValueError(f"Failed to ensemble model on fold {fold_num}. Error: {e}")
            
            try:
                if self.calibrateEnabled:
                    model = fold_exp.calibrate_model(model, **self.settingsCalibrate)
            except Exception as e:
                raise ValueError(f"Failed to calibrate model on fold {fold_num}. Error: {e}")

            y_proba = model.predict_proba(X_test_fold)[:, 1] if hasattr(model, 'predict_proba') else None

            if y_proba is not None:
                threshold = getattr(model, 'probability_threshold', getattr(model, 'threshold', 0.5))
                y_pred = (y_proba >= threshold).astype(int)
            else:
                y_pred = model.predict(X_test_fold)
                
            fold_metric_results = self.__calculate_all_metrics(y_test_fold, y_pred, y_proba)
            all_fold_metrics[fold_num] = fold_metric_results
            
            if optimization_metric.lower() == 'auc' and hasattr(model, 'predict_proba'):
                y_pred = model.predict_proba(X_test_fold)[:, 1]
            
            fold_score = check_metric(y_test_fold, pd.Series(y_pred), metric=optimization_metric)
            fold_performances.append({
                'fold': fold_num,
                'model': model,
                'experiment': fold_exp,
                'score': fold_score,
                'test_indices': test_indices
            })
            trained_models.append(model)

        overall_metrics, log_metrics = self.__calculate_overall_metrics(all_fold_metrics)
        custom_logger = pycaret_exp.get_config('logging_param').loggers[0]
        custom_logger.log_metrics(log_metrics)

        # Code generation
        self.CodeHandler.add_line("code", f"\n# Training and evaluating models for {len(folds)} folds")
        self.CodeHandler.add_line("code", f"for fold_data in folds:")
        self.CodeHandler.add_line("code", f"fold_num = fold_data['fold']", indent=1)
        self.CodeHandler.add_line("code", f"train_indices = fold_data['train_indices']", indent=1)
        self.CodeHandler.add_line("code", f"test_indices = fold_data['test_indices']", indent=1)
        self.CodeHandler.add_line("code", f"X_train_fold = X_processed.iloc[train_indices]", indent=1)
        self.CodeHandler.add_line("code", f"y_train_fold = y_processed.iloc[train_indices]", indent=1)
        self.CodeHandler.add_line("code", f"X_test_fold = X_processed.iloc[test_indices]", indent=1)
        self.CodeHandler.add_line("code", f"y_test_fold = y_processed.iloc[test_indices]", indent=1)
        self.CodeHandler.add_line("code", f"# Setup PyCaret experiment for the fold", indent=1)
        self.CodeHandler.add_line("code", f"fold_exp = copy.deepcopy(pycaret_exp)", indent=1)
        self.CodeHandler.add_line("code", f"fold_exp.setup(data=pd.concat([X_train_fold, y_train_fold], axis=1), test_data=pd.concat([X_test_fold, y_test_fold]," \
            f" axis=1), log_experiment=False, index=False, **{final_setup_kwargs})", indent=1)
        self.CodeHandler.add_line("code", f"# Create and fit model", indent=1)
        self.CodeHandler.add_line("code", f"model = fold_exp.create_model(verbose=False, {self.CodeHandler.convert_dict_to_params(ml_settings)})", indent=1)
        self.CodeHandler.add_line("code", f"# This is only for logging purposes", indent=1)
        self.CodeHandler.add_line("code", f"_ = pycaret_exp.create_model(verbose=False, {self.CodeHandler.convert_dict_to_params(ml_settings)})", indent=1)
        if self.isTuningEnabled:
            self.CodeHandler.add_line("code", f"model = fold_exp.tune_model(model, {self.CodeHandler.convert_dict_to_params(self.settingsTuning)})", indent=1)
        if self.ensembleEnabled:
            self.CodeHandler.add_line("code", f"model = fold_exp.ensemble_model(model, {self.CodeHandler.convert_dict_to_params(self.settingsEnsemble)})", indent=1)
        if self.calibrateEnabled:
            self.CodeHandler.add_line("code", f"model = fold_exp.calibrate_model(model, {self.CodeHandler.convert_dict_to_params(self.settingsCalibrate)})", indent=1)
        self.CodeHandler.add_line("code", f"# Making predictions on the test set", indent=1)
        self.CodeHandler.add_line("code", f"y_pred = model.predict(X_test_fold)", indent=1)
        self.CodeHandler.add_line("code", f"# Calculate fold metrics", indent=1)
        self.CodeHandler.add_line("code", f"y_proba = model.predict_proba(X_test_fold)[:, 1] if hasattr(model, 'predict_proba') else None", indent=1)
        self.CodeHandler.add_line("code", f"fold_metric_results = calculate_all_metrics(y_test_fold, y_pred, y_proba)", indent=1)
        self.CodeHandler.add_line("code", f"all_fold_metrics[fold_num] = fold_metric_results", indent=1)
        self.CodeHandler.add_line("code", f"trained_models.append(model)", indent=1)
        self.CodeHandler.add_line("md", "Final Model Training and Overall Metrics Calculation")
        self.CodeHandler.add_line("code", f"\n# Calculating overall metrics across folds")
        self.CodeHandler.add_line("code", f"overall_metrics, log_metrics = calculate_overall_metrics(all_fold_metrics)", indent=0)
        self.CodeHandler.add_line("code", f"print(f\"Overall Metrics: \", overall_metrics)", indent=0)

        if fold_performances:
            try:
                # Final model: rebuild from the best config:
                best_model = pycaret_exp.create_model(**ml_settings)
                self.CodeHandler.add_line("code", f"best_model = pycaret_exp.create_model({self.CodeHandler.convert_dict_to_params(ml_settings)})", indent=0)

                # Tuning
                if self.isTuningEnabled:
                    best_model = pycaret_exp.tune_model(best_model, **self.settingsTuning)
                    self.CodeHandler.add_line("code", f"# Tuning model", indent=0)
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.tune_model(best_model, {self.CodeHandler.convert_dict_to_params(self.settingsTuning)})", indent=0)

                # Ensembling
                if self.ensembleEnabled:
                    best_model = pycaret_exp.ensemble_model(best_model, **self.settingsEnsemble)
                    self.CodeHandler.add_line("code", f"# Ensembling model", indent=0)
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.ensemble_model(best_model, {self.CodeHandler.convert_dict_to_params(self.settingsEnsemble)})", indent=0)

                # Calibration
                if self.calibrateEnabled:
                    best_model = pycaret_exp.calibrate_model(best_model, **self.settingsCalibrate)
                    self.CodeHandler.add_line("code", f"# Calibrating model", indent=0)
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.calibrate_model(best_model, {self.CodeHandler.convert_dict_to_params(self.settingsCalibrate)})", indent=0)

                if self.optimize_threshold:
                    if len(pycaret_exp.get_config('y').unique()) != 2:
                        print("Skipping threshold optimization (multiclass not supported).")
                    elif self.ensembleEnabled:
                        print("Skipping threshold optimization (ensemble not supported).")
                    else:
                        best_model = pycaret_exp.optimize_threshold(best_model, optimize=self.threshold_optimization_metric)
                        self.CodeHandler.add_line(
                            "md",
                            f"Optimized threshold: {getattr(best_model, 'probability_threshold', getattr(best_model, 'threshold', 'not found'))}"
                        )
                        # recalculate metrics using the optimized threshold
                        X_test_final = pycaret_exp.get_config('X_test_transformed')
                        y_test_final = pycaret_exp.get_config('y_test_transformed')
                        overall_metrics = self.__recalculate_metrics_with_threshold(best_model, X_test_final, y_test_final)
                        log_metrics = {k: v['mean'] for k, v in overall_metrics.items()}
                        custom_logger.log_metrics(log_metrics)

                        # Code generation
                        self.CodeHandler.add_line("code", f"# Optimizing model threshold based on {self.threshold_optimization_metric}", indent=0)
                        self.CodeHandler.add_line(
                            "code", 
                            f"best_model = pycaret_exp.optimize_threshold(best_model, optimize='{self.threshold_optimization_metric}')", 
                            indent=0
                        )
                        self.CodeHandler.add_line("code", f"# Recalculating metrics with optimized threshold", indent=0)
                        self.CodeHandler.add_line("code", f"X_test_final = pycaret_exp.get_config('X_test_transformed')", indent=0)
                        self.CodeHandler.add_line("code", f"y_test_final = pycaret_exp.get_config('y_test_transformed')", indent=0)
                        self.CodeHandler.add_line("code", f"overall_metrics = recalculate_metrics_with_threshold(best_model, X_test_final, y_test_final)", indent=0)
                        self.CodeHandler.add_line("code", "print(\"Overall Metrics with optimized threshold: \", overall_metrics)", indent=0)

                if finalize:
                    best_model = pycaret_exp.finalize_model(best_model)
                    self.CodeHandler.add_line("code", f"best_model = pycaret_exp.finalize_model(best_model)", indent=0)

                self.CodeHandler.add_line("code", f"trained_models = [best_model]")
                return {'model': best_model, 'overall_metrics': overall_metrics}
            except Exception as e:
                raise ValueError(f"Failed to fit the best model on the entire dataset. Error: {e}")
        else:
            raise ValueError("No fold performances were recorded. Check the training process.")

    def __handle_splitted_data(self, experiment: dict, settings: dict, **kwargs) -> None:

        final_setup_kwargs = kwargs.get("final_setup_kwargs", {})
        iteration_data = kwargs["split_indices"]
        pycaret_exp = experiment['pycaret_exp']
        finalize = kwargs.get("finalize", False)
        overall_metrics = {}

        try:
            if self.type != 'train_model':
                raise ValueError(f"Something went wrong, the type of the node is {self.type}, but it should be 'train_model'.")
            settings.update(self.config_json['data']['estimator']['settings'])
            
            import ast

            if "hidden_layer_sizes" in settings:
                val = settings["hidden_layer_sizes"]
                if isinstance(val, str) and val.startswith("(") and val.endswith(")"):
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

        trained_model = None
        if split_type == "cross_validation":
            if 'estimator' in settings:
                if model_to_evaluate != settings['estimator']:
                    raise ValueError(f"Model ID {model_to_evaluate} does not match the estimator in settings.")
            else:
                settings['estimator'] = model_to_evaluate
                self.CodeHandler.add_line("code", f"# Training model: {model_to_evaluate}")

            trained_model = pycaret_exp.create_model(**settings)
            self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.create_model({self.CodeHandler.convert_dict_to_params(settings)})]")

            if self.isTuningEnabled:
                if self.useTuningGrid and self.model_id in list(self.config_json['data']['internal'].keys()) and 'custom_grid' in list(self.config_json['data']['internal'][self.model_id].keys()):
                    raw_grid = self.config_json['data']['internal'][self.model_id]['custom_grid']
                    self.settingsTuning['custom_grid'] = sanitize_custom_grid(raw_grid)

                    if "hidden_layer_sizes" in self.settingsTuning['custom_grid']:
                        val = self.settingsTuning['custom_grid']["hidden_layer_sizes"]
                        if isinstance(val, list):
                            for i in range(len(val)):
                                if isinstance(val[i], str) and val[i].startswith("(") and val[i].endswith(")"):
                                    try:
                                        val[i] = list(ast.literal_eval(val[i]))
                                    except Exception as e:
                                        raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val[i]}") from e
                        if isinstance(val, str) and val.startswith("(") and val.endswith(")"):
                            try:
                                self.settingsTuning['custom_grid']["hidden_layer_sizes"] = list(ast.literal_eval(val))
                            except Exception as e:
                                raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val}") from e
                
                try:
                    trained_model = pycaret_exp.tune_model(trained_model, **self.settingsTuning)
                except Exception as e:
                    print(f"Warning: Failed to tune model with settings {self.settingsTuning}. Error: {e} \
                          Attempting to tune with less CPUs.")
                    pycaret_exp.set_config('n_jobs_param', 5)
                    trained_model = pycaret_exp.tune_model(trained_model, **self.settingsTuning)

                if self.useTuningGrid:
                    self.CodeHandler.add_line(
                        "code",
                        f"trained_models = [pycaret_exp.tune_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsTuning)})]"
                    )
                else:
                    self.CodeHandler.add_line(
                        "code",
                        f"trained_models = [pycaret_exp.tune_model('{self.config_json['data']['estimator']['type']}', optimize='{self.settingsTuning.get('optimize','Accuracy')}')]"
                    )

            if self.ensembleEnabled:
                trained_model = pycaret_exp.ensemble_model(trained_model, **self.settingsEnsemble)
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.ensemble_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsEnsemble)})]")

            if self.calibrateEnabled:
                trained_model = pycaret_exp.calibrate_model(trained_model, **self.settingsCalibrate)
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.calibrate_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsCalibrate)})]")

            if self.optimize_threshold:
                if len(pycaret_exp.get_config('y').unique()) != 2:
                    print("Skipping threshold optimization (multiclass not supported).")
                elif self.ensembleEnabled:
                    print("Skipping threshold optimization (ensemble not supported).")
                else:
                    trained_model = pycaret_exp.optimize_threshold(
                        trained_model,
                        optimize=self.threshold_optimization_metric
                    )
                    self.CodeHandler.add_line(
                        "code",
                        f"trained_models = [pycaret_exp.optimize_threshold(trained_models[0], optimize='{self.threshold_optimization_metric}')]"
                    )
                    self.CodeHandler.add_line(
                        "md",
                        f"Optimized threshold: {getattr(trained_model, 'probability_threshold', getattr(trained_model, 'threshold', 'not found'))}"
                    )

            if finalize:
                trained_model = pycaret_exp.finalize_model(trained_model)
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.finalize_model(trained_models[0])]")
            
            # Get final metrics from pycaret_exp.pull() (pre-threshold metrics)
            final_metrics = pycaret_exp.pull().to_dict(orient='records')
            for fold in final_metrics[:-2]:
                for metric in list(fold.keys()):
                    if metric not in list(overall_metrics.keys()):
                        overall_metrics[metric] = []
                    overall_metrics[metric].append(fold[metric])
            
            for metric in list(overall_metrics.keys()):
                overall_metrics[metric] = {
                    'mean': round(float(np.mean(overall_metrics[metric])), 3),
                    'median': round(float(np.median(overall_metrics[metric])), 3),
                    'std': round(float(np.std(overall_metrics[metric])), 3),
                    'min': round(float(np.min(overall_metrics[metric])), 3),
                    'max': round(float(np.max(overall_metrics[metric])), 3),
                }

            # if threshold was optimized, recalculate metrics using the optimized threshold
            # __recalculate_metrics_with_threshold now reads probability_threshold correctly
            if self.optimize_threshold and len(pycaret_exp.get_config('y').unique()) == 2 and not self.ensembleEnabled:
                X_test_final = pycaret_exp.get_config('X_test_transformed')
                y_test_final = pycaret_exp.get_config('y_test_transformed')
                overall_metrics = self.__recalculate_metrics_with_threshold(trained_model, X_test_final, y_test_final)

                # Code generation
                self.CodeHandler.add_line("code", f"# Recalculating overall metrics with optimized threshold", indent=0)
                self.CodeHandler.add_line("code", f"X_test_final = pycaret_exp.get_config('X_test_transformed')", indent=0)
                self.CodeHandler.add_line("code", f"y_test_final = pycaret_exp.get_config('y_test_transformed')", indent=0)
                self.CodeHandler.add_line("code", f"overall_metrics = recalculate_metrics_with_threshold(trained_models[0], X_test_final, y_test_final)", indent=0)

            return {'model': trained_model, 'overall_metrics': overall_metrics}
        else:
            X_processed = pycaret_exp.get_config('X_transformed')
            y_processed = pycaret_exp.get_config('y_transformed')

            self.CodeHandler.add_line("code", "# Retrieve processed data from PyCaret")
            self.CodeHandler.add_line("code", f"X_processed = pycaret_exp.get_config('X_transformed')")
            self.CodeHandler.add_line("code", f"y_processed = pycaret_exp.get_config('y_transformed')")

            results = self.__custom_train_and_evaluate(
                pycaret_exp, 
                folds, 
                X_processed, 
                y_processed, 
                finalize,
                final_setup_kwargs,
                **settings
            )
        return results

    # Define custom metrics
    def specificity(self, y_true, y_pred):
        """Specificity (True Negative Rate)"""
        cm = confusion_matrix(y_true, y_pred)
        if cm.shape == (2, 2):
            tn, fp, fn, tp = cm.ravel()
            return tn / (tn + fp) if (tn + fp) > 0 else 0
        return 0

    def specificity_to_notebook(self):
        self.CodeHandler.add_line("code", "def specificity(y_true, y_pred):", indent=0)
        self.CodeHandler.add_line("code", "cm = confusion_matrix(y_true, y_pred)", indent=1)
        self.CodeHandler.add_line("code", "if cm.shape == (2, 2):", indent=1)
        self.CodeHandler.add_line("code", "tn, fp, fn, tp = cm.ravel()", indent=2)
        self.CodeHandler.add_line("code", "return tn / (tn + fp) if (tn + fp) > 0 else 0", indent=2)
        self.CodeHandler.add_line("code", "return 0", indent=1)

    def balanced_accuracy(self, y_true, y_pred):
        """Balanced Accuracy"""
        sensitivity = recall_score(y_true, y_pred, zero_division=0)
        specificity = self.specificity(y_true, y_pred)
        return (sensitivity + specificity) / 2

    def npv(self, y_true, y_pred):
        """Negative Predictive Value"""
        cm = confusion_matrix(y_true, y_pred)
        if cm.shape == (2, 2):
            tn, fp, fn, tp = cm.ravel()
            return tn / (tn + fn) if (tn + fn) > 0 else 0
        return 0

    def npv_to_notebook(self):
        self.CodeHandler.add_line("code", "def npv(y_true, y_pred):", indent=0)
        self.CodeHandler.add_line("code", "cm = confusion_matrix(y_true, y_pred)", indent=1)
        self.CodeHandler.add_line("code", "if cm.shape == (2, 2):", indent=1)
        self.CodeHandler.add_line("code", "tn, fp, fn, tp = cm.ravel()", indent=2)
        self.CodeHandler.add_line("code", "return tn / (tn + fn) if (tn + fn) > 0 else 0", indent=2)
        self.CodeHandler.add_line("code", "return 0", indent=1)

    def youden_index(self, y_true, y_pred):
        """
        Youden's J statistic.
        PyCaret calls score_func(y_true, y_pred_binary) at each threshold step
        during optimize_threshold. Using roc_curve here was incorrect.
        """
        return recall_score(y_true, y_pred, zero_division=0) + self.specificity(y_true, y_pred) - 1

    def mcc(self, y_true, y_pred):
        """Matthews Correlation Coefficient"""
        return matthews_corrcoef(y_true, y_pred)

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        print(Fore.BLUE + "=== fit === " + Fore.YELLOW + f"({self.username})" + Fore.RESET)
        print(Fore.CYAN + f"Using {self.type}" + Fore.RESET)
        
        try:
            experiment['pycaret_exp'].add_metric(id='specificity', name='Specificity', score_func=self.specificity)
        except Exception as e:
            print(Fore.RED + f"Specificity already exists. Error message: {e}" + Fore.RESET)
        try:
            experiment['pycaret_exp'].add_metric(id='BAC', name='Balanced Accuracy', score_func=self.balanced_accuracy)
        except Exception as e:
            print(Fore.RED + f"Balanced Accuracy already exists. Error message: {e}" + Fore.RESET)
        try:
            experiment['pycaret_exp'].add_metric(id='npv', name='NPV', score_func=self.npv)
        except Exception as e:
            print(Fore.RED + f"NPV already exists. Error message: {e}" + Fore.RESET)
        try:
            experiment['pycaret_exp'].add_metric(id='Youden', name="Youden Index", score_func=self.youden_index)
        except Exception as e:
            print(Fore.RED + f"Youden Index already exists. Error message: {e}" + Fore.RESET)
        try:
            experiment['pycaret_exp'].add_metric(id='MCC', name='MCC', score_func=self.mcc)
        except Exception as e:
            print(Fore.RED + f"MCC already exists. Error message: {e}" + Fore.RESET)

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
                self.CodeHandler.add_line("code", "trained_models = [trained_models]")

        elif self.type == 'train_model':
            settings.update(self.config_json['data']['estimator']['settings'])
            
            import ast

            if "hidden_layer_sizes" in settings:
                val = settings["hidden_layer_sizes"]
                if isinstance(val, str) and val.startswith("(") and val.endswith(")"):
                    try:
                        settings["hidden_layer_sizes"] = ast.literal_eval(val)
                    except Exception as e:
                        raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val}") from e

            settings.update({'estimator': self.config_json['data']['estimator']['type']})
            trained_models = [experiment['pycaret_exp'].create_model(**settings)]
            self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.create_model({self.CodeHandler.convert_dict_to_params(settings)})]")
            if self.isTuningEnabled:
                if self.useTuningGrid and self.model_id in list(self.config_json['data']['internal'].keys()) and 'custom_grid' in list(self.config_json['data']['internal'][self.model_id].keys()):
                    raw_grid = self.config_json['data']['internal'][self.model_id]['custom_grid']
                    self.settingsTuning['custom_grid'] = sanitize_custom_grid(raw_grid)

                    if "hidden_layer_sizes" in self.settingsTuning['custom_grid']:
                        val = self.settingsTuning['custom_grid']["hidden_layer_sizes"]
                        if isinstance(val, list):
                            for i in range(len(val)):
                                if isinstance(val[i], str) and val[i].startswith("(") and val[i].endswith(")"):
                                    try:
                                        val[i] = list(ast.literal_eval(val[i]))
                                    except Exception as e:
                                        raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val[i]}") from e
                        if isinstance(val, str) and val.startswith("(") and val.endswith(")"):
                            try:
                                self.settingsTuning['custom_grid']["hidden_layer_sizes"] = list(ast.literal_eval(val))
                            except Exception as e:
                                raise ValueError(f"Invalid tuple format for hidden_layer_sizes: {val}") from e

                trained_models = [experiment['pycaret_exp'].tune_model(trained_models[0], **self.settingsTuning)]
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.tune_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsTuning)})]")

            if self.ensembleEnabled:
                trained_models = [experiment['pycaret_exp'].ensemble_model(trained_models[0], **self.settingsEnsemble)]
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.ensemble_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsEnsemble)})]")

            if self.calibrateEnabled:
                trained_models = [experiment['pycaret_exp'].calibrate_model(trained_models[0], **self.settingsCalibrate)]
                self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.calibrate_model(trained_models[0], {self.CodeHandler.convert_dict_to_params(self.settingsCalibrate)})]")

            if self.optimize_threshold:
                if len(experiment['pycaret_exp'].get_config('y').unique()) != 2:
                    print("Skipping threshold optimization (multiclass not supported).")
                elif self.ensembleEnabled:
                    print("Skipping threshold optimization (ensemble not supported).")
                else:
                    trained_models = [experiment['pycaret_exp'].optimize_threshold(trained_models[0], optimize=self.threshold_optimization_metric)]
                    self.CodeHandler.add_line("code", f"trained_models = [pycaret_exp.optimize_threshold(trained_models[0], optimize='{self.threshold_optimization_metric}')]")
                    self.CodeHandler.add_line(
                        "md",
                        f"Optimized threshold: {getattr(trained_models[0], 'probability_threshold', getattr(trained_models[0], 'threshold', 'not found'))}"
                    )
                    # recalculate metrics using the optimized threshold
                    X_test_final = experiment['pycaret_exp'].get_config('X_test_transformed')
                    y_test_final = experiment['pycaret_exp'].get_config('y_test_transformed')
                    trained_models_json['overall_metrics'] = self.__recalculate_metrics_with_threshold(
                        trained_models[0], X_test_final, y_test_final
                    )

            if finalize:
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
