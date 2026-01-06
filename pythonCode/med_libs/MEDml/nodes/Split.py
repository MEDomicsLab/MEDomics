import json
import random
from copy import deepcopy
from typing import Tuple, Union

import numpy as np
import pandas as pd
from bson import ObjectId
from mongodb_utils import connect_to_mongo
from utils.data_split_utils import (get_bootstrapping_details, get_cv_stratification_details,
                                    get_subsampling_details)

from .NodeObj import *

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]


class Split(Node):
    """
    Outer-split node supporting:

    • Cross-validation
    • Random sub-sampling
    • Bootstrapping
    • User-defined indices
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        super().__init__(id_, global_config_json)
    
    def _build_setup_kwargs(
        self,
        base_kwargs: dict,
        stratify_columns: str,
        ignore_features: Union[str, list],
        random_state: int,
        medml_logger,
        cleaning_settings: dict,
    ) -> Tuple[dict, List[str]]:
        """Strip every UI-only key so setup() never crashes."""
        skw = {
            **base_kwargs,
            "log_experiment": medml_logger,
            "data_split_shuffle": True,
            "session_id": random_state,
            **cleaning_settings,
        }

        # All front‑end keys that pycaret.setup() does NOT understand
        unsupported = (
            "columns",      # placeholder list of columns from UI
            "files",        # uploaded files info
            "useTags",      # boolean switch
            "columnsTags",  # list of column tags
            "rowsTags", 
            "columnsTagsMapped", 
            "rowsTagsMapped" # list of row tags
        )
        for bad_key in unsupported:
            skw.pop(bad_key, None)  # silent remove

        # If user provided explicit ignore features, keep them; otherwise no ignore.
        if ignore_features:
            if isinstance(ignore_features, str):
                ignore_features = [ignore_features]
            elif not isinstance(ignore_features, list):
                raise ValueError("ignore_features must be a list or a string.")
            skw["ignore_features"] = ignore_features

        # If user provided explicit stratification, keep it; otherwise no strat.
        if stratify_columns:
            skw["data_split_stratify"] = stratify_columns
            skw["fold_strategy"] = "stratifiedkfold"
        else:
            skw["fold_strategy"] = "kfold"
        return skw, stratify_columns

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        Main function to execute the node.

        Args:
            experiment (dict): Experiment dictionary containing the dataset and other parameters.
            **kwargs: Additional keyword arguments.

        Returns:
            json: A JSON object containing the split indices and other relevant information.
        """
        print("======= Split =======")

        # Generic parameters
        pycaret_exp = experiment["pycaret_exp"]
        medml_logger = experiment["medml_logger"]
        cleaning_settings = kwargs.get("cleaning_settings", {})
        target = kwargs.get("target")
        stratify_columns = self.settings['global'].get("stratify_columns", [])
        dataset = pycaret_exp.get_config('X').join(pycaret_exp.get_config('y'))
        experiment_df = experiment.get("df", dataset)
        random_state = int(self.settings['global']['random_state'])
        split_type = self.settings['outer_split_type']
        use_tags = bool(self.settings['useTags'])
        stats_df = None

        # Set random seeds
        random.seed(random_state)
        np.random.seed(random_state)

        # Update code handler
        self.CodeHandler.add_import("import random")
        self.CodeHandler.add_line("code", f"# Setting random seeds")
        self.CodeHandler.add_line("code", f"random.seed({random_state})")
        self.CodeHandler.add_line("code", f"np.random.seed({random_state})")

        # Fallback: if no list provided, use the single target column
        if not stratify_columns and target:
            stratify_columns = [target]

        # Basic validation
        if not isinstance(stratify_columns, list):
            if isinstance(stratify_columns, str) or isinstance(stratify_columns, int):
                stratify_columns = [stratify_columns]
            else:
                raise ValueError("stratify_columns must be a list.")

        if dataset is None:
            raise ValueError("No dataframe provided for splitting.")

        if not isinstance(dataset, pd.DataFrame):
            dataset = pd.DataFrame(dataset)

        # Map stratify_columns to DataFrame columns
        missing = [c for c in stratify_columns if c not in dataset.columns or c not in experiment_df.columns]
        if missing:
            raise ValueError(f"Stratify columns not in dataset: {missing}")

        use_stratification = bool(stratify_columns)
        strat_classes_name = stratify_columns[0]

        # Add tags to stratify_columns if use_tags is enabled
        if use_tags:
            # Column tags
            column_tags = self.settings['global'].get("columnsTags", [])
            column_tags_map = self.settings.get("columnsTagsMapped", {})
            if not column_tags or not column_tags_map:
                pass  # No tags to process
            else:
                # add tagged columns to stratify_columns
                for (col, tag) in column_tags_map.items():
                    if set(tag) <= set(column_tags) and col not in stratify_columns:
                        # Check if col is in the DataFrame
                        if col in experiment_df.columns:
                            # check if column is continuous or categorical
                            if experiment_df[col].dtype in [np.float64, np.int64]:
                                unique_values = experiment_df[col].nunique()
                                if unique_values > 2:
                                    raise ValueError(
                                        f"Column {col} is continuous with {unique_values} unique values. "
                                        "Please use the row tagging tool in the input module to define stratification categories for this column."
                                    )
                            stratify_columns.append(col)
                            strat_classes_name += f"_{col}"
                        else:
                            raise ValueError(f"Column {col} not found in DataFrame for tag {tag}.")
            
            # Row tags
            collection_id = self.settings.get("files", None)
            if not collection_id:
                raise ValueError("No collection_id provided in settings for row tags.")
            collection_id = collection_id["id"]
            row_tags = self.settings['global'].get("rowsTags", [])
            row_tags_map = self.settings.get("rowsTagsMapped", {})
            if not row_tags or not row_tags_map:
                pass
            else:
                if not isinstance(experiment_df, pd.DataFrame):
                    experiment_df = pd.DataFrame(experiment_df)
                collection = connect_to_mongo()[collection_id]
                for (row_id, tag) in row_tags_map.items():
                    tag_column_name = f"rowtag_{tag}"
                    if tag in row_tags:
                        # Create the one-hot encoded column for the tag
                        if tag_column_name not in experiment_df.columns:
                            experiment_df[tag_column_name] = 0
                        # Get the document
                        doc = collection.find_one({"_id": ObjectId(row_id)})
                        if doc:
                            # To get the index/position in collection (can be slow on large collections)
                            index = list(collection.find()).index(doc)
                            experiment_df.at[index, tag_column_name] = 1
                            if tag_column_name not in stratify_columns:
                                stratify_columns.append(tag_column_name)
                                strat_classes_name += f"_XTAGX{tag}"
                        else:
                            raise ValueError(f"Document with _id {row_id} not found in collection {collection_id}.")

        # Create a composite column before setup
        if isinstance(stratify_columns, list) and len(stratify_columns) > 1:
            experiment_df['strat_composite'] = experiment_df[stratify_columns[0]].astype(str)
            for col in stratify_columns[1:]:
                experiment_df['strat_composite'] += '_' + experiment_df[col].astype(str)
            experiment['df']['strat_composite'] = experiment_df['strat_composite']
            self.CodeHandler.add_line("code", f"experiment['df']['strat_composite'] = {experiment_df['strat_composite'].to_dict()}")
            dataset['strat_composite'] = experiment_df['strat_composite']
            stratify_columns = 'strat_composite'  # Use the composite column for stratification
            ignore_features = ['strat_composite']
        else:
            ignore_features = []

        # Build the setup kwargs for the first PyCaret setup
        setup_kwargs, stratify_columns = self._build_setup_kwargs(
            base_kwargs=kwargs["setup_settings"],
            stratify_columns=stratify_columns,
            ignore_features=ignore_features,
            random_state=random_state,
            medml_logger=medml_logger,
            cleaning_settings=cleaning_settings,
        )

        # First (global) setup – no unsupported keys left
        if split_type.lower() != "cross_validation":
            pycaret_exp.setup(data=experiment.get("df", dataset), **setup_kwargs)
            code_handler_kwargs = deepcopy(setup_kwargs)
            del code_handler_kwargs['log_experiment']
            self.CodeHandler.add_line("code", f"pycaret_exp.setup(data=pycaret_exp.get_config('data'), {self.CodeHandler.convert_dict_to_params(code_handler_kwargs)})")

        iteration_result = {}  # final output container

        # OUTER: CROSS-VALIDATION
        if split_type.lower() == "cross_validation":
            from sklearn.model_selection import KFold, StratifiedKFold
            self.CodeHandler.add_import("from sklearn.model_selection import KFold, StratifiedKFold")

            n_samples = len(dataset)
            cv_folds = self.settings['outer']['cross_validation']['num_folds']

            # Re-setup to pass explicit fold count
            excluded = [
                "use_pycarets_default", 
                "outer_split_type",
                "inner_split_type",
                "outer", 
                "inner", 
                "global"
            ]
            filtered_settings = { k: v for k, v in cleaning_settings.items() if k not in excluded }

            setup_kwargs, stratify_columns = self._build_setup_kwargs(
                base_kwargs=kwargs["setup_settings"],
                stratify_columns=stratify_columns,
                ignore_features=ignore_features,
                random_state=random_state,
                medml_logger=medml_logger,
                cleaning_settings=filtered_settings,
            )
            setup_kwargs["fold"] = cv_folds
            pycaret_exp.setup(data=experiment.get("df", dataset), **setup_kwargs)
            code_handler_kwargs = deepcopy(setup_kwargs)
            del code_handler_kwargs['log_experiment']
            self.CodeHandler.add_line("code", f"pycaret_exp.setup(data=pycaret_exp.get_config('data'), {self.CodeHandler.convert_dict_to_params(code_handler_kwargs)})")

            if cv_folds < 2 or cv_folds > n_samples:
                raise ValueError(f"num_folds ({cv_folds}) must be between 2 and {n_samples}")

            # Build the fold generator
            if use_stratification:
                y = dataset[stratify_columns].values
                self.CodeHandler.add_line("code", f"y = dataset[{stratify_columns}].values")
                splitter = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
                self.CodeHandler.add_line("code", f"splitter = StratifiedKFold(n_splits={cv_folds}, shuffle=True, random_state={random_state})")
                fold_iter = splitter.split(np.zeros(n_samples), y)
                self.CodeHandler.add_line("code", f"fold_iter = splitter.split(np.zeros({n_samples}), y)")
            else:
                splitter = KFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
                self.CodeHandler.add_line("code", f"splitter = KFold(n_splits={cv_folds}, shuffle=True, random_state={random_state})")
                fold_iter = splitter.split(dataset)
                self.CodeHandler.add_line("code", f"fold_iter = splitter.split(dataset)")
            folds = [{
                'fold' : i,
                'train_indices': tr.tolist(),
                'test_indices' : te.tolist()
            } for i, (tr, te) in enumerate(fold_iter, start=1)]

            iteration_result = {"type": "cross_validation", "folds": folds}

            # Get stratification details
            stats_df = get_cv_stratification_details(
                dataset=dataset,
                stratify_column=stratify_columns,
                class_names=strat_classes_name,
                cv_folds=cv_folds,
                random_state=random_state
            )

        # OUTER: RANDOM SUB-SAMPLING
        elif split_type.lower() == "random_sub_sampling":
            from sklearn.model_selection import train_test_split
            self.CodeHandler.add_import("from sklearn.model_selection import train_test_split")

            n_samples = len(dataset)
            test_size = float(self.settings['outer']['random_sub_sampling']['test_size'])
            n_iterations = int(self.settings['outer']['random_sub_sampling']['n_iterations'])

            # Update code handler with parameters
            self.CodeHandler.add_line("code", f"n_samples = {n_samples}")
            self.CodeHandler.add_line("code", f"test_size = {test_size}")
            self.CodeHandler.add_line("code", f"n_iterations = {n_iterations}")

            if not (0 < test_size < 1):
                raise ValueError("test_size must be in (0,1)")
            if n_iterations < 1:
                raise ValueError("n_iterations must be at least 1")

            folds = []
            for it in range(n_iterations):
                rs = random_state + it if random_state is not None else None

                if use_stratification:
                    y = dataset[stratify_columns].values
                else:
                    y = None

                tr, te = train_test_split(
                    np.arange(n_samples),
                    test_size=test_size,
                    random_state=rs,
                    shuffle=True,
                    stratify=y
                )

                folds.append({
                    'fold' : it + 1,
                    'train_indices': tr.tolist(),
                    'test_indices' : te.tolist(),
                })
            
            self.CodeHandler.add_line("code", f"folds = []")
            self.CodeHandler.add_line("code", f"for it in range({n_iterations}):")
            self.CodeHandler.add_line("code", f"rs = {random_state} + it if {random_state} is not None else None", indent=1)
            if use_stratification:
                self.CodeHandler.add_line("code", f"y = dataset[{stratify_columns}].values", indent=1)
            self.CodeHandler.add_line("code", f"tr, te = train_test_split(np.arange({n_samples}), test_size={test_size}, random_state=rs, shuffle=True, stratify=y)", indent=1)
            self.CodeHandler.add_line("code", f"folds.append({{'fold': it + 1, 'train_indices': tr.tolist(), 'test_indices': te.tolist()}})", indent=1)

            iteration_result = {"type": "random_sub_sampling", "folds": folds}

            # Get stratification details
            stats_df = get_subsampling_details(
                dataset=dataset,
                stratify_columns=stratify_columns,
                class_names=strat_classes_name,
                test_size=test_size,
                n_iterations=n_iterations,
                random_state=random_state
            )

        # OUTER: BOOTSTRAPPING
        elif split_type.lower() == "bootstrapping":
            n_samples = len(dataset)
            n_iterations = int(self.settings['outer']['bootstrapping']['n_iterations'])
            train_size = float(self.settings['outer']['bootstrapping']['bootstrap_train_sample_size'])

            # Update code handler with parameters
            self.CodeHandler.add_line("code", f"n_samples = {n_samples}")
            self.CodeHandler.add_line("code", f"n_iterations = {n_iterations}")
            self.CodeHandler.add_line("code", f"train_size = {train_size}")

            if not (0 < train_size <= 1):
                raise ValueError("train_size must be in (0,1]")

            rng = np.random.default_rng(random_state)
            folds = []

            # Update code handler with parameters
            self.CodeHandler.add_line("code", f"rng = np.random.default_rng({random_state})")
            self.CodeHandler.add_line("code", f"folds = []")

            for it in range(n_iterations):
                tr_idx = rng.choice(n_samples, size=int(n_samples * train_size), replace=True)
                te_idx = np.setdiff1d(np.arange(n_samples), np.unique(tr_idx))

                folds.append({
                    'fold': it + 1,
                    'train_indices': tr_idx.tolist(),
                    'test_indices': te_idx.tolist(),
                })

            # Update code handler with fold generation
            self.CodeHandler.add_line("code", f"for it in range({n_iterations}):")
            self.CodeHandler.add_line("code", f"tr_idx = rng.choice({n_samples}, size=int({n_samples} * {train_size}), replace=True)", indent=1)
            self.CodeHandler.add_line("code", f"te_idx = np.setdiff1d(np.arange({n_samples}), np.unique(tr_idx))", indent=1)
            self.CodeHandler.add_line("code", f"folds.append({{'fold': it + 1, 'train_indices': tr_idx.tolist(), 'test_indices': te_idx.tolist()}})", indent=1)
            
            iteration_result = {"type": "bootstrapping", "folds": folds}

            # Get stratification details
            try:
                if use_stratification:
                    y = dataset[stratify_columns].values
                else:
                    y = None
                stats_df = get_bootstrapping_details(n_samples, strat_classes_name, folds, y)
            except Exception as e:
                print(f"Warning: Could not compute bootstrapping stratification details: {e}")
                stats_df = None

        # OUTER: USER-DEFINED
        elif split_type.lower() == "user_defined":
            tr_idx = json.loads(self.settings['outer']['user_defined']['train_indices'])
            te_idx = json.loads(self.settings['outer']['user_defined']['test_indices'])

            if max(tr_idx + te_idx) >= len(dataset) or min(tr_idx + te_idx) < 0:
                raise ValueError("User indices out of dataset range.")
            if set(tr_idx) & set(te_idx):
                return {"error": "Overlapping indices in train and test sets."}

            iteration_result = {
                "type": "user_defined",
                "train_indices": tr_idx,
                "test_indices" : te_idx
            }

        else:
            raise ValueError(f"Invalid split type: {split_type}")

        # Payload for next node
        self._info_for_next_node = { 
            "splitted": True,
            "random_state": random_state,
            "setup_settings": kwargs["setup_settings"],
            "split_indices": iteration_result,
            "table": "dataset",
            "paths": ["path"],
            "stratify_columns": stratify_columns,
            "final_setup_kwargs": setup_kwargs,
        }

        return {
            "experiment": experiment,
            "split_indices": iteration_result,
            "table": "dataset",
            "paths": ["path"],
            "stratify_columns": stratify_columns,
            "stats_df": stats_df.to_json() if stats_df is not None else None,
        }
