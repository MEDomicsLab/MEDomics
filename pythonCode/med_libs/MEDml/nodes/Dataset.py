import json
import os
import sys
from itertools import chain, combinations
from pathlib import Path
from typing import Union

import numpy as np
import pandas as pd
import pymongo

from ...server_utils import go_print
from .NodeObj import *

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent))
from utils.loading import Loader

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]
FOLDER, FILE, FILES = 1, 2, 3


class Dataset(Node):
    """
    This class represents the Dataset node.
    """

    def __init__(self, id_: int, global_config_json: json) -> None:
        """
        Args:
            id_ (int): The id of the node.
            global_config_json (json): The global config json.
        """
        super().__init__(id_, global_config_json)
        self.df = None
        self._dfs = {}
        self.entry_file_type = None
        self.dfs_combinations = None
        self.output_dataset = {}
        # check if files is a list or a dict
        if isinstance(self.settings['files'], dict):
            """ self.settings['files'] = self.settings['files']['path']
            self.entry_file_type = FOLDER if os.path.isdir(self.settings['files']) else FILE """
            self.entry_file_type = FILE
        else:
            if isinstance(self.settings['files'], list):
                self.entry_file_type = FILES

    def _execute(self, experiment: dict = None, **kwargs) -> json:
        """
        This function is used to execute the node.
        """
        # MongoDB setup
        mongo_client = pymongo.MongoClient("mongodb://localhost:54017/")
        database = mongo_client["data"]

        # Update code
        self.CodeHandler.add_line("code", "# MongoDB setup")
        self.CodeHandler.add_line("code", "mongo_client = pymongo.MongoClient('mongodb://localhost:54017/')")
        self.CodeHandler.add_line("code", "database = mongo_client['data']")
        self.CodeHandler.add_seperator()

        if self.entry_file_type == FOLDER:
            # TODO SCALABILITY
            """ self.load_csv_in_folder(self.settings['files'])
            self.dfs_combinations = self._merge_dfs(self.settings['time-point'],
                                                    self.settings['split_experiment_by_institutions']) """
        elif self.entry_file_type == FILE:
            collection = database[self.settings['files']["id"]]
            collection_data = collection.find({}, {'_id': False})
            self.df = pd.DataFrame(list(collection_data))
            self.CodeHandler.add_line("code", f"collection = database['{str(self.settings['files']['id'])}']",)
            self.CodeHandler.add_line("code", "collection_data = collection.find({}, {'_id': False})")
            self.CodeHandler.add_line("code", "df = pd.DataFrame(list(collection_data))")
            self.CodeHandler.add_seperator()
            
        elif self.entry_file_type == FILES:  # Process all files (no timepoints)
            df_ids_list = [f['id'] for f in self.settings['files']]

            # load all files in order
            df_list = []
            for fid in df_ids_list:
                collection = database[fid]
                data = collection.find({}, {'_id': False})
                df_list.append(pd.DataFrame(list(data)))

            # primary DF = first non-empty
            first_df = next((d for d in df_list if d is not None and not d.empty), None)
            if first_df is None:
                raise ValueError("All loaded DataFrames are empty or None.")

            first_col = first_df.columns[0]
            target = self.settings['target']

            # robust defaults
            tags = self.settings.get('tags', []) or []
            variables = self.settings.get('variables')
            if not variables:
                feats = set()
                for d in df_list:
                    if d is None or d.empty:
                        continue
                    for c in d.columns:
                        c = str(c)
                        if c not in (target, first_col) and c != '_id':
                            feats.add(c)
                variables = sorted(feats)

            # traces
            self.CodeHandler.add_line("code", f"df_ids_list = {str([d['id'] for d in self.settings['files']])}")
            self.CodeHandler.add_line("code", "df_list = []")
            self.CodeHandler.add_line("code", "for fid in df_ids_list:")
            self.CodeHandler.add_line("code", "    collection = database[fid]", indent=1)
            self.CodeHandler.add_line("code", "    data = collection.find({}, {'_id': False})", indent=1)
            self.CodeHandler.add_line("code", "    df_list.append(pd.DataFrame(list(data)))", indent=1)
            self.CodeHandler.add_line("code", "first_df = next((d for d in df_list if d is not None and not d.empty), None)")
            self.CodeHandler.add_line("code", "if first_df is None: raise ValueError('All loaded DataFrames are empty or None.')")
            self.CodeHandler.add_line("code", f"first_col = '{first_col}'")
            self.CodeHandler.add_line("code", f"target = '{target}'")
            self.CodeHandler.add_line("code", f"tags = {repr(tags)}")
            self.CodeHandler.add_line("code", f"variables = {repr(variables)}")
            self.CodeHandler.add_seperator()

            self.df = self.combine_df_timepoint_tags(df_list, tags, variables)

        if self.df is not None:
            self._info_for_next_node['dataset_columns'] = list(self.df.columns)

        if 'target' in self.settings:
            self._info_for_next_node['target'] = self.settings['target']

        self._info_for_next_node['splitted'] = False

        # NEW: forward setup-related keys
        self._info_for_next_node['dataset_setup_settings'] = self._collect_setup_subset()

        return {}

    
    def _collect_setup_subset(self) -> dict:
        """
        Build a clean subset of settings that are relevant to pycaret.setup().
        Do NOT include file paths, tags, or UI-only options.
        """
        SETUP_KEYS = {
            "target", "preprocess",
            "max_encoding_ohe", "encoding_method",
            "index", "ordinal_features", "numeric_features", "categorical_features", "text_features",
            "keep_features", "create_date_columns", "text_features_method",
            "low_variance_threshold", "group_features", "drop_groups", "bin_numeric_features",
            "outliers_method", "fix_imbalance", "fix_imbalance_method",
            "train_size", "test_data", "data_split_shuffle", "data_split_stratify", "fold_strategy", "fold",
            "rare_to_value", "rare_value",
        }
        return {k: self.settings[k] for k in SETUP_KEYS if k in self.settings}


    def combine_df_timepoint_tags(self, df_list, tags_list, vars_list) -> pd.DataFrame:
        """
        Combine multiple DataFrames on [first_col, target] and keep only selected variables/tags.
        - Works whether columns are raw ("age") or prefixed ("_F1_|_age" or "S1_|_age").
        - Keeps: first_col, target, and any column whose base name (after '_|_' split) is in vars_list or tags_list.
        """
        if not df_list:
            raise ValueError("df_list is empty.")

        # 1) Determine first_col (first non-empty DF) and target
        first_df = next((d for d in df_list if d is not None and not d.empty), None)
        if first_df is None:
            raise ValueError("All DataFrames in df_list are empty or None.")
        first_col = first_df.columns[0]
        target = self.settings['target']

        # 2) Ensure every DF contains first_col and target (create if missing)
        aligned = []
        for d in df_list:
            if d is None:
                continue
            df = d.copy()
            if first_col not in df.columns:
                df[first_col] = pd.NA
            if target not in df.columns:
                df[target] = pd.NA
            # move keys to front (cosmetic, helps readability)
            other_cols = [c for c in df.columns if c not in (first_col, target)]
            df = df[[first_col, target] + other_cols]
            aligned.append(df)

        if not aligned:
            raise ValueError("No valid DataFrames after alignment.")

        # 3) Merge outer on (first_col, target)
        df_merged: pd.DataFrame = aligned[0]
        for i in range(len(aligned) - 1):
            df_merged = df_merged.merge(aligned[i + 1], on=[first_col, target], how='outer')

        self.CodeHandler.add_line("code", "# Merge on [first_col, target] with outer join")
        self.CodeHandler.add_line("code", "df_merged = aligned[0]")
        self.CodeHandler.add_line("code", "for i in range(len(aligned) - 1):")
        self.CodeHandler.add_line("code", "    df_merged = df_merged.merge(aligned[i + 1], on=[first_col, target], how='outer')", indent=1)
        self.CodeHandler.add_seperator()

        # 4) Build keep-set using base names (safe with or without '_|_')
        def _base(col: str) -> str:
            s = str(col)
            return s.split('_|_', 1)[1] if '_|_' in s else s

        tags_list = tags_list or []
        vars_list = vars_list or []

        base_keep = set(vars_list) | set(tags_list)
        cols_2_keep = [first_col, target]

        if base_keep:
            for col in df_merged.columns:
                if col in (first_col, target):
                    continue
                if _base(col) in base_keep:
                    cols_2_keep.append(col)
            df_merged = df_merged[cols_2_keep]
        # else: if no filters provided, keep all columns (besides we already merged).

        # 5) Trace
        self.CodeHandler.add_line("code", "# Keep only first_col, target, and selected variables/tags (by base name)")
        self.CodeHandler.add_line("code", f"tags_list = {repr(tags_list)}")
        self.CodeHandler.add_line("code", f"vars_list = {repr(vars_list)}")
        self.CodeHandler.add_line("code", "def _base(col):")
        self.CodeHandler.add_line("code", "    s = str(col)", indent=1)
        self.CodeHandler.add_line("code", "    return s.split('_|_', 1)[1] if '_|_' in s else s", indent=1)
        self.CodeHandler.add_line("code", "base_keep = set(vars_list) | set(tags_list)")
        self.CodeHandler.add_line("code", "cols_2_keep = [first_col, target]")
        self.CodeHandler.add_line("code", "if base_keep:")
        self.CodeHandler.add_line("code", "    for col in df_merged.columns:", indent=1)
        self.CodeHandler.add_line("code", "        if col in (first_col, target): continue", indent=2)
        self.CodeHandler.add_line("code", "        if _base(col) in base_keep: cols_2_keep.append(col)", indent=2)
        self.CodeHandler.add_line("code", "    df_merged = df_merged[cols_2_keep]")
        self.CodeHandler.add_seperator()

        return df_merged


    def load_csv_in_folder(self, folder_name: str) -> None:
        """
        This function is used to load all csv files in a folder.
        """
        loader = Loader("Loading all csv...", "Finished!").start()
        for file_name in os.listdir(folder_name):
            f = os.path.join(folder_name, file_name)
            if f.endswith(".csv"):
                name_info_list = file_name.split('.')
                csv_type = name_info_list[1]
                timepoint = int(name_info_list[2].replace('time', ''))
                if not self._dfs.keys().__contains__(csv_type):
                    self._dfs[csv_type] = {}
                if not self._dfs[csv_type].keys().__contains__(timepoint):
                    self._dfs[csv_type][timepoint] = []
                self._dfs[csv_type][timepoint].append(
                    {name_info_list[3]: pd.read_csv(f, sep=',', encoding='utf-8')})
                # +"pd.read_csv(f, sep=',', encoding='utf-8')"
        loader.stop()

    def _merge_dfs(self, timePoint: str, split_by_institutions: bool) -> dict:
        """
        This function is used to merge all csv files in a folder.
        """
        loader = Loader("Merging multi-omics combinations...",
                        "Finished!").start()
        timePoint_int = int(timePoint.replace('time', ''))
        (k, df_outcome_col), = self._dfs['outcome'][timePoint_int][0].items()
        combinations_element = []
        for k, v in self._dfs['variable'].items():
            if int(k) <= timePoint_int:
                combinations_element.append(v)
        combinations = self._get_combinations(combinations_element)
        combinations_dict = {}
        for combination in combinations:
            df_temp = pd.DataFrame()
            comb_name = ""
            for elem in combination:
                if comb_name == "":
                    (k, v), = elem.items()
                    comb_name = comb_name + k
                    df_temp = v
                else:
                    (k, v), = elem.items()
                    comb_name = comb_name + "-" + k
                    df_temp = df_temp.merge(v, how='inner', on='ID')
            combinations_dict[comb_name] = df_temp.merge(
                df_outcome_col, how='inner', on='ID')
        if split_by_institutions:
            combinations_dict_institutions = {}
            for exp_name, df in combinations_dict.items():
                combinations_dict_institutions[exp_name] = {}
                institutions_list = []
                for id in df['ID'].to_list():
                    inst = id.split('-')[1]
                    if not institutions_list.__contains__(inst):
                        institutions_list.append(inst)
                        # combinations_dict_institutions[exp_name][inst] = pd.DataFrame()
                        combinations_dict_institutions[exp_name][inst] = (
                            df.loc[df['ID'] == id])
                    else:
                        new_row = df.loc[df['ID'] == id]
                        # combinations_dict_institutions[exp_name][inst].append(pd.DataFrame(new_row, columns=df.columns))
                        combinations_dict_institutions[exp_name][inst] = pd.concat(
                            [new_row, combinations_dict_institutions[exp_name][inst].loc[:]]).reset_index(drop=True)
            loader.stop()
            return combinations_dict_institutions
        else:
            loader.stop()
            return combinations_dict

    def _get_combinations(self, items):
        """
        This function is used to get all combinations of a list.
        """
        l_items = list(items)
        raw_list = list(chain.from_iterable(combinations(l_items, r)
                        for r in range(len(l_items) + 1)))[1:]
        clean_list = []
        for elem_list in raw_list:
            temp1 = []
            for elem in elem_list:
                temp1.append(elem)
            clean_list.append([j for i in temp1 for j in i])
        return clean_list

    def get_json_dataset(self) -> json:
        """
        This function is used to get the dataset in json format.

        Returns:
            The dataset in json format.
        """
        return self.df.to_json(orient='records')

    # TODO
    def get_path_list(self) -> list:
        """
        This function is used to get the path list.

        Returns:
            The path list.
        """
        return [self.settings['files']]
