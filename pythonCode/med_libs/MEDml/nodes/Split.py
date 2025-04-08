import json
from typing import Union

import numpy as np
import pandas as pd

from .NodeObj import *

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class Split(Node):
    """
    This class represents the Split node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json. 
        """
        super().__init__(id_, global_config_json)

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node to split data using one of three methods:
        1. Cross validation
        2. Random subsampling
        3. User defined

        Args:
            experiment (dict): The experiment dictionary.
            **kwargs: Additional arguments.

        Returns:
            json: A dictionary containing experiment details and split information.
        """
        print("======= Split =======")

        # Extract parameters
        dataset = kwargs.get("dataset", None)
        target = kwargs.get("target", None)
        n_iterations = self.settings['global']['n_iterations']
        shuffle = bool(self.settings['global']['shuffle'])
        random_state = self.settings['global']['random_state']
        split_type = self.settings['outer_split_type']
        
        # Check if dataframe is valid
        if dataset is None:
            raise ValueError("No dataframe provided for splitting.")
        
        if not isinstance(dataset, pd.DataFrame):
            try:
                dataset = pd.DataFrame(dataset)
            except Exception as e:
                raise ValueError(f"Failed to convert input to DataFrame: {e}")
        
        # Initialize results list for all iterations
        split_indices_all_iterations: List[Dict[str, Any]] = [] 

        # Perform Splitting for each iteration
        for i in range(n_iterations):
            print(f"\n Iteration {i + 1}/{n_iterations}")
            
            # Determine random state for this specific iteration
            current_random_state = None
            if random_state is not None:
                # Ensure different state per iteration if base is provided
                current_random_state = random_state + i 
            
            iteration_result: Dict[str, Any] = {'iteration': i + 1} # Store common info
        
            # Handle different split types
            # Cross validation split
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
                    if isinstance(target, str):
                        y = dataset[target].values
                    else:
                        y = target
                    splitter = StratifiedKFold(n_splits=cv_folds, shuffle=shuffle, random_state=current_random_state)
                    fold_generator = splitter.split(np.zeros(n_samples), y) # Use dummy X as split is based on y
                else:
                    splitter = KFold(n_splits=cv_folds, shuffle=shuffle, random_state=current_random_state)
                    fold_generator = splitter.split(dataset) # Can split directly on dataset
                
                for fold, (train_idx, test_idx) in enumerate(fold_generator):
                    folds_data.append({
                        'fold': fold + 1,
                        'train_indices': train_idx.tolist(),
                        'test_indices': test_idx.tolist()
                    })
                
                # Update iteration data
                iteration_result['type'] = 'cross_validation'
                iteration_result['folds'] = folds_data
                
            # Random subsampling split
            elif split_type.lower() == "random_sub_sampling":
                # Import necessary module
                from sklearn.model_selection import train_test_split

                # Total number of samples and other parameters
                n_samples = len(dataset)
                test_size = float(json.loads(self.settings['outer']['random_sub_sampling']['test_size']))
                stratify = json.loads(self.settings['outer']['random_sub_sampling']['stratify'])

                # Validate test size
                if not (0 < test_size < 1):
                    raise ValueError(f"test_size ({test_size}) must be between 0 and 1 exclusively.")
                
                if stratify and target is not None:
                    if isinstance(target, str):
                        y = dataset[target].values
                    else:
                        y = target
                        
                stratify_arg = y if stratify and y is not None else None
                train_idx, test_idx = train_test_split(
                    np.arange(n_samples),
                    test_size=test_size,
                    random_state=current_random_state,
                    shuffle=shuffle,
                    stratify=stratify_arg
                )

                iteration_result['type'] = 'random_sub_sampling'
                iteration_result['train_indices'] = train_idx.tolist()
                iteration_result['test_indices'] = test_idx.tolist()
        
            # Bootstrap split
            elif split_type.lower() == "bootstrap":
                # Todo: Implement bootstrap split logic
                raise NotImplementedError("Bootstrap split is not implemented yet.")
            
            # User defined split
            elif split_type.lower() == "user_defined" and i == 0:
                # Validate user indices are within range
                train_idx = self.settings['outer']['user_defined']['train_indices']
                test_idx = self.settings['outer']['user_defined']['test_indices']
                
                if max(train_idx + test_idx) >= len(dataset) or min(train_idx + test_idx) < 0:
                    raise ValueError("Provided indices are out of range for the dataframe.")
                
                # Check for overlapping indices
                if set(train_idx).intersection(set(test_idx)):
                    return {"error": "Warning: Overlapping indices detected in train and test sets"}
                
                iteration_result['type'] = 'user_defined'
                iteration_result['train_indices'] = train_idx
                iteration_result['test_indices'] = test_idx
            
            elif split_type.lower() == "user_defined" and i > 0:
                break
            
            else:
                raise ValueError(f"Invalid split type: '{split_type}'. Choose from 'cross_validation', 'random_sub_sampling', or 'user_defined'.")
            
            # Append current iteration's result
            split_indices_all_iterations.append(iteration_result)
        
        self._info_for_next_node = {
            "setup_settings": kwargs["setup_settings"], # for Clean node
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
