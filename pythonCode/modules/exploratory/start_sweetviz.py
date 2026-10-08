import json
import os
import sys
import tempfile
from pathlib import Path

import pandas as pd
import pymongo
import sweetviz as sv

if not hasattr(pd.Series, "iteritems"):
    pd.Series.iteritems = pd.Series.items
if not hasattr(pd.DataFrame, "iteritems"):
    pd.DataFrame.iteritems = pd.DataFrame.items

# ===========================
# SWEETVIZ PANDAS COMPATIBILITY PATCH
# ===========================
import math
import pandas as pd

# -- Pandas >= 2: restore iteritems if missing (Sweetviz sometimes calls iteritems)
if not hasattr(pd.Series, "iteritems"):
    pd.Series.iteritems = pd.Series.items
if not hasattr(pd.DataFrame, "iteritems"):
    pd.DataFrame.iteritems = pd.DataFrame.items

# -- Pandas >= 2: reintroduce Series.mad() (mean absolute deviation) removed from Pandas
if not hasattr(pd.Series, "mad"):
    def _series_mad(self, axis=None, skipna=None, level=None):
        # Compute Mean Absolute Deviation manually; coerce to numeric and handle NaN
        s = pd.to_numeric(self, errors="coerce")
        if skipna is None:
            skipna = True
        if skipna:
            s = s.dropna()
        if s.size == 0:
            return math.nan
        m = s.mean()
        return (s - m).abs().mean()
    pd.Series.mad = _series_mad

# -- Sweetviz get_counts(): replace with a robust version that does NOT assume a column named "index"
import sweetviz.series_analyzer as _sza

def _get_counts_robust(series: pd.Series):
    s = series

    # value_counts with and without NaN (do not rely on reset_index/set_index("index"))
    vc_with_nan = s.value_counts(dropna=False)
    vc_without_nan = s.dropna().value_counts(dropna=False)

    # Row-level stats
    num_total = int(len(s))
    nan_count = int(s.isna().sum())
    num_with_data = int(num_total - nan_count)

    # Distinct value counts
    distinct_with_nan = int(vc_with_nan.shape[0])
    distinct_without_nan = int(vc_without_nan.shape[0])

    # Return the dictionary shape Sweetviz expects across versions/branches
    return {
        # value_counts
        "value_counts_with_nan": vc_with_nan,
        "value_counts_without_nan": vc_without_nan,

        # distinct/unique (some branches use "distinct_*", others "unique_*")
        "distinct_count_with_nan": distinct_with_nan,
        "distinct_count_without_nan": distinct_without_nan,
        "unique_count_with_nan": distinct_with_nan,
        "unique_count_without_nan": distinct_without_nan,

        # base row stats (used by add_series_base_stats_to_dict)
        "num_rows_total": num_total,
        "num_rows_with_data": num_with_data,
        "num_rows_with_nan": nan_count,
        "percent_rows_with_data": (100.0 * num_with_data / num_total) if num_total else 0.0,
        "percent_rows_with_missing": (100.0 * nan_count / num_total) if num_total else 0.0,

        # sometimes read elsewhere
        "nan_count": nan_count,
    }

_sza.get_counts = _get_counts_robust
# ===========================
# END OF PATCH
# ===========================



sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class StartSweetviz(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self._progress["type"] = "process"

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script of the execution of the process from Go
        """
        go_print(json.dumps(json_config, indent=4))

        # MongoDB setup
        mongo_client = pymongo.MongoClient("mongodb://localhost:54017/")
        database = mongo_client["data"]
        collection1 = database[json_config["mainDataset"]["id"]]
        target = json_config['target']

        # Set first collection as pandas dataframe
        collection1_data = collection1.find({}, {'_id': False})
        collection1_df = pd.DataFrame(list(collection1_data))
        collection1_name = json_config["mainDataset"]['name'].split(".")[0].capitalize()

        # Set pairwise_analysis
        if collection1_df.columns.size > 200:
            pairwise_analysis = 'off'   # Turn off pairwise analysis for large datasets, very time consuming
        else:
            pairwise_analysis = 'auto'

        # Set second collection as pandas dataframe
        if json_config["compDataset"] != "":
            self.set_progress(label="Loading dataset", now=50)
            collection2 = database[json_config["compDataset"]["id"]]
            collection2_data = collection2.find({}, {'_id': False})
            collection2_df = pd.DataFrame(list(collection2_data))
            collection2_name = json_config["compDataset"]['name'].split(".")[0].capitalize()
            self.set_progress(label="Comparing reports", now=75)
            final_report = sv.compare([collection1_df, collection1_name], [collection2_df, collection2_name], target, pairwise_analysis=pairwise_analysis)
        else:
            self.set_progress(label="Calculating report", now=75)
            final_report = sv.analyze(collection1_df, target, pairwise_analysis=pairwise_analysis)

        # Save report to HTML
        self.set_progress(label="Saving report", now=90)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".html") as f:
            temp_html_path = f.name
            final_report.show_html(f.name, False, 'vertical')
        # Read the HTML content from the temporary file
        with open(temp_html_path, "r", encoding="utf-8") as html_file:
            html_content = html_file.read()
        # Remove the temporary file
        os.remove(temp_html_path)
        # Save to mongoDB
        database[json_config['htmlFileID']].insert_one({"htmlContent": html_content})

        # Get results
        self.set_progress(label="Done!", now=100)
        return self.results


script = StartSweetviz(json_params_dict, id_)
script.start()
