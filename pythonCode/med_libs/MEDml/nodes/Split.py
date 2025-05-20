import json
from typing import Union

import numpy as np
import pandas as pd

from .NodeObj import *

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE    = Union[int, str, list, tuple, np.ndarray, pd.Series]


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

    # ------------------------------------------------------------------ #
    #  Main execution
    # ------------------------------------------------------------------ #
    def _execute(self, experiment: dict = None, **kwargs) -> json:
        print("======= Split =======")

        # ---------- Generic parameters ---------------------------------
        dataset       = kwargs.get("dataset")
        target        = kwargs.get("target")          # single target column (optional)
        random_state  = int(self.settings['global']['random_state'])
        split_type    = self.settings['outer_split_type']
        use_defaults  = bool(self.settings['use_pycarets_default'])

        # ---------- Stratification columns -----------------------------
        stratify_columns = kwargs.get("stratify_columns", [])

        # Fallback: if no list provided, use the single target column
        if not stratify_columns and target:
            stratify_columns = [target]

        # Basic validation
        if not isinstance(stratify_columns, list):
            raise ValueError("stratify_columns must be a list.")

        if dataset is None:
            raise ValueError("No dataframe provided for splitting.")

        if not isinstance(dataset, pd.DataFrame):
            dataset = pd.DataFrame(dataset)

        missing = [c for c in stratify_columns if c not in dataset.columns]
        if missing:
            raise ValueError(f"Stratify columns not in dataset: {missing}")

        use_stratification = bool(stratify_columns)

        # ---------- Early exit when “Use PyCaret default splits” --------
        if use_defaults:
            return {
                "splitted"     : False,
                "experiment"   : experiment,
                "random_state" : random_state,
                "table"        : "dataset",
                "paths"        : ["path"],
            }

        # ---------- PyCaret setup (common) -----------------------------
        pycaret_exp       = experiment['pycaret_exp']
        medml_logger      = experiment['medml_logger']
        cleaning_settings = kwargs.get("settings", {})

        pycaret_exp.setup(
            data=experiment.get('df', dataset),
            **kwargs["setup_settings"],
            log_experiment=medml_logger,
            data_split_stratify=stratify_columns,
            fold_strategy="stratifiedkfold" if use_stratification else "kfold",
            log_plots=True,
            log_data=True,
            session_id=random_state,
            **cleaning_settings
        )

        iteration_result = {}  # final output container

        # ===============================================================
        #  OUTER: CROSS-VALIDATION
        # ===============================================================
        if split_type.lower() == "cross_validation":
            from sklearn.model_selection import KFold, StratifiedKFold

            n_samples = len(dataset)
            cv_folds  = self.settings['outer']['cross_validation']['num_folds']

            # Re-setup to pass explicit fold count
            excluded = ["use_pycarets_default", "outer_split_type",
                        "inner_split_type", "outer", "inner", "global"]
            filtered_settings = {k: v for k, v in self.settings.items()
                                 if k not in excluded}

            pycaret_exp.setup(
                data=experiment.get('df', dataset),
                **kwargs["setup_settings"],
                log_experiment=medml_logger,
                data_split_stratify=stratify_columns,
                fold_strategy="stratifiedkfold" if use_stratification else "kfold",
                fold=cv_folds,
                log_plots=True,
                log_data=True,
                session_id=random_state,
                **filtered_settings
            )

            if cv_folds < 2 or cv_folds > n_samples:
                raise ValueError(f"num_folds ({cv_folds}) must be between 2 and {n_samples}")

            # Build the fold generator
            if use_stratification:
                if len(stratify_columns) == 1:
                    y = dataset[stratify_columns[0]].values
                else:
                    y = dataset[stratify_columns].astype(str).agg('-'.join, axis=1).values
                splitter = StratifiedKFold(n_splits=cv_folds, shuffle=True,
                                           random_state=random_state)
                fold_iter = splitter.split(np.zeros(n_samples), y)
            else:
                splitter  = KFold(n_splits=cv_folds, shuffle=True,
                                  random_state=random_state)
                fold_iter = splitter.split(dataset)

            folds = [{
                'fold'         : i,
                'train_indices': tr.tolist(),
                'test_indices' : te.tolist()
            } for i, (tr, te) in enumerate(fold_iter, start=1)]

            iteration_result = {"type": "cross_validation", "folds": folds}

        # ===============================================================
        #  OUTER: RANDOM SUB-SAMPLING
        # ===============================================================
        elif split_type.lower() == "random_sub_sampling":
            from sklearn.model_selection import train_test_split

            n_samples    = len(dataset)
            test_size    = float(self.settings['outer']['random_sub_sampling']['test_size'])
            n_iterations = int(self.settings['outer']['random_sub_sampling']['n_iterations'])

            if not (0 < test_size < 1):
                raise ValueError("test_size must be in (0,1)")
            if n_iterations < 1:
                raise ValueError("n_iterations must be ≥ 1")

            folds = []
            for it in range(n_iterations):
                rs = random_state + it if random_state is not None else None

                if use_stratification:
                    if len(stratify_columns) == 1:
                        y = dataset[stratify_columns[0]].values
                    else:
                        y = dataset[stratify_columns].astype(str).agg('-'.join, axis=1).values
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
                    'fold'         : it + 1,
                    'train_indices': tr.tolist(),
                    'test_indices' : te.tolist(),
                })

            iteration_result = {"type": "random_sub_sampling", "folds": folds}

        # ===============================================================
        #  OUTER: BOOTSTRAPPING
        # ===============================================================
        elif split_type.lower() == "bootstrapping":
            n_samples    = len(dataset)
            n_iterations = int(self.settings['outer']['bootstrapping']['n_iterations'])
            train_size   = float(self.settings['outer']['bootstrapping']['bootstrap_train_sample_size'])

            if not (0 < train_size <= 1):
                raise ValueError("train_size must be in (0,1]")

            rng   = np.random.default_rng(random_state)
            folds = []

            for it in range(n_iterations):
                tr_idx = rng.choice(n_samples, size=int(n_samples * train_size), replace=True)
                te_idx = np.setdiff1d(np.arange(n_samples), np.unique(tr_idx))

                folds.append({
                    'fold'         : it + 1,
                    'train_indices': tr_idx.tolist(),
                    'test_indices' : te_idx.tolist(),
                })

            iteration_result = {"type": "bootstrapping", "folds": folds}

        # ===============================================================
        #  OUTER: USER-DEFINED
        # ===============================================================
        elif split_type.lower() == "user_defined":
            tr_idx = json.loads(self.settings['outer']['user_defined']['train_indices'])
            te_idx = json.loads(self.settings['outer']['user_defined']['test_indices'])

            if max(tr_idx + te_idx) >= len(dataset) or min(tr_idx + te_idx) < 0:
                raise ValueError("User indices out of dataset range.")
            if set(tr_idx) & set(te_idx):
                return {"error": "Overlapping indices in train and test sets."}

            iteration_result = {
                "type"         : "user_defined",
                "train_indices": tr_idx,
                "test_indices" : te_idx
            }

        else:
            raise ValueError(f"Invalid split type: {split_type}")

        # ------------------------------------------------------------------
        #  Payload for next node
        # ------------------------------------------------------------------
        self._info_for_next_node = {
            "splitted"        : True,
            "random_state"    : random_state,
            "setup_settings"  : kwargs["setup_settings"],
            "split_indices"   : iteration_result,
            "table"           : "dataset",
            "paths"           : ["path"],
            "stratify_columns": stratify_columns,
        }

        return {
            "experiment"      : experiment,
            "split_indices"   : iteration_result,
            "table"           : "dataset",
            "paths"           : ["path"],
            "stratify_columns": stratify_columns
        }
