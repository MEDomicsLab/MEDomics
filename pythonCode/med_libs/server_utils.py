import os
import sys
import traceback
from pathlib import Path

import pandas as pd
import sklearn
from flask import jsonify
from pycaret.internal.pipeline import Pipeline


def get_json_from_request(request):
    """
    Gets the json from the request
    """
    data = request.get_json()
    data = jsonify(data)
    json_config = data.json
    return json_config['json2send']


def get_response_from_error(e=None, toast=None):
    """
    Gets the response from an error
    """
    if e is not None:
        print(e)
        ex_type, ex_value, ex_traceback = sys.exc_info()
        trace_back = traceback.extract_tb(ex_traceback)
        stack_trace = ''
        for trace in trace_back:
            stack_trace += \
                "\nFile -> %s \nLine -> %d\nFunc.Name -> %s\nMessage -> %s\n" % (trace[0], trace[1], trace[2], trace[3])

        print("Exception type : %s " % ex_type.__name__)
        print("Exception message : %s" % ex_value)
        print("Stack trace : %s" % stack_trace)
        return jsonify({"error": {"message": str(e), "stack_trace": str(stack_trace), "value": str(ex_value)}})
    elif toast is not None:
        return jsonify({"toast": toast})


def get_repo_path():
    """
    Gets the path of the repository
    """
    return str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)


def go_print(msg):
    """
    This function is used to print a message to the stdout pipeline wich go is listening to
    """
    sys.stdout.flush()
    sys.stdout.write(msg + "\n")
    sys.stdout.flush()


def find_next_available_port(start_port: int = 5001) -> int:
    """
        This function is used to find the next available port
    """
    port = start_port
    while is_port_in_use(port):
        port += 1
    return port


def is_port_in_use(port: int) -> bool:
    """
        This function is used to check if a port is in use
    """
    go_print(f"checking port {port}")
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0


def get_free_space_mb(folder):
    """
        This function is used to get the free space in a folder
    """
    import shutil
    total, used, free = shutil.disk_usage(folder)
    return free / (1024.0 ** 3)


def get_model_from_path(path: str) -> sklearn.base.BaseEstimator:
    """
        This function is used to get the model from a medmodel
    """
    import joblib
    with open(path, "rb") as f:
        model = joblib.load(f)
    if isinstance(model, Pipeline):
        model = model.steps[-1][1]
    return model


def load_csv(path: str, target: str) -> pd.DataFrame:
    """
        This function is used to load a csv file

        Args:
            path: The path of the csv file
            target: The target column name
    """
    df = pd.read_csv(path)
    temp_df = df[df[target].notna()]
    temp_df.replace("", float("NaN"), inplace=True)
    temp_df.dropna(how='all', axis=1, inplace=True)
    return temp_df


def load_med_standard_data(database: pd.DataFrame, dataset_list: list, vars_list: list, target: str) -> pd.DataFrame:
    """
    This function is used to combine the dataframes.
    Args:
        database (pd.DataFrame): the mongDB database
        dataset_list (list): list of datasets
        vars_list (list): list of variables
        target (str): the target column name

    Returns: 
        pd.DataFrame: the combined dataframe

    """

    # load the dataframes
    df_list = [] # dict containing time points to their associated files
    df_ids_list = [file['id'] for file in dataset_list]
    df_name_list = [file['name'] for file in dataset_list]
    for i, name in enumerate(df_name_list):  # if the filename not contains T+number we don't keep it, else we associate it to his time point number
        collection = database[df_ids_list[i]]
        collection_data = collection.find({}, {'_id': False})
        df_list.append(pd.DataFrame(list(collection_data)))

    if len(df_list) == 1:
        return df_list[0]

    # merge the dataframes on the first column and the target
    df_merged: pd.DataFrame = df_list[0]
    first_col = df_merged.columns[0]
    for i in range(len(df_list) - 1):
        df_merged = df_merged.merge(df_list[i + 1], on=[first_col, target], how='outer')

    return df_merged