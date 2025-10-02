"""
File: settings_generator.py
Author: Guillaume Blain
Date: 2023-10-04

Description: This scripts generate automatically the selected machine learning type settings file for the MEDml app.
"""
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
import json
import dpath.util as dp
from collections.abc import MutableMapping

# EXAMPLE USAGE
# cd pythonCode/med_libs/MEDml/utils/settings_generator
# python settings_generator.py --ml_type classification 


# python scripts arguments
import argparse
parser = argparse.ArgumentParser(description='Script so useful.')
parser.add_argument("--ml_type", type=str, default="classification",
                    help="machine learning type to generate settings for (classification or regression)")
parser.add_argument("--save_path", type=str, default=".",
                    help="path to save the settings file to")
args = parser.parse_args()

# SETUP VARIABLES
ml_type = args.ml_type

browser = webdriver.Chrome()
browser.get(f"https://pycaret.readthedocs.io/en/latest/api/{ml_type}.html")
classification = {}
ml_type_container = browser.find_elements(
    By.XPATH, value=f"//section[@id='{ml_type}']")

estimators_names = ['estimator', 'meta_model',
                    'model', 'api_name', 'include', 'estimator_list']

types_conversion = {
    'str': 'string',
    'str or None': 'string',
    'list of str': 'custom-list',
    'int or float': 'float',
    'list or list of list': 'custom-list',
    'list': 'custom-list',
    'bool or list': 'bool',
    'bool': 'bool',
    'int': 'int',
    'float': 'float',
    'str or int': 'string-int',
    'str or sklearn CV generator object': 'string',
    'bool or str': 'string',
    'list of str or scikit-learn compatible object': 'list-multiple',
    'list of scikit-learn compatible objects': 'list-multiple',
    'int or scikit-learn compatible CV generator': 'int',
    'str or scikit-learn compatible object': 'list',
    'scikit-learn compatible object': 'list',
    'dictionary': 'dict',
    'dict': 'dict',
    'integer': 'int',
    'dataframe-like = None': 'dataframe',
    'dataframe-like or None': 'dataframe',
    'str or sklearn estimator': 'string',
    'float or None': 'float',
    'dict or None': 'dict',
    'bool, int, str or sequence': 'bool-int-str',
    'str or imblearn estimator': 'string',
    'str or array-like': 'string',
    'bool or str or object': 'string',
    'bool or int': 'int',
    'integer or scikit-learn compatible CV generator': 'int',
    'int or scikit-learn compatible CV generator': 'int',
    'pd.DataFrame': 'dataframe',
    'pandas.DataFrame': 'dataframe',
    'int, float or str': 'int-float-str',
    'int, float, str or None': 'int-float-str',
    'string or bool': 'string',
    'bool or in': 'int',
    'int, str or sequence': 'int-str',
    'str or array-like, with shape (n_samples,)': 'string',
    # not handled
    '': '',
    'Callable[[], DATAFRAME_LIKE] = None': 'data-function',
    'category-encoders estimator': 'category-encoders estimator',
    'list of (str, transformer), dict or Pipeline': 'list of (str, transformer), dict or Pipeline',
    'bool or str or BaseLogger or list of str or BaseLogger': 'bool or str or BaseLogger or list of str or BaseLogger',
    'bool or str or logging.Logger': 'bool or str or logging.Logger',
    'Optional[Dict[str, str]] = None': 'Optional[Dict[str, str]] = None',
    'str, bool or Memory': 'str, bool or Memory',
    'pycaret.internal.parallel.parallel_backend.ParallelBackend': 'pycaret.internal.parallel.parallel_backend.ParallelBackend',
    'object': 'object',
    'Optional[str] = None': 'Optional[str] = None',

}

