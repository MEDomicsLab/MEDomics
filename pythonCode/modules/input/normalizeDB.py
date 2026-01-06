import os
import sys
from pathlib import Path

import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running normalizeDB.py: " + id_)

def _clone_column_tags(db, tags_collection_name: str, src_collection: str, dst_collection: str, available_columns):
    """
    Clone column-level tags from 'src_collection' to 'dst_collection'.
    Only clone tags for columns present in 'available_columns'.
    Idempotent via upsert on (collection_id, column_name).
    """
    try:
        tags_col = db[tags_collection_name]
        # Ensure uniqueness on (collection_id, column_name)
        try:
            tags_col.create_index([("collection_id", 1), ("column_name", 1)],
                                  unique=True, name="uniq_collection_column")
        except Exception as e:
            go_print(f"[tags][warn] create_index: {e}")

        allow = set(map(str, available_columns))
        cursor = tags_col.find({"collection_id": src_collection}, {"_id": 0})

        src_count, written = 0, 0
        for doc in cursor:
            src_count += 1
            col = str(doc.get("column_name", "")).strip()
            if not col or col not in allow:
                continue

            payload = dict(doc)
            payload["collection_id"] = dst_collection

            tags_col.update_one(
                {"collection_id": dst_collection, "column_name": col},
                {"$set": payload},  # overwrite to keep source-of-truth parity
                upsert=True,
            )
            written += 1

        go_print(f"[tags] cloned '{src_collection}' → '{dst_collection}' (source_docs={src_count}, written={written})")
    except Exception as e:
        go_print(f"[tags][warn] clone failed: {e}")


def _transfer_tags_from_mapping(db, tags_collection_name: str, collection_id: str, mapping_old_to_new: dict):
    """
    For in-place transforms that ADD/RENAME columns inside the SAME collection:
    Copy tags from old_col → new_col ONLY if new_col has no tags yet.
    This avoids overwriting existing tags on the destination column.
    """
    if not mapping_old_to_new:
        return

    try:
        tags_col = db[tags_collection_name]
        try:
            tags_col.create_index([("collection_id", 1), ("column_name", 1)],
                                  unique=True, name="uniq_collection_column")
        except Exception:
            pass

        moved = 0
        for old_col, new_col in mapping_old_to_new.items():
            old_col = str(old_col).strip()
            new_col = str(new_col).strip()
            if not old_col or not new_col:
                continue

            src = tags_col.find_one({"collection_id": collection_id, "column_name": old_col}, {"_id": 0})
            if not src:
                continue  # no tags on old_col to transfer

            dst = tags_col.find_one({"collection_id": collection_id, "column_name": new_col}, {"_id": 0})
            if dst:
                continue  # do not overwrite existing tags on new_col

            payload = dict(src)
            payload["column_name"] = new_col

            tags_col.update_one(
                {"collection_id": collection_id, "column_name": new_col},
                {"$setOnInsert": payload},  # insert only if absent
                upsert=True,
            )
            moved += 1

        go_print(f"[tags] transferred in '{collection_id}' (moved={moved})")
    except Exception as e:
        go_print(f"[tags][warn] transfer failed: {e}")

class GoExecScriptNormalize(GoExecutionScript):
    """
    This class applies normalization to selected columns using a specified method.
    It saves the new dataset in the MongoDB collection.
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "Nothing returned"}

    def _custom_process(self, json_config: dict) -> dict:
        collection_name = json_config["collection"]
        columns = json_config["columns"]
        method = json_config["method"]
        new_dataset_name = json_config["newDatasetName"]
        overwrite = json_config.get("overwrite", False)
        
        # Tag transfer options (sent by frontend)
        keep_tags = json_config.get("keepTags", True)
        tags_collection_name = json_config.get("tagsCollectionName", "column_tags")

        # if you ever create new columns (e.g., {"age": "age_norm"})
        mapping_old_to_new = json_config.get("mappingOldToNew", {})

        go_print(f"Normalizing columns {columns} from {collection_name} using {method}")

        # Connect and load the original data
        db = connect_to_mongo()
        original_collection = db[collection_name]
        data = list(original_collection.find())
        df = pd.DataFrame(data)
        df = df.drop(columns=["_id"], errors="ignore")

        if not columns:
            raise ValueError("No columns selected for normalization")

        # Select and normalize only selected columns
        df_to_normalize = df[columns].copy()

        if method == "zscore":
            scaler = StandardScaler()
        elif method == "minmax":
            scaler = MinMaxScaler()
        elif method == "robust":
            scaler = RobustScaler()
        else:
            raise ValueError(f"Unsupported normalization method: {method}")

        try:
            normalized_array = scaler.fit_transform(df_to_normalize)
            df[columns] = normalized_array
        except Exception as e:
            raise ValueError(f"Normalization failed: {str(e)}")

        # Save to MongoDB (overwrite or create new collection)
        if overwrite:
            target_collection = db[collection_name]
            target_collection.delete_many({})
        else:
            db.create_collection(new_dataset_name)
            target_collection = db[new_dataset_name]

        # Handle NaN for MongoDB
        data_dict = df.where(pd.notnull(df), None).to_dict(orient="records")
        target_collection.insert_many(data_dict)
        
        # --- TAGS HANDLING ----------------------------------------------------
        # We created a NEW dataset → clone tags from the source collection
        if not overwrite and keep_tags:
            _clone_column_tags(
                db=db,
                tags_collection_name=tags_collection_name,
                src_collection=collection_name,
                dst_collection=new_dataset_name,
                available_columns=list(df.columns),
            )


        return {
            "data": f"Normalization ({method}) applied to columns: {columns}",
            "overwrite": overwrite,
            "targetCollection": collection_name if overwrite else new_dataset_name,
            "keepTags": keep_tags
        }


script = GoExecScriptNormalize(json_params_dict, id_)
script.start()
