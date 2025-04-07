import os
import sys
from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.mongodb_utils import connect_to_mongo
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)



class GoExecScriptCreateTags(GoExecutionScript):
    """
        This class is used to execute the tags creation script

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is used to assign the tags to the right columns in MongoDB

        Args:
            json_config: The input json params
        """
        # Get the data from the json
        collections = json_config["collections"]
        columns = json_config["columns"]
        tags = json_config["tags"]
        new_collection_name = json_config["newCollectionName"]

        # Connect to the DB
        db = connect_to_mongo()
        DBcollections = db.list_collection_names()

        if new_collection_name not in DBcollections:
            db.create_collection(new_collection_name)

        print("collections: ", collections)
        print("tags: ", tags)
        print('new_collection_name: ', new_collection_name)


        # Create a dictionnary to store the columns selected by collections selected
        columns_by_file = {}
        for key, value in columns.items():
            parts = key.split('-')
            if len(parts) == 2 and value['checked']:
                filename, column_name = parts
                if filename not in columns_by_file:
                    columns_by_file[filename] = []
                columns_by_file[filename].append(column_name)
        print("columns_by_file: ", columns_by_file)

        # Associate collections with files
        file_to_collection = {filename: collection_id for filename, collection_id in zip(columns_by_file.keys(), collections)}
        print("file_to_collection: ", file_to_collection)

        # Create a MongoDB document for each column
        for filename, column_names in columns_by_file.items():
            collection_id = file_to_collection[filename]
            for column_name in column_names:
                # Search for an existing document
                existing_document = db[new_collection_name].find_one({"collection_id": collection_id, "column_name": column_name})
                if existing_document:
                    # Replace the existing tags with the new ones
                    db[new_collection_name].update_one(
                        {"_id": existing_document["_id"]},
                        {"$set": {"tags": tags}}  # 'tags' is assumed to be the list of new tags you want to set
                    )
                else:
                    # Insert a new document if not found
                    document = {
                        "collection_id": collection_id,
                        "column_name": column_name,
                        "tags": tags,  # 'tags' is the list of new tags
                        "filename": filename
                    }
                    db[new_collection_name].insert_one(document)

        print("Tagging complete.")

        return
       
        

script = GoExecScriptCreateTags(json_params_dict, id_)
script.start()