nodes_options = {
    'clean': {
        "info": ["imputation_type",
                 "normalize",
                 "normalize_method",
                 "iterative_imputation_iters",
                 "categorical_imputation",
                 "categorical_iterative_imputer",
                 "numeric_imputation",
                 "numeric_iterative_imputer",
                 "transformation",
                 "transformation_method",
                 "pca",
                 "pca_method",
                 "pca_components",
                 "remove_outliers",
                 "outliers_threshold",
                 "remove_multicollinearity",
                 "multicollinearity_threshold",
                 "polynomial_features",
                 "polynomial_degree",
                 "feature_selection",
                 "feature_selection_estimator",
                 "feature_selection_method",
                 "n_features_to_select",
                 "feature_selection_estimator"
                 # "fix_imbalance",
                 # "fix_imbalance_method",
                 ],
        "code": """"""
    },
    'dataset': {
        "info": [],
        "code": """"""
    },
    'optimize': {
        "info": [
            ('tune_model', 'classification regression survival_analysis'),
            ('ensemble_model', 'classification regression'),
            ('blend_models', 'classification regression'),
            ('stack_models', 'classification regression'),
            ('calibrate_model', 'classification')
        ],
        "code": """"""
    },
    'compare_models': {
        "info": ['compare_models'],
        "code": """ """
    },
    'create_model': {
        "info": ['create_model'],
        "code": """"""
    },
    'model': {
        "info": [],
        "code": """"""
    },
    'analyze': {
        "info": ['plot_model', 'interpret_model', 'dashboard'],
        "code": """"""
    },
    'finalize': {
        "info": ['finalize_model'],
        "code": """"""
    },
    'save_model': {
        "info": ['save_model'],
        "code": """"""
    },
    'load_model': {
        "info": ['load_model'],
        "code": """"""
    },
    'combine_models': {
        "info": [],
        "code": """"""
    },

}

"""
This structure is used when a type is either a list or a list-multiple
"""
options_choices = {
    'use_gpu': {
        "False": "tooltip False",
        "True": "tooltip True",
        "force": "tooltip force",
    },
    'estimators': {},
    'imputation_type': {
        "simple": "tooltip simple",
        "iterative": "tooltip iterative",
        "None": "tooltip None",
    },
}


def get_type_list(dict: dict) -> list:
    """
    This function return a list of all the types used in the settings dict
    """
    type_list = []
    for value in dict.values():
        if value != {}:
            if 'options' in value.keys():
                for opt_name, option_value in value['options'].items():
                    if option_value['type'] not in [a_tuple[0] for a_tuple in type_list]:
                        type_list.append((option_value['type'], opt_name))
            else:
                for subNode, subNode_value in value.items():
                    for opt_name, option_value in subNode_value['options'].items():
                        if option_value['type'] not in [a_tuple[0] for a_tuple in type_list]:
                            type_list.append((option_value['type'], opt_name))
    return type_list


