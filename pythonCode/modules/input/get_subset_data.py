import json
import sys
import os
import pandas as pd
from pathlib import Path
sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print
from pymongo import MongoClient

json_params_dict, id_ = parse_arguments()
go_print(f"Starting get_subset_data.py for ID: {id_}")

class GoExecScriptGetSubsetData(GoExecutionScript):
    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": [], "columns": []}

    def _custom_process(self, json_config: dict) -> dict:
        try:
            # 1. Get Parameters with validation
            database_name = json_config.get("database_name", "data")
            collection_id = json_config.get("collection")
            if not collection_id:
                raise ValueError("Missing collection parameter")

            # 2. MongoDB Connection with batch processing
            client = MongoClient('localhost', 54017)
            db = client[database_name]
            collection = db[collection_id]

            # 3. Batch processing with cursor
            batch_size = 500  # Adjust based on column count
            cursor = collection.find({}).batch_size(batch_size)
            
            # 4. Stream data into DataFrame
            data_chunks = []
            for doc in cursor:
                # Remove _id immediately to reduce memory
                doc.pop('_id', None)  
                data_chunks.append(doc)

            # 5. Create DataFrame with NaN handling
            df = pd.DataFrame(data_chunks)
            go_print(f"DataFrame created with shape: {df.shape}")

            # 6. Convert NaN/NaT to None for JSON compatibility
            df = df.where(pd.notnull(df), None)

            # 7. Prepare response data
            transformed_data = df.to_dict(orient='records')
            columns = [{"field": col, "header": col} for col in df.columns]

            go_print(f"Returning {len(transformed_data)} rows with {len(columns)} columns")
            
            return {
                "data": transformed_data,
                "columns": columns,
                "metadata": {
                    "row_count": len(transformed_data),
                    "column_count": len(columns)
                }
            }

        except Exception as e:
            go_print(f"Error processing data: {str(e)}")
            return {
                "data": [],
                "columns": [],
                "error": str(e)
            }

# Execution
try:
    script = GoExecScriptGetSubsetData(json_params_dict, id_)
    script.start()
except Exception as e:
    go_print(f"Fatal error in script execution: {str(e)}")
    sys.exit(1)