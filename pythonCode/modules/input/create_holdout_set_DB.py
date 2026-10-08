import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.input_utils.dataframe_utilities import assert_no_nan_values_for_each_column, clean_columns
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)

class GoExecScriptCreateHoldoutSet(GoExecutionScript):
    """
        This class is used to execute the holdout set creation script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        
    def _clone_column_tags(self, db, tags_collection_name: str,
                       src_collection: str, dst_collection: str,
                       available_columns: list):
        """
        Clone column-level tags from `src_collection` to `dst_collection`.
        Only columns present in `available_columns` are cloned.
        Tags collection must contain docs like:
        { collection_id: <str>, column_name: <str>, tags: <list>, ... }
        Upsert key: (collection_id, column_name) — idempotent.
        """
        tags_col = db[tags_collection_name]
        try:
            tags_col.create_index(
                [("collection_id", 1), ("column_name", 1)],
                unique=True,
                name="uniq_collection_column",
            )
        except Exception as e:
            go_print(f"[tags][warn] create_index: {e}")

        allowed = set(map(str, available_columns))
        cursor = tags_col.find({"collection_id": src_collection}, {"_id": 0})

        src_count = 0
        written = 0
        for doc in cursor:
            src_count += 1
            col = str(doc.get("column_name", "")).strip()
            if not col or col not in allowed:
                continue
            payload = dict(doc)
            payload["collection_id"] = dst_collection
            try:
                tags_col.update_one(
                    {"collection_id": dst_collection, "column_name": col},
                    {"$set": payload},
                    upsert=True,
                )
                written += 1
            except Exception as e:
                go_print(f"[tags][error] upsert {dst_collection}.{col}: {e}")

        go_print(f"[tags] cloned '{src_collection}' → '{dst_collection}' "
                f"(source_docs={src_count}, written={written})")


    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is used to create a holdout set
        and a train set with Pandas

        Args:
            json_config: The input json params

        """
        go_print(json.dumps(json_config, indent=4))

        # Set local variables
        holdout_size = json_config["holdoutSetSize"]/100
        shuffle_bool = json_config["shuffle"]
        stratify_bool = json_config["stratify"]
        columns_to_stratify_with = json_config["columnsToStratifyWith"]
        random_state = json_config["randomState"]
        nan_method = json_config["nanMethod"]
        final_name = json_config["name"]
        final_name2 = json_config["name2"]
        collection_name = json_config["collectionName"]
        keep_tags = bool(json_config.get("keepTags", True))
        tags_collection_name = json_config.get("tagsCollectionName", "column_tags")


        # Connect to MongoDB
        db = connect_to_mongo()
        collection = db[collection_name]

        # Fetch data and convert to DataFrame 
        data = list(collection.find())
        df = pd.DataFrame(data)
        df = df.drop('_id', axis=1)

        if not stratify_bool:
            columns_to_stratify_with = []
        
        stratify = df.copy(deep=True) if (
            (len(columns_to_stratify_with) > 0) and stratify_bool) else pd.DataFrame()
        
        df_cleaned = df.replace(float('nan'), np.nan)

        # Clean the stratifying subset
        if stratify_bool:
            stratify = stratify.loc[:, columns_to_stratify_with]

        if stratify[columns_to_stratify_with].isnull().values.any() and len(columns_to_stratify_with) > 0:
            if nan_method == 'drop':
                df_cleaned = clean_columns(df_cleaned, columns_to_stratify_with, "drop empty")
            else:
                df_cleaned = clean_columns(df_cleaned, columns_to_stratify_with, nan_method)

        holdout_set = {}
        train_set = {}
        stratify_df = df_cleaned.loc[:, columns_to_stratify_with] if (
            len(columns_to_stratify_with) > 0 and stratify_bool) else None

        # stratify_df = None
        if stratify_df is not None:
            assert_no_nan_values_for_each_column(stratify_df)

        # Create the holdout set
        if (shuffle_bool):
            train_set, holdout_set = train_test_split(df_cleaned, test_size=holdout_size, random_state=random_state,
                                                    stratify=stratify_df, shuffle=shuffle_bool)
        else:
            train_set, holdout_set = train_test_split(
                df_cleaned, test_size=holdout_size, random_state=random_state)


        # Learning
        learningCollection = final_name
        db.create_collection(learningCollection)
        learningCollection = db[learningCollection]
        data_dict = train_set.where(pd.notnull(train_set), None).to_dict(orient='records')
        learningCollection.insert_many(data_dict)

        # Holdout
        holdoutCollection = final_name2
        db.create_collection(holdoutCollection)
        holdoutCollection = db[holdoutCollection]
        data_dict = holdout_set.where(pd.notnull(holdout_set), None).to_dict(orient='records')
        holdoutCollection.insert_many(data_dict)    
        
        if keep_tags:
            try:
                self._clone_column_tags(
                    db=db,
                    tags_collection_name=tags_collection_name,   # ex: "column_tags"
                    src_collection=collection_name,              # dataset source 
                    dst_collection=final_name,                   # Learning_*
                    available_columns=list(train_set.columns)    # columns
                )
                self._clone_column_tags(
                    db=db,
                    tags_collection_name=tags_collection_name,
                    src_collection=collection_name,              # dataset source
                    dst_collection=final_name2,                  # Holdout_*
                    available_columns=list(holdout_set.columns)
                )
            except Exception as e:
                go_print(f"[tags][warn] cloning failed: {e}")
        
        return

script = GoExecScriptCreateHoldoutSet(json_params_dict, id_)
script.start()
