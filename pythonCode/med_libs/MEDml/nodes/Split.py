import json
from typing import Union

import numpy as np
import pandas as pd

from .NodeObj import *

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class Split(Node):
    """
    This class represents the Split node, handling outer and optional inner splits
    using various strategies such as:

    Outer split methods:
    - Cross-validation
    - Random subsampling
    - Bootstrapping (with optional 0.632 correction)
    - User-defined indices

    Inner split methods (applied on each outer train set):
    - Cross-validation
    - Random subsampling
    - Bootstrapping
    - User-defined indices

    The function returns both outer and inner splits structured by iterations and folds.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        # Initialize base Node class with ID and global config
        super().__init__(id_, global_config_json)

    def _apply_inner_split(self, result_dict, dataset, target, outer_train_idx, random_state):
        """Apply inner split strategy on the outer training set."""
        inner_split_type = self.settings.get('inner_split_type', None)
        if not inner_split_type:
            return result_dict

        # Import necessary module
        from sklearn.model_selection import KFold, StratifiedKFold, train_test_split
        inner_settings = self.settings.get('inner', {}).get(inner_split_type, {})

        inner_splits = []
        train_data = dataset.iloc[outer_train_idx]
        n_inner = len(train_data)

        # Handle different split types
        if inner_split_type == "cross_validation":
            folds = inner_settings.get("num_folds", 5)
            stratify = inner_settings.get("stratify", False)
            y_inner = train_data[target].values if stratify and isinstance(target, str) else target if stratify else None

            splitter = StratifiedKFold(n_splits=folds, shuffle=True, random_state=random_state) if stratify else KFold(n_splits=folds, shuffle=True, random_state=random_state)
            for fold_idx, (i_train, i_val) in enumerate(splitter.split(train_data if not stratify else np.zeros(n_inner), y_inner)):
                inner_splits.append({
                    "fold": fold_idx + 1,
                    "inner_train_indices": i_train.tolist(),
                    "inner_validation_indices": i_val.tolist()
                })

        elif inner_split_type == "random_sub_sampling":
            test_size = float(json.loads(inner_settings.get("test_size", 0.2)))
            y_inner = train_data[target].values if inner_settings.get("stratify", False) and isinstance(target, str) else None
            inner_train, inner_val = train_test_split(
                np.arange(n_inner),
                test_size=test_size,
                shuffle=True,
                stratify=y_inner,
                random_state=random_state
            )
            inner_splits.append({
                "inner_train_indices": inner_train.tolist(),
                "inner_validation_indices": inner_val.tolist()
            })

        elif inner_split_type == "bootstrapping":
            train_size = float(inner_settings.get("train_size", 1.0))
            use_632 = bool(inner_settings.get("use_bootstrap_632", True))
            if use_632:
                train_size = 0.632
            n_train_inner = int(n_inner * train_size)
            rng = np.random.default_rng(random_state)
            inner_train = rng.choice(n_inner, size=n_train_inner, replace=True)
            inner_val = np.setdiff1d(np.arange(n_inner), np.unique(inner_train))
            inner_splits.append({
                "inner_train_indices": inner_train.tolist(),
                "inner_validation_indices": inner_val.tolist()
            })

        elif inner_split_type == "user_defined":
            train_idx = inner_settings.get("train_indices", [])
            val_idx = inner_settings.get("test_indices", [])
            if not train_idx or not val_idx:
                raise ValueError("User-defined inner split requires both 'train_indices' and 'test_indices'.")
            inner_splits.append({
                "inner_train_indices": train_idx,
                "inner_validation_indices": val_idx
            })

        result_dict["inner_splits"] = inner_splits
        
        return result_dict
    
    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        Executes the split node logic.

        Applies an outer split strategy on the full dataset, then for each outer train set,
        optionally applies an inner split strategy.

        Supported outer strategies:
        - cross_validation
        - random_sub_sampling
        - bootstrapping
        - user_defined

        Supported inner strategies:
        - cross_validation
        - random_sub_sampling
        - bootstrapping
        - user_defined

        Returns:
            dict: Result containing outer and inner split indices for all iterations.
        """
        print("======= Split =======")

        # Extract parameters 
        dataset = kwargs.get("dataset", None)
        target = kwargs.get("target", None)
        n_iterations = self.settings['global']['n_iterations']
        shuffle = bool(self.settings['global']['shuffle'])
        random_state = self.settings['global']['random_state']
        split_type = self.settings['outer_split_type']

        # Check if input dataset is valid
        if dataset is None:
            raise ValueError("No dataframe provided for splitting.")

        if not isinstance(dataset, pd.DataFrame):
            try:
                dataset = pd.DataFrame(dataset)
            except Exception as e:
                raise ValueError(f"Failed to convert input to DataFrame: {e}")

        # Initialize results list for all iterations
        split_indices_all_iterations: List[Dict[str, Any]] = []

        # Loop over each iteration
        for i in range(n_iterations):
            print(f"\n Iteration {i + 1}/{n_iterations}")

            # Use a different random seed per iteration
            current_random_state = random_state + i if random_state is not None else None

            iteration_result: Dict[str, Any] = {'iteration': i + 1}
            
            # Handle different split types
            # OUTER: CROSS-VALIDATION
            if split_type.lower() == "cross_validation":

                # Import necessary module
                from sklearn.model_selection import KFold, StratifiedKFold

                # Total number of samples
                n_samples = len(dataset)

                # Number of folds
                cv_folds = self.settings['outer']['cross_validation']['num_folds']
                stratify = bool(self.settings['outer']['cross_validation']['stratify'])

                # Validate number of folds
                if cv_folds < 2 or cv_folds > n_samples:
                    raise ValueError(f"Number of folds ({cv_folds}) must be between 2 and n_samples ({n_samples}).")

                folds_data = []
                if stratify and target is not None:
                    y = dataset[target].values if isinstance(target, str) else target
                    splitter = StratifiedKFold(n_splits=cv_folds, shuffle=shuffle, random_state=current_random_state)
                    fold_generator = splitter.split(np.zeros(n_samples), y)
                else:
                    splitter = KFold(n_splits=cv_folds, shuffle=shuffle, random_state=current_random_state)
                    fold_generator = splitter.split(dataset)

                for fold, (train_idx, test_idx) in enumerate(fold_generator):
                    fold_result = {
                        'fold': fold + 1,
                        'train_indices': train_idx.tolist(),
                        'test_indices': test_idx.tolist(),
                    }
                    # INNER split on outer train
                    fold_result = self._apply_inner_split(fold_result, dataset, target, train_idx, current_random_state)
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
                stratify = bool(self.settings['outer']['random_sub_sampling']['stratify'])

                # Validate test size
                if not (0 < test_size < 1):
                    raise ValueError(f"test_size ({test_size}) must be between 0 and 1 exclusively.")

                y = dataset[target].values if stratify and isinstance(target, str) else target if stratify else None

                train_idx, test_idx = train_test_split(
                    np.arange(n_samples),
                    test_size=test_size,
                    random_state=current_random_state,
                    shuffle=shuffle,
                    stratify=y
                )

                # Update iteration data
                iteration_result['type'] = 'random_sub_sampling'
                iteration_result['train_indices'] = train_idx.tolist()
                iteration_result['test_indices'] = test_idx.tolist()
                iteration_result = self._apply_inner_split(iteration_result, dataset, target, train_idx, current_random_state)

            # OUTER: BOOTSTRAPPING
            elif split_type.lower() == "bootstrapping":

                # Total number of samples and other parameters
                n_samples = len(dataset)
                bootstrap_settings = self.settings['outer']['bootstrapping']
                use_632 = bool(bootstrap_settings.get('use_bootstrap_632', True))
                train_size = 0.632 if use_632 else float(bootstrap_settings.get('train_size', 1.0))

                # default_rng to handle the random state for bootstrapping
                # Bootstrap splits using the choice method from numpy
                n_train = int(n_samples * train_size)
                rng = np.random.default_rng(current_random_state)
                train_idx = rng.choice(n_samples, size=n_train, replace=True)
                test_idx = np.setdiff1d(np.arange(n_samples), np.unique(train_idx))

                # Update iteration data
                iteration_result['type'] = 'bootstrap_0.632' if use_632 else 'bootstrapping'
                iteration_result['train_indices'] = train_idx.tolist()
                iteration_result['test_indices'] = test_idx.tolist()
                iteration_result = self._apply_inner_split(iteration_result, dataset, target, train_idx, current_random_state)

            # OUTER: USER DEFINED
            elif split_type.lower() == "user_defined" and i == 0:
                train_idx = self.settings['outer']['user_defined']['train_indices']
                test_idx = self.settings['outer']['user_defined']['test_indices']

                # Validate user indices are within range
                if max(train_idx + test_idx) >= len(dataset) or min(train_idx + test_idx) < 0:
                    raise ValueError("Provided indices are out of range for the dataframe.")
                if set(train_idx).intersection(set(test_idx)):
                    return {"error": "Warning: Overlapping indices detected in train and test sets"}

                iteration_result['type'] = 'user_defined'
                iteration_result['train_indices'] = train_idx
                iteration_result['test_indices'] = test_idx
                iteration_result = self._apply_inner_split(iteration_result, dataset, target, train_idx, current_random_state)

            else:
                raise ValueError(f"Invalid split type: '{split_type}'.")

            split_indices_all_iterations.append(iteration_result)

        # Prepare information for next node in the pipeline
        self._info_for_next_node = {
            "splitted": True,
            "setup_settings": kwargs["setup_settings"],
            "split_indices": split_indices_all_iterations,
            "shuffle": shuffle,
            "table": "dataset",
            "paths": ["path"],
        }

        return {
            "experiment": experiment,
            "split_indices": split_indices_all_iterations,
            "shuffle": shuffle,
            "table": "dataset",
            "paths": ["path"],
        }
    