def convert_to_medomics_standards(settings: dict, types_conv: dict, nodes_include: dict) -> dict:
    """
    This function convert the settings from the pycaret format to the medomics format
    """
    standard_settings = {}
    # init standard_settings
    for node in nodes_include.keys():
        standard_settings[node] = {}

    # CLEAN SETTINGS
    clean_options = nodes_include['clean']['info']
    standard_settings['clean']['options'] = {}
    standard_settings['clean']['code'] = nodes_include['clean']['code']
    for clean_option in clean_options:
        standard_settings['clean']['options'][clean_option] = settings['setup']['options'][clean_option]

    # DATASET SETTINGS
    not_these_keys = list(standard_settings['clean']['options'].keys())
    standard_settings['dataset']['options'] = {}
    standard_settings['dataset']['code'] = nodes_include['dataset']['code']
    for node in settings['setup']['options'].keys():
        if node not in not_these_keys:
            standard_settings['dataset']['options'][node] = settings['setup']['options'][node]

    # OPTIMIZE SETTINGS
    optimize_options = nodes_include['optimize']['info']
    optimize_option_names = [
        opt_option[0] for opt_option in optimize_options if ml_type in opt_option[1].split(' ')]
    optimize_option_ml_types = [
        opt_option[1] for opt_option in optimize_options if ml_type in opt_option[1].split(' ')]
    standard_settings['optimize']['subNodes'] = optimize_option_names
    standard_settings['optimize']['options'] = {}
    standard_settings['optimize']['code'] = nodes_include['optimize']['code']
    for optimize_option, ml_types in zip(optimize_option_names, optimize_option_ml_types):
        standard_settings[optimize_option] = settings[optimize_option]
        standard_settings[optimize_option]['ml_types'] = ml_types
        standard_settings[optimize_option]['code'] = f"{optimize_option}()"

    # COMPARE_MODELS SETTINGS
    standard_settings['compare_models']['options'] = settings['compare_models']['options']
    standard_settings['compare_models']['code'] = nodes_include['compare_models']['code']

    # CREATE_MODELS SETTINGS
    standard_settings['create_model']['options'] = settings['create_model']['options']
    standard_settings['create_model']['code'] = nodes_include['create_model']['code']

    # MODELS SETTINGS
    for model_option in options_choices['estimators'].keys():
        standard_settings['model'][model_option] = {
            "options": {}, "code": f"{model_option}"}

    # ANALYSE SETTINGS
    analyse_options = nodes_include['analyze']['info']
    for analyse_option in analyse_options:
        standard_settings['analyze'][analyse_option] = settings[analyse_option]
        standard_settings['analyze'][analyse_option]["code"] = f"{analyse_option}()"

    # LOAD_MODEL SETTINGS
    standard_settings['load_model']['options'] = settings['load_model']['options']
    standard_settings['load_model']['code'] = nodes_include['load_model']['code']

    # FINALIZE SETTINGS
    standard_settings['finalize']['options'] = settings['finalize_model']['options']
    standard_settings['finalize']['code'] = nodes_include['finalize']['code']

    # SAVE_MODEL SETTINGS
    standard_settings['save_model']['options'] = settings['save_model']['options']
    standard_settings['save_model']['code'] = nodes_include['save_model']['code']

    # print(json.dumps(standard_settings, indent=4))

    # SETTINGS types CONVERSION
    for node, node_info in standard_settings.items():
        if 'options' in node_info.keys():
            # print(node, node_info.keys())
            for option, option_info in node_info['options'].items():
                print(node, option, end=": ")
                print(types_conv[option_info['type']])
                if option_info['type'] in types_conv.keys():
                    standard_settings[node]['options'][option]['type'] = types_conv[option_info['type']]
                    if standard_settings[node]['options'][option]['type'] == "list" or standard_settings[node]['options'][option]['type'] == "list-multiple":
                        # print(option)
                        # print(json.dumps(options_choices, indent=4))
                        if option in estimators_names:
                            standard_settings[node]['options'][option]['choices'] = options_choices['estimators']
                        else:
                            standard_settings[node]['options'][option]['choices'] = options_choices[option]
        else:
            for subnode, subnode_info in node_info.items():
                for option, option_info in subnode_info['options'].items():
                    print(node, option, end=": ")
                    print(types_conv[option_info['type']])
                    if option_info['type'] in types_conv.keys():
                        standard_settings[node][subnode]['options'][option]['type'] = types_conv[option_info['type']]
                        if standard_settings[node][subnode]['options'][option]['type'] == "list" or standard_settings[node][subnode]['options'][option]['type'] == "list-multiple":
                            if option in estimators_names:
                                standard_settings[node][subnode]['options'][option]['choices'] = options_choices['estimators']
                            else:
                                standard_settings[node][subnode]['options'][option]['choices'] = options_choices[option]

    return standard_settings


