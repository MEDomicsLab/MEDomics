
import pandas as pd
import numpy as np
import math
from bson import ObjectId

def assert_no_nan_values_for_each_column(df: pd.DataFrame, cols: list = None):
    """
    Assert that there is no nan values for each column
    Args:
        df: DataFrame to check
        cols: Columns to check

    Returns: None

    """
    if cols is None:
        cols = df.columns
    for col in cols:       
        if df[col].isnull().values.any():
            df[col].fillna(method='ffill', inplace=True)
            if df[col].isnull().values.any():
                df[col].fillna(method='bfill', inplace=True)



def save_dataframe(path, extension, df, tags=None):
    """
    Save a dataframe to a file
    Args:
        path (basestring): path to the file
        extension (basestring): extension of the file
        df (pandas.DataFrame): dataframe to save
    """
    if tags is not None:
        df = add_tags_to_column_names(df, tags)
    if extension == "csv":
        df.to_csv(path, index=False)
    elif extension == "xlsx":
        df.to_excel(path, index=False)
    elif extension == "json":
        df.to_json(path, orient="records")
    else:
        print("Extension not supported, cannot save the file")
        return None


def load_data_file(path, extension):
    """
    Load data from a file
    Args:
        path (basestring): path to the file
        extension (basestring): extension of the file
    Returns:
        df (pandas.DataFrame): dataframe containing the data
    """
    import pandas as pd
    if extension == "csv":
        df = pd.read_csv(path)
    elif extension == "xlsx":
        df = pd.read_excel(path)
    elif extension == "json":
        df = pd.read_json(path)
    else:
        print("Extension not supported, cannot load the file")
        return None
    return df

def handle_tags_in_dataframe(df: pd.DataFrame):
    """
    Handle the tags in a dataframe
    Args:
        df: DataFrame to handle

    Returns: Handled DataFrame and a tags dictionary with the column name as key and the tags as value

    Tags are always separated by "_|_" from the column name
    Examples: tag1_|_tag2_|_tag3_|_column_name
    """

    tags_dict = {}
    for col in df.columns:
        if "_|_" in col:
            tags = col.split("_|_")
            df.rename(columns={col: tags[-1]}, inplace=True)
            tags_dict[tags[-1]] = tags[:-1]

    if len(tags_dict) == 0:
        return df, None
    else:
        return df, tags_dict

def add_tags_to_column_names(df: pd.DataFrame, tags_dict: dict):
    """
    Add tags to column names
    Args:
        df: DataFrame to handle
        tags_dict: Dictionary containing the tags

    Returns: Handled DataFrame

    """
    for col in df.columns:
        if col in tags_dict.keys():
            tags = tags_dict[col]
            for tag in tags:
                df.rename(columns={col: tag + "_|_" + col}, inplace=True)
    return df

def clean_columns(df: pd.DataFrame, columns:list, method:str):
    """
    Clean dataframes columns
    Args:
        df: DataFrame to handle
        columns: The columns to clean
        method: The method to use for cleaning

    Returns: Handled DataFrame
    """
    if method == 'drop':
        df = df.drop(columns=columns)
    elif method == 'drop empty':
        df = df.dropna(subset=columns)
    elif method == "random fill":
        for column in columns:
            df.loc[:, column] = df.loc[:, column].fillna(np.random.choice(df.loc[:, column][~df.loc[:, column].isna()]))
    elif method == "mean fill":
        df.loc[:, columns] = df.loc[:, columns].fillna(df.loc[:, columns].mean())
    elif method == "median fill":
        df.loc[:, columns] = df.loc[:, columns].fillna(df.loc[:, columns].median())
    elif method == "mode fill":
        df.loc[:, columns] = df.loc[:, columns].fillna(df.loc[:, columns].mode().iloc[0])
    elif method == "bfill":
        df.loc[:, columns] = df.loc[:, columns].bfill()
    elif method == "ffill":
        df.loc[:, columns] = df.loc[:, columns].ffill()
    return df

def clean_rows(df: pd.DataFrame, rows:list, method:str):
    """
    Clean dataframes rows
    Args:
        df: DataFrame to handle
        rows: The rows to clean
        method: The method to use for cleaning

    Returns: Handled DataFrame
    """
    if method == 'drop':
        df = df.drop(index=rows)
    elif method == "random fill":
        for row in rows:
            for column in df.columns:
                value = df.loc[row, column]
                if not isinstance(value, ObjectId) and math.isnan(value):
                    df.loc[row, column] = np.random.choice(df.loc[:, column][~df.loc[:, column].isna()])
    elif method == "mean fill":
        df.loc[rows] = df.loc[rows].fillna(df.mean())
    elif method == "median fill":
        df.loc[rows] = df.loc[rows].fillna(df.median())
    elif method == "mode fill":
        df.loc[rows] = df.loc[rows].fillna(df.mode().iloc[0])
    elif method == "bfill":
        df.loc[rows] = df.bfill().loc[rows]
    elif method == "ffill":
        df.loc[rows] = df.ffill().loc[rows]
    return df
