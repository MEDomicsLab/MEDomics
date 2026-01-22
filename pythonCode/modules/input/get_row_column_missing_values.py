import os
import sys
from pathlib import Path

import numpy as np

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from concurrent.futures import ThreadPoolExecutor, as_completed

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)

class GoExecScriptGetMissingValues(GoExecutionScript):
    """
        This class is used to execute the missing values script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is used to get missing values from a column in MongoDB

        Args:
            json_config: The input json params
        """

        # Get the Data from the JsonToSend
        collection_id = json_config["collectionName"]
        
        # Connect to the database and connect to the tag_collection
        db = connect_to_mongo()
        collection = db[collection_id]

        # Fetch all documents from the collection by using a batch method
        batch_size = 10000
        columns_data = []
        row_data = []
        total_rows = collection.count_documents({})

        def is_nan(value):
            """Check if a value is NaN, None, or an empty string"""
            if value in [None, ""]:
                return True
            if isinstance(value, dict) and "$numberDouble" in value and value["$numberDouble"] == "NaN":
                return True
            if isinstance(value, float) and np.isnan(value):
                return True
            return False

        def process_batch(batch):
            batch_columns_data = []
            batch_row_data = []
            columns = batch[0].keys() if batch else []

            for column in columns:
                if column == "_id":
                    continue
                NaNValues = sum(1 for row in batch if is_nan(row.get(column)))
                percentage = (NaNValues / len(batch)) * 100 if batch else 0
                batch_columns_data.append({"column": column, "numEmpty": NaNValues, "percentage": f"{percentage:.2f}%"})

            for index, row in enumerate(batch):
                NaNValues = sum(1 for value in row.values() if is_nan(value))
                percentage = (NaNValues / (len(row) - 1)) * 100 if len(row) > 1 else 0
                batch_row_data.append({"rowIndex": index, "numEmpty": NaNValues, "percentage": f"{percentage:.2f}%"})

            return batch_columns_data, batch_row_data

        with ThreadPoolExecutor() as executor:
            futures = []
            for i in range(0, total_rows, batch_size):
                batch = list(collection.find().skip(i).limit(batch_size))
                futures.append(executor.submit(process_batch, batch))

            for future in as_completed(futures):
                batch_columns_data, batch_row_data = future.result()
                columns_data.extend(batch_columns_data)
                row_data.extend(batch_row_data)

        self.results = {"columnsData": columns_data, "rowData": row_data}
        return self.results

script = GoExecScriptGetMissingValues(json_params_dict, id_)
script.start()