def specific_case(dict_settings: dict) -> dict:
    """
    This function is used to add specific settings to the settings file
    """
    dict_settings['dataset']['options']['time-point'] = {
        "type": "string",
        "default_val": "",
        "tooltip": "<p>Time point relative to where analysis is performed</p>"
    }
    dict_settings['dataset']['options']['split_experiment_by_institutions'] = {
        "type": "bool",
        "default_val": "False",
        "tooltip": "<p>Set this to true for analysis by institutions</p>"
    }
    dict_settings['dataset']['options']['files'] = {
        "type": "data-input",
        "tooltip": "<p>Specify path to csv file or to medomics folder</p>"
    }

    dict_settings['load_model']['options']['model_to_load'] = {
        "type": "models-input",
        "tooltip": "<p>Choose a model from the MODELS folder</p>"
    }

    dict_settings['dataset']['options']['use_gpu']['type'] = "list"
    dict_settings['dataset']['options']['use_gpu']['choices'] = options_choices['use_gpu']

    if ml_type == "classification":
        del dict_settings['dataset']['options']['data']

    dict_settings['dataset']['options']['data_func']['default_val'] = ""
    dict_settings['dataset']['options']['target']['type'] = "string"
    dict_settings['dataset']['options']['engine']['default_val'] = ""
    dict_settings['compare_models']['options']['engine']['default_val'] = ""
    dict_settings['create_model']['options']['engine']['default_val'] = ""
    dict_settings['tune_model']['options']['tuner_verbose']['default_val'] = 0
    dict_settings['save_model']['options']['model_name']['default_val'] = "model"

    del dict_settings['dataset']['options']['target']
    del dict_settings['dataset']['options']['log_experiment']
    del dict_settings['dataset']['options']['system_log']
    del dict_settings['compare_models']['options']['parallel']
    del dict_settings['analyze']['plot_model']['options']['save']
    del dict_settings['analyze']['interpret_model']['options']['save']
    del dict_settings['load_model']['options']['model_name']

     # NOT SUPPORTED
    del dict_settings['dataset']['options']['data_func']
    del dict_settings['dataset']['options']['ordinal_features']
    del dict_settings['dataset']['options']['encoding_method']
    del dict_settings['dataset']['options']['group_features']
    del dict_settings['dataset']['options']['custom_pipeline']
    del dict_settings['dataset']['options']['experiment_custom_tags']
    del dict_settings['dataset']['options']['engine']
    del dict_settings['dataset']['options']['memory']
    del dict_settings['dataset']['options']['profile']
    del dict_settings['dataset']['options']['profile_kwargs']
    del dict_settings['compare_models']['options']['engine']
    del dict_settings['compare_models']['options']['fit_kwargs']
    del dict_settings['create_model']['options']['engine']
    del dict_settings['create_model']['options']['fit_kwargs']
    del dict_settings['create_model']['options']['experiment_custom_tags']
    del dict_settings['analyze']['plot_model']['options']['fit_kwargs']
    del dict_settings['analyze']['plot_model']['options']['plot_kwargs']
    del dict_settings['analyze']['dashboard']['options']['dashboard_kwargs']
    del dict_settings['analyze']['dashboard']['options']['run_kwargs']
    del dict_settings['finalize']['options']['fit_kwargs']
    del dict_settings['finalize']['options']['experiment_custom_tags']
    del dict_settings['load_model']['options']['platform']
    del dict_settings['load_model']['options']['authentication']
    del dict_settings['tune_model']['options']['custom_grid']
    del dict_settings['tune_model']['options']['custom_scorer']
    del dict_settings['tune_model']['options']['fit_kwargs']
    del dict_settings['ensemble_model']['options']['fit_kwargs']
    del dict_settings['blend_models']['options']['fit_kwargs']
    del dict_settings['stack_models']['options']['fit_kwargs']
    if ml_type == "classification":
        del dict_settings['calibrate_model']['options']['fit_kwargs']

    return dict_settings


def delete_keys_from_dict(dictionary, keys):
    """
    This function delete the keys from the dictionary
    """
    # Just an optimization for the "if key in keys" lookup.
    keys_set = set(keys)

    modified_dict = {}
    for key, value in dictionary.items():
        if key not in keys_set:
            if isinstance(value, MutableMapping):
                modified_dict[key] = delete_keys_from_dict(value, keys_set)
            else:
                # or copy.deepcopy(value) if a copy is desired for non-dicts.
                modified_dict[key] = value

    return modified_dict


def get_child_text(new_text, child) -> str:
    """
    This function is used to get the text from the child of a node
    """
    children = child.find_elements(By.XPATH, value="./*")
    for child in children:
        if child.tag_name == "code" or child.tag_name == "a":
            new_text = new_text.replace(
                child.get_attribute('outerHTML'), child.text)
        else:
            new_text = get_child_text(new_text, child)
    return new_text.replace('class="simple"', '')


def clean_tooltip(raw_tooltip):
    """
    This function is used to clean the tooltip from the html tags
    """
    new_text = raw_tooltip.get_attribute('innerHTML')
    new_text = get_child_text(new_text, raw_tooltip)
    return new_text


