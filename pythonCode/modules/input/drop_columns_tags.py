import os
import sys
from pathlib import Path
import pandas as pd

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running drop_columns_tags.py: " + id_)


class GoExecScriptDropColumnsTags(GoExecutionScript):
    """
    Drop selected columns and/or columns associated to selected tags.
    Write result either overwriting the original collection or creating a new one.
    Also update the tag collection to reflect removed columns/tags.
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "Nothing returned"}

    def _custom_process(self, json_config: dict) -> dict:
        # Input
        collection_name = json_config["collectionName"]      # source dataset collection id
        new_dataset_name = json_config["newDatasetName"]     # destination collection id (same as source if overwrite)
        overwrite = bool(json_config.get("overwrite", False))
        drop_columns = list(json_config.get("dropColumns", []) or [])
        drop_tags = list(json_config.get("dropTags", []) or [])
        tag_collection_name = json_config.get("tagCollectionName", "column_tags")

        go_print(f"[drop] src={collection_name} overwrite={overwrite} new={new_dataset_name} "
                 f"drop_columns={drop_columns} drop_tags={drop_tags} tag_coll={tag_collection_name}")

        # Connect DB, load source
        db = connect_to_mongo()
        src_coll = db[collection_name]
        data = list(src_coll.find())
        if not data:
            raise ValueError("Source collection is empty or not found.")
        df = pd.DataFrame(data).drop(columns=["_id"], errors="ignore")

        # Expand drop by tags: columns associated to those tags
        columns_from_tags = set()
        if drop_tags:
            tag_coll = db[tag_collection_name]
            # Get all docs for this dataset
            tag_docs = tag_coll.find({"collection_id": collection_name})
            for doc in tag_docs:
                col = doc.get("column_name")
                tags = doc.get("tags", [])
                if any(t in tags for t in drop_tags) and col:
                    columns_from_tags.add(col)

        columns_to_drop = sorted(set(drop_columns) | columns_from_tags)

        if not columns_to_drop:
            # No-op, just return
            self.results = {"data": "No columns to drop", "dropped": []}
            return self.results

        # Drop columns in dataframe (ignore errors for non-existing cols)
        df = df.drop(columns=columns_to_drop, errors="ignore")

        # Write back (overwrite or create new)
        if overwrite:
            dst_coll = db[collection_name]
            dst_coll.delete_many({})
        else:
            db.create_collection(new_dataset_name)
            dst_coll = db[new_dataset_name]

        # Replace NaN with None for MongoDB
        clean_records = df.where(pd.notnull(df), None).to_dict(orient="records")
        if clean_records:
            dst_coll.insert_many(clean_records)

        # Update tag collection
        tag_coll = db[tag_collection_name]

        # 1) If we dropped columns (explicitly or from tags), remove tag docs of those columns
        if columns_to_drop:
            tag_coll.delete_many({
                "collection_id": collection_name if overwrite else new_dataset_name,
                "column_name": {"$in": columns_to_drop}
            })

        # 2) If we dropped tags (but kept some columns), remove those tags from remaining docs
        if drop_tags:
            # Work on the target dataset id (if overwriting, it's the same id)
            target_ds_id = collection_name if overwrite else new_dataset_name

            # Pull tags from docs of target dataset
            tag_coll.update_many(
                {"collection_id": target_ds_id},
                {"$pull": {"tags": {"$in": drop_tags}}}
            )
            # Remove any tag doc that ends with empty tag array
            tag_coll.delete_many({
                "collection_id": target_ds_id,
                "$or": [{"tags": {"$exists": False}}, {"tags": {"$size": 0}}]
            })

        self.results = {
            "data": "Drop completed",
            "overwrite": overwrite,
            "dropped_columns": columns_to_drop,
            "dropped_tags": drop_tags
        }
        return self.results


script = GoExecScriptDropColumnsTags(json_params_dict, id_)
script.start()
