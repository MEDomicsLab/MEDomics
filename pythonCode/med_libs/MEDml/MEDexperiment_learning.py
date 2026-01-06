from .MEDexperiment import MEDexperiment
import copy
import os
from pycaret.classification.oop import ClassificationExperiment
from pycaret.regression.oop import RegressionExperiment
from .logger.MEDml_logger_pycaret import MEDml_logger
import json
from .nodes.NodeObj import *
from .nodes import *


def create_pycaret_exp(ml_type: str) -> json:
    """
    Creates a pycaret experiment object depending on the ml_type.
    """
    if ml_type == "classification":
        return ClassificationExperiment()
    elif ml_type == "regression":
        return RegressionExperiment()
    # elif ml_type == "survival_analysis":
    #     return SurvivalAnalysisExperiment()
    else:
        raise ValueError("ML type is not valid")


class MEDexperimentLearning(MEDexperiment):
    """
    This class is used to create the experiment object and the logger object for the pycaret experiment.
    """

    def __init__(self, global_config_json: json) -> None:
        super().__init__(global_config_json)
        self.dfs = {}
        self.dfs_combinations = {}

    def copy_experiment(self, exp: dict):
        temp_df = copy.deepcopy(exp['pycaret_exp'].data)
        copied_exp = copy.deepcopy(exp)
        copied_exp['pycaret_exp'].data = temp_df
        return copied_exp

    def modify_node_info(self, node_info: dict, node: Node, experiment: dict):
        node_info['results']['logs'] = experiment['medml_logger'].get_results()
        node_info['results']['code'] = {'content': node.CodeHandler.get_code(),
                                        'imports': node.CodeHandler.get_imports()}

    def experiment_setup(self, node_info: dict, node: Node):
        experiment = self.setup_dataset(node)
        node_info['results']['code'] = {'content': node.CodeHandler.get_code(),
                                        'imports': node.CodeHandler.get_imports()}
        node_info['results']['logs'] = experiment['medml_logger'].get_results()
        return experiment

    def create_Node(self, node_config: dict):
        node_type = node_config['data']['internal']['type']
        if node_type == "dataset":
            from med_libs.MEDml.nodes.Dataset import Dataset
            return Dataset(node_config['id'], self.global_json_config)
        elif node_type == "split":
            from med_libs.MEDml.nodes.Split import Split
            return Split(node_config['id'], self.global_json_config)
        elif node_type == "clean":
            from med_libs.MEDml.nodes.Clean import Clean
            return Clean(node_config['id'], self.global_json_config)
        elif node_type == "compare_models" or node_type == "train_model":
            from med_libs.MEDml.nodes.ModelHandler import ModelHandler
            return ModelHandler(node_config['id'], self.global_json_config)
        elif node_type == "tune_model" or node_type == "ensemble_model" or node_type == "blend_models" or node_type == "stack_models" or node_type == "calibrate_model":
            from med_libs.MEDml.nodes.Optimize import Optimize
            return Optimize(node_config['id'], self.global_json_config)
        elif node_type == "analysis" or node_type == "analyze":
            from med_libs.MEDml.nodes.Analyze import Analyze
            return Analyze(node_config['id'], self.global_json_config)
        elif node_type == "save_model" or node_type == "load_model":
            from med_libs.MEDml.nodes.ModelIO import ModelIO
            return ModelIO(node_config['id'], self.global_json_config)
        elif node_type == "finalize":
            from med_libs.MEDml.nodes.Finalize import Finalize
            return Finalize(node_config['id'], self.global_json_config)
        elif node_type == "group_models":
            from med_libs.MEDml.nodes.GroupModels import GroupModels
            return GroupModels(node_config['id'], self.global_json_config)
        elif node_type == "combine_models":
            from med_libs.MEDml.nodes.CombineModels import CombineModels
            return CombineModels(node_config['id'], self.global_json_config)

    def setup_dataset(self, node: Node):
        """Sets up the dataset for the experiment.\n
        This function is used to create the pycaret experiment and the logger used for retrieving the results from pycaret object execution.

        Args:
            node (Node): The dataset node.
        """
        kwargs = node.settings.copy()
        df = node.df.copy()
        if 'files' in kwargs:
            del kwargs['files']
        if 'tags' in kwargs:
            del kwargs['tags']
        if 'time-point' in kwargs:
            del kwargs['time-point']
        if 'split_experiment_by_institutions' in kwargs:
            del kwargs['split_experiment_by_institutions']
        if 'filesFromInput' in kwargs:
            del kwargs['filesFromInput']
        if 'data' in kwargs:
            del kwargs['data']
        if 'columns' in kwargs:
            del kwargs['columns']
        if 'steps' in kwargs:
            del kwargs['steps']
        if 'multipleColumns' in kwargs:
            del kwargs['multipleColumns']
        if 'variables' in kwargs:
            del kwargs['variables']

        if 'use_gpu' in kwargs:
            if kwargs['use_gpu'] == "True":
                kwargs['use_gpu'] = True
            elif kwargs['use_gpu'] == "False":
                kwargs['use_gpu'] = False

        if 'index' in kwargs:
            if kwargs['index'] == "True":
                kwargs['index'] = True
            elif kwargs['index'] == "False":
                kwargs['index'] = False

        # add the imports
        node.CodeHandler.add_import("import numpy as np")
        node.CodeHandler.add_import("import pandas as pd")
        node.CodeHandler.add_import("import pymongo")
        node.CodeHandler.add_import(
            f"from pycaret.{self.global_json_config['MLType']} import *")

        # create the experiment
        pycaret_exp = create_pycaret_exp(
            ml_type=self.global_json_config['MLType'])
        node.CodeHandler.add_line(
            "code", f"pycaret_exp = {self.global_json_config['MLType'].capitalize()}Experiment()")

        # clean the dataset
        # df[kwargs['target']].notna() --> keep only the rows where the target is not null
        # df[df[kwargs['target']].notna()] --> keep only the rows where the target is not null
        temp_df = df[df[kwargs['target']].notna()]
        node.CodeHandler.add_line("code", f"temp_df = df[df['{kwargs['target']}'].notna()]")
        temp_df.replace("", float("NaN"), inplace=True)
        temp_df.dropna(how='all', axis=1, inplace=True)
        if 'variables' in node.settings and node.settings['variables']:
            first_col = temp_df.columns[0]
            temp_df = temp_df[[first_col] + [kwargs['target']] + node.settings['variables']]
        node.CodeHandler.add_line("code", f"temp_df.dropna(how='all', axis=1, inplace=True)")
        medml_logger = MEDml_logger()

        # setup the experiment
        if 'test_data' in kwargs:
            test_data_df = pd.read_csv(kwargs['test_data']['path'])
            node.CodeHandler.add_line("code", f"test_data_df = pd.read_csv('{kwargs['test_data']}'")
            node.CodeHandler.add_line("code", f"pycaret_exp.setup(temp_df, test_data=test_data_df, {node.CodeHandler.convert_dict_to_params(kwargs)})")
            del kwargs['test_data']
            pycaret_exp.setup(temp_df, test_data=test_data_df, log_experiment=medml_logger, **kwargs)
        else:
            pycaret_exp.setup(temp_df, log_experiment=medml_logger, **kwargs)
            node.CodeHandler.add_line("code", f"pycaret_exp.setup(temp_df, {node.CodeHandler.convert_dict_to_params(kwargs)})")
        
        node.CodeHandler.add_line(
            "code", f"dataset = pycaret_exp.get_config('X').join(pycaret_exp.get_config('y'))")
        # Get the combined dataset
        full_data = pycaret_exp.get_config('X').join(pycaret_exp.get_config('y'))
        dataset_metaData = {
            'dataset': full_data.head(10) if len(full_data) > 10 else full_data,
            'X_test': pycaret_exp.get_config('X_test'),
            'y_test': pycaret_exp.get_config('y_test'),
        }
        self.global_json_config["columns"] = copy.deepcopy(list(
            temp_df.columns.values.tolist()))
        self.global_json_config["target_column"] = kwargs['target']
        if "steps" in node.settings:
            self.global_json_config["steps"] = node.settings['steps']
        else:
            self.global_json_config["steps"] = None
        if 'tags' in node.settings:
            self.global_json_config["selectedTags"] = node.settings['tags']
        if 'variables' in node.settings:
            self.global_json_config["selectedVariables"] = node.settings['variables']
        self.pipelines_objects[node.id]['results']['data'] = {
            "table": dataset_metaData['dataset'].to_json(orient='records'),
            "paths": node.get_path_list(),
        }
        node._info_for_next_node['dataset'] = dataset_metaData['dataset']
        node._info_for_next_node['setup_settings'] = kwargs
        return {
            'pycaret_exp': pycaret_exp,
            'medml_logger': medml_logger,
            'df': temp_df
        }

    def _make_save_ready_rec(self, next_nodes: dict):
        for node_id, node_content in next_nodes.items():
            saved_path = os.path.join(
                self.global_json_config['internalPaths']['exp'], f"exp_{node_id.replace('*', '--')}.pycaretexp")
            if 'exp_path' in node_content['experiment']:
                saved_path = node_content['experiment']['exp_path']

            data = node_content['experiment']['pycaret_exp'].data
            self.sceneZipFile.write_to_zip(
                custom_actions=lambda path: node_content['experiment']['pycaret_exp'].save_experiment(saved_path))
            node_content['experiment']['exp_path'] = saved_path
            node_content['experiment']['dataset'] = data
            node_content['experiment']['pycaret_exp'] = None
            self._make_save_ready_rec(node_content['next_nodes'])

    def _init_obj_rec(self, next_nodes: dict):
        for node_id, node_content in next_nodes.items():
            data = node_content['experiment']['dataset']
            pycaret_exp = create_pycaret_exp(
                ml_type=self.global_json_config['MLType'])
            saved_path = node_content['experiment']['exp_path']

            def get_experiment(pycaret_exp, data, saved_path):
                return pycaret_exp.load_experiment(saved_path, data=data)

            node_content['experiment']['pycaret_exp'] = self.sceneZipFile.read_in_zip(
                custom_actions=lambda path: get_experiment(pycaret_exp, data, saved_path))

            self._init_obj_rec(node_content['next_nodes'])