def add_default(dict_settings: dict) -> dict:
    """
    This function add the default values to the settings file
    """
    new_dict_settings = dict_settings.copy()
    to_delete = []
    for node, node_info in dict_settings.items():
        if node != 'optimize':
            if 'options' in node_info.keys() and node_info['options'] != {}:
                for option, option_info in node_info['options'].items():
                    if 'default_val' not in option_info.keys():
                        if 'default' not in new_dict_settings[node].keys():
                            new_dict_settings[node]['default'] = {}
                        new_dict_settings[node]['default'][option] = option_info
                        to_delete.append((option, f'{node}/options/{option}'))
            else:
                for subnode, subnode_info in node_info.items():
                    for option, option_info in subnode_info['options'].items():
                        if 'default_val' not in option_info.keys():
                            if 'default' not in new_dict_settings[node][subnode].keys():
                                new_dict_settings[node][subnode]['default'] = {
                                }
                            new_dict_settings[node][subnode]['default'][option] = option_info
                            to_delete.append(
                                (option, f'{node}/{subnode}/options/{option}'))
    for elem in to_delete:
        dp.delete(new_dict_settings, elem[1])
    return new_dict_settings


py_functions = ml_type_container[0].find_elements(By.XPATH, value="./dl[@class='py class']")[
    0].find_elements(By.XPATH, value="./dd")[0].find_elements(By.XPATH, value="./dl[@class='py method']")
for func in py_functions:
    func_name = func.find_elements(By.XPATH, value="./dt")[0].find_elements(
        By.XPATH, value="./span[@class='sig-name descname']/span")[0].text
    print(func_name)
    classification[func_name] = {}
    classification[func_name]['options'] = {}
    func_methods = func.find_elements(
        By.XPATH, value="./dd/dl[@class='simple']")
    if len(func_methods) == 0:
        func_methods = func.find_elements(By.XPATH, value="./dd/dl")[0]
    else:
        func_methods = func_methods[0]

    func_methods_name = func_methods.find_elements(By.XPATH, value="./dt")
    func_methods_desc = func_methods.find_elements(By.XPATH, value="./dd")
    for declaration, description in zip(func_methods_name, func_methods_desc):
        new_declaration = declaration.text
        if len(declaration.find_elements(By.XPATH, value="./span")) > 0:
            span = declaration.find_elements(By.XPATH, value="./span")[0].text
            new_declaration = declaration.text.replace(span, ': '+span)
        if new_declaration != '**kwargs:' and new_declaration.__contains__(':'):
            try:
                name_text = new_declaration.split(':')
                name = name_text[0]
                type = ''

                classification[func_name]['options'][name] = {}
                classification[func_name]['options'][name]['type'] = type
                classification[func_name]['options'][name]['tooltip'] = clean_tooltip(description)

                param_infos = name_text[1]
                default_val_index = param_infos.find('default')
                if default_val_index != -1:

                    default_val = param_infos[param_infos.find('=', default_val_index)+2:]
                    classification[func_name]['options'][name]['default_val'] = default_val.replace('’', '').replace('‘', '')
                    param_infos = param_infos[:default_val_index]

                if param_infos[-2] == ',':
                    param_infos = param_infos[:-2]

                type = param_infos[1:]
                classification[func_name]['options'][name]['type'] = type

                if func_name == "create_model" and name == "estimator":
                    estimators_list = description.find_elements(
                        By.XPATH, value="./ul[@class='simple']")[0].find_elements(By.XPATH, value="./li")
                    for model in estimators_list:
                        model = model.find_elements(
                            By.XPATH, value="./p")[0].text
                        options_choices['estimators'][model.split(
                            '’ - ')[0][1:]] = model.split('’ - ')[1]
            except Exception as e:
                print(e)
                print(new_declaration, default_val_index,
                      new_declaration.find('=', default_val_index))

print()
type_list = get_type_list(classification)

possible_settings = convert_to_medomics_standards(
    classification, types_conversion, nodes_options)

possible_settings = specific_case(possible_settings)

possible_settings = add_default(possible_settings)

possible_settings = delete_keys_from_dict(
    possible_settings, ['estimator', 'model', 'estimator_list'])
type_list = get_type_list(possible_settings)


with open(f"{args.save_path}/{ml_type}Settings.js", 'w') as f:
    f.write("/* eslint-disable */\n")
    f.write(
        f"const {ml_type}Settings = {json.dumps(possible_settings, indent=4)}; \n export default {ml_type}Settings;")

print("finished", ml_type)
