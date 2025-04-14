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
            
        elif self.entry_file_type == FILES: # Time points detection and add _T{X} suffix to columns
            df_dict = {} # dict containing time points to their associated files
            df_ids_list = [file['id'] for file in self.settings['files']]
            df_name_list = [file['name'] for file in self.settings['files']]
            for i, name in enumerate(df_name_list): # if the filename not contains T+number we don't keep it, else we associate it to his time point number
                number = ''
                T_in_name = False
                for char in name:
                    if char == 'T':
                        T_in_name=True
                    elif T_in_name and char.isdigit():
                        number += char
                    elif T_in_name:
                        break
                if len(number) > 0:
                    collection = database[df_ids_list[i]]
                    collection_data = collection.find({}, {'_id': False})
                    df_dict['_T' + number] = pd.DataFrame(list(collection_data))
            first_col = df_dict['_T' + number].columns[0]
            target = self.settings['target']

            # for each dataframe, add a suffix to their columns
            for key in df_dict:
                df_dict[key].columns = [f'{col}{key}' if col != target and col != first_col else col for col in df_dict[key].columns]

            sorted_keys = sorted(df_dict.keys(), key=lambda x: int(x.split('_T')[1]))
            df_list = [df_dict[key] for key in sorted_keys]

            self.CodeHandler.add_line("code", f"df_ids_list = {str([d['id'] for d in self.settings['files']])}")
            self.CodeHandler.add_line("code", f"df_name_list = {str([d['name'] for d in self.settings['files']])}")
            self.CodeHandler.add_line("code", "df_dict = {} # dict containing time points to their associated files")
            self.CodeHandler.add_line("code", "for i, name in enumerate(df_name_list): # if the filename not contains T+number we don't keep it, else we associate it to his time point number")
            self.CodeHandler.add_line("code", "number = ''", indent=1)
            self.CodeHandler.add_line("code", "T_in_name = False", indent=1)
            self.CodeHandler.add_line("code", "for char in name:", indent=1)
            self.CodeHandler.add_line("code", "if char == 'T':", indent=2)
            self.CodeHandler.add_line("code", "T_in_name=True", indent=3)
            self.CodeHandler.add_line("code", "elif T_in_name and char.isdigit():", indent=2)
            self.CodeHandler.add_line("code", "number += char", indent=3)
            self.CodeHandler.add_line("code", "elif T_in_name:", indent=2)
            self.CodeHandler.add_line("code", "break", indent=3)
            self.CodeHandler.add_line("code", "if len(number) > 0:", indent=1)
            self.CodeHandler.add_line("code", "collection = database[df_ids_list[i]]", indent=2)
            self.CodeHandler.add_line("code", "collection_data = collection.find({}, {'_id': False})", indent=2)
            self.CodeHandler.add_line("code", "df_dict['_T' + number] = pd.DataFrame(list(collection_data))", indent=2)
            self.CodeHandler.add_line("code", f"first_col = '{first_col}'")
            self.CodeHandler.add_line("code", f"target = '{target}'")
            self.CodeHandler.add_line("code", "# for each dataframe, add a suffix to their columns")
            self.CodeHandler.add_line("code", "for key in df_dict:")
            self.CodeHandler.add_line("code", "df_dict[key].columns = [f'{col}{key}' if col != target and col != first_col else col for col in df_dict[key].columns]", indent=1)
            self.CodeHandler.add_line("code", "sorted_keys = sorted(df_dict.keys(), key=lambda x: int(x.split('_T')[1]))")
            self.CodeHandler.add_line("code", "df_list = [df_dict[key] for key in sorted_keys]")
            self.CodeHandler.add_seperator()

            self.df = self.combine_df_timepoint_tags(df_list, self.settings['tags'], self.settings['variables'])

        self._info_for_next_node['target'] = self.settings['target']
        self._info_for_next_node['splitted'] = False
        return {}

    def combine_df_timepoint_tags(self, df_list, tags_list, vars_list) -> pd.DataFrame:
        """
        This function is used to combine the dataframes.
        Args:
            df_list: list of dataframes
            tags_list: list of tags

        Returns: the combined dataframe

        """
        # first column should be the ID
        first_col = df_list[0].columns[0]
        # last column should be the target
        target = self.settings['target']

        # merge the dataframes on the first column and the target
        df_merged: pd.DataFrame = df_list[0]
        for i in range(len(df_list) - 1):
            df_merged = df_merged.merge(df_list[i + 1], on=[first_col, target], how='outer')
        self.CodeHandler.add_line("code", "# merge the dataframes on the first column and the target")
        self.CodeHandler.add_line("code", "df_merged = df_list[0]")
        self.CodeHandler.add_line("code", "for i in range(len(df_list) - 1):")
        self.CodeHandler.add_line("code", "df_merged = df_merged.merge(df_list[i + 1], on=[first_col, target], how='outer')", indent=1)
        self.CodeHandler.add_seperator()

        # drop all columns not containing tags from tags list
        cols_2_keep = [first_col, target]
        for col in df_merged.columns:
            if col in cols_2_keep:
                continue
            col_name = col.split('_|_')[1]
            if col_name in vars_list:
                cols_2_keep.append(col)
        df_merged = df_merged[cols_2_keep]
        self.CodeHandler.add_line("code", "# Drop all columns not containing tags from tags list and columns (variables) from vars list")
        self.CodeHandler.add_line("code", f"tags_list = {tags_list}")
        self.CodeHandler.add_line("code", f"vars_list = {vars_list}")
        self.CodeHandler.add_line("code", "cols_2_keep = [first_col, target]")
        self.CodeHandler.add_line("code", "for col in df_merged.columns:")
        self.CodeHandler.add_line("code", "if col in cols_2_keep:", indent=1)
        self.CodeHandler.add_line("code", "continue", indent=2)
        self.CodeHandler.add_line("code", "col_name = col.split('_|_')[1]", indent=1)
        self.CodeHandler.add_line("code", "if col_name in vars_list:", indent=1)
        self.CodeHandler.add_line("code", "cols_2_keep.append(col)", indent=2)
        self.CodeHandler.add_line("code", "df = df_merged[cols_2_keep]")
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
