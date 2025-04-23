import json
from typing import Union

import numpy as np
import pandas as pd

from .NodeObj import *

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class Split(Node):
    """
    This class represents the Split node, handling outer splits
    using various strategies such as:

    Outer split methods:
    - Cross-validation
    - Random subsampling
    - Bootstrapping
    - User-defined indices


    The function returns both outer splits structured by iterations and folds.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        # Initialize base Node class with ID and global config
        super().__init__(id_, global_config_json)
    
    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        Executes the split node logic.

        Applies an outer split strategy on the full dataset

        Supported outer strategies:
        - cross_validation
        - random_sub_sampling
        - bootstrapping
        - user_defined

        Returns:
            dict: Result containing outer split indices for all iterations.
        """
        print("======= Split =======")

        # Extract parameters 
        dataset = kwargs.get("dataset", None)
        target = kwargs.get("target", None)
        random_state = int(self.settings['global']['random_state'])
        stratify = bool(self.settings['global']['stratify'])
        split_type = self.settings['outer_split_type']
        use_pycarets_default = bool(self.settings['use_pycarets_default'])

        # Check if input dataset is valid
        if dataset is None:
            raise ValueError("No dataframe provided for splitting.")

        if not isinstance(dataset, pd.DataFrame):
            try:
                dataset = pd.DataFrame(dataset)
            except Exception as e:
                raise ValueError(f"Failed to convert input to DataFrame: {e}")
        
        if use_pycarets_default:
            return {
                "splitted": False,
                "experiment": experiment,
                "random_state": random_state,
                "table": "dataset",
                "paths": ["path"],
            }

        # Redefine setup
        pycaret_exp = experiment['pycaret_exp']
        medml_logger = experiment['medml_logger']
        cleaning_settings = kwargs["settings"] if 'settings' in kwargs else {}
        pycaret_exp.setup(
            data=experiment['df'] if 'df' in experiment else dataset,
            **kwargs["setup_settings"],
            log_experiment=medml_logger,
            data_split_stratify=stratify,
            log_plots=True,
            log_data=True,
            session_id=random_state,
            **cleaning_settings
        )

        # Initialize results list for all iterations
        iteration_result = {}

        # Handle different split types
        # OUTER: CROSS-VALIDATION
        if split_type.lower() == "cross_validation":

            # Import necessary module
            from sklearn.model_selection import KFold, StratifiedKFold

            # Total number of samples
            n_samples = len(dataset)

            # Number of folds
            cv_folds = self.settings['outer']['cross_validation']['num_folds']

            # Update setup
            pycaret_exp.setup(
                data=experiment['df'],
                **kwargs["setup_settings"],
                log_experiment=medml_logger,
                data_split_stratify=stratify,
                fold_strategy="stratifiedkfold" if stratify else "kfold",
                fold=cv_folds,
                log_plots=True,
                log_data=True,
                session_id=random_state,
                **self.settings
            )

            # Validate number of folds
            if cv_folds < 2 or cv_folds > n_samples:
                raise ValueError(f"Number of folds ({cv_folds}) must be between 2 and n_samples ({n_samples}).")

            folds_data = []
            if stratify and target is not None:
                y = dataset[target].values if isinstance(target, str) else target
                splitter = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
                fold_generator = splitter.split(np.zeros(n_samples), y)
            else:
                splitter = KFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
                fold_generator = splitter.split(dataset)

            for fold, (train_idx, test_idx) in enumerate(fold_generator):
                fold_result = {
                    'fold': fold + 1,
                    'train_indices': train_idx.tolist(),
                    'test_indices': test_idx.tolist(),
                }
                folds_data.append(fold_result)

            # Update iteration data
            iteration_result['type'] = 'cross_validation'
            iteration_result['folds'] = folds_data

        # OUTER: RANDOM SUBSAMPLING
        elif split_type.lower() == "random_sub_sampling":

            # Import necessary module
            from sklearn.model_selection import train_test_split

            # Total number of samples and other parameters
            n_samples = len(dataset)
            test_size = float(self.settings['outer']['random_sub_sampling']['test_size'])
            n_iterations = int(self.settings['outer']['random_sub_sampling']['n_iterations'])
            
            # Validate test size
            if not (0 < test_size < 1):
                raise ValueError(f"test_size ({test_size}) must be between 0 and 1 exclusively.")
            
            # Validate number of iterations
            if n_iterations < 1:
                raise ValueError(f"n_iterations ({n_iterations}) must be at least 1.")
            
            # Initialize results list for multiple iterations
            folds = []
            
            # Generate splits for requested number of iterations
            for iteration in range(n_iterations):
                # Calculate random state for this iteration to ensure reproducibility
                # while having different splits for each iteration
                iteration_random_state = random_state + iteration if random_state is not None else None
                
                # Prepare target for stratification if needed
                y = dataset[target].values if stratify and isinstance(target, str) else target if stratify else None
                
                # Generate the split
                train_idx, test_idx = train_test_split(
                    np.arange(n_samples),
                    test_size=test_size,
                    random_state=iteration_random_state,
                    shuffle=True,
                    stratify=y
                )

                # Update fold data
                fold_data = {
                    'fold': iteration + 1,
                    'train_indices': train_idx.tolist(),
                    'test_indices': test_idx.tolist(),
                }
                folds.append(fold_data)
                
            # Create iteration result dictionary
            iteration_result['type'] = 'random_sub_sampling'
            iteration_result['folds'] = folds

        # OUTER: BOOTSTRAPPING
        elif split_type.lower() == "bootstrapping":

            # Total number of samples and other parameters
            n_samples = len(dataset)
            n_iterations = int(self.settings['outer']['bootstrapping']['n_iterations'])
            train_size = float(self.settings['outer']['bootstrapping']['bootstrap_train_sample_size'])

            # Initialize results list for multiple iterations
            folds = []

            for iteration in range(n_iterations):
                # Calculate random state for this iteration to ensure reproducibility
                iteration_random_state = random_state + iteration if random_state is not None else None

                # Validate train size
                if not (0 < train_size <= 1):
                    raise ValueError(f"train_size ({train_size}) must be between 0 and 1 inclusively.")

                # Generate the bootstrap sample using numpy's default_rng for reproducibility
                rng = np.random.default_rng(random_state)
                train_idx = rng.choice(n_samples, size=int(n_samples * train_size), replace=True)
                test_idx = np.setdiff1d(np.arange(n_samples), np.unique(train_idx))

                # Update fold data
                fold_data = {
                    'fold': iteration + 1,
                    'train_indices': train_idx.tolist(),
                    'test_indices': test_idx.tolist(),
                }
                folds.append(fold_data)

            # Update iteration data
            iteration_result['type'] = 'bootstrapping'
            iteration_result['folds'] = folds

        # OUTER: USER DEFINED
        elif split_type.lower() == "user_defined":
            train_idx = json.loads(self.settings['outer']['user_defined']['train_indices'])
            test_idx = json.loads(self.settings['outer']['user_defined']['test_indices'])

            # Validate user indices are within range
            if max(train_idx + test_idx) >= len(dataset) or min(train_idx + test_idx) < 0:
                raise ValueError("Provided indices are out of range for the dataframe.")
            if set(train_idx).intersection(set(test_idx)):
                return {"error": "Warning: Overlapping indices detected in train and test sets"}

            iteration_result['type'] = 'user_defined'
            iteration_result['train_indices'] = train_idx
            iteration_result['test_indices'] = test_idx

        else:
            raise ValueError(f"Invalid split type: '{split_type}'.")
        
        # Prepare information for next node in the pipeline
        self._info_for_next_node = {
            "splitted": True,
            "random_state": random_state,
            "setup_settings": kwargs["setup_settings"],
            "split_indices": iteration_result,
            "table": "dataset",
            "paths": ["path"],
        }

        return {
            "experiment": experiment,
            "split_indices": iteration_result,
            "table": "dataset",
            "paths": ["path"],
        }
    
