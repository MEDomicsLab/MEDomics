from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
import gridfs
import io
import pickle
import pandas as pd

# A BSON document cannot exceed 16MB, and the whole document counts, so leave
# room for the fields sitting alongside the payload.
MONGO_BSON_MAX = 16 * 1024 * 1024
MONGO_SAFETY_MARGIN = 1024 * 1024
FITS_MONGO = MONGO_BSON_MAX - MONGO_SAFETY_MARGIN


def store_large_binary(db, bucket_name, payload):
    """Put bytes somewhere they can be read back, whatever their size.

    Small payloads stay inline in the document. Anything larger goes to GridFS,
    which chunks it inside MongoDB — so there is no file on disk, and therefore
    no filename to collide, exceed a path limit, or carry characters the
    filesystem rejects.

    Args:
        db: the database handle
        bucket_name (str): GridFS bucket to use when the payload is oversized
        payload (bytes): the bytes to store

    Returns:
        tuple: (inline_bytes_or_None, gridfs_id_or_None) -- exactly one is set
    """
    if payload is None:
        return None, None
    if len(payload) <= FITS_MONGO:
        return payload, None
    file_id = gridfs.GridFS(db, collection=bucket_name).put(payload)
    return None, file_id


def load_large_binary(db, bucket_name, inline_value, gridfs_id):
    """Read back what store_large_binary wrote, from wherever it went.

    Args:
        db: the database handle
        bucket_name (str): the GridFS bucket used at write time
        inline_value: the inline bytes, when the payload was small
        gridfs_id: the GridFS id, when it was not

    Returns:
        bytes or None
    """
    if gridfs_id is not None:
        return gridfs.GridFS(db, collection=bucket_name).get(gridfs_id).read()
    return inline_value


def delete_large_binary(db, bucket_name, gridfs_id):
    """Drop a GridFS payload, ignoring one that is already gone.

    Re-running a session overwrites its document; without this the GridFS
    chunks from the previous run stay behind forever.
    """
    if gridfs_id is None:
        return
    try:
        gridfs.GridFS(db, collection=bucket_name).delete(gridfs_id)
    except Exception:
        pass


def _deserialize_model(data):
    """Deserialize stored model bytes, accepting both joblib and plain pickle.

    joblib.dump writes numpy buffers outside the pickle opcode stream, so a
    joblib artifact makes plain pickle.loads fail with "invalid load key".
    import_external_model.py accepts .joblib files and reads them with joblib,
    so re-reading them here with pickle alone would let a model import cleanly
    and only fail later, when an analysis tries to load it.

    joblib.load reads plain pickles too, so it is tried first; the fallback
    covers the case where joblib is not installed.
    """
    try:
        import joblib
        return joblib.load(io.BytesIO(data))
    except Exception:
        return pickle.loads(data)


def connect_to_mongo():
    client = MongoClient('mongodb://localhost:54017/')
    db = client['data']
    return db

def insert_med_data_object_if_not_exists(med_data, json_data=None):
    db = connect_to_mongo()
    collection = db['medDataObjects']

    # Check if meddataobject already in database
    existing_object_by_id = collection.find_one({'id': med_data.id})
    if existing_object_by_id:
        # If already exists stop here
        return existing_object_by_id['id']

    existing_object_by_attributes = collection.find_one({
        'name': med_data.name,
        'type': med_data.type,
        'parentID': med_data.parentID
    })
    if existing_object_by_attributes:
        # If already exists stop here
        return existing_object_by_attributes['id']

    # Insert meddataobject if not exists
    try:
        result = collection.insert_one(med_data.to_dict())
        print(f"MEDDataObject inserted with _id: {result.inserted_id}")
    except DuplicateKeyError:
        print(f"Duplicate key error for id: {med_data.id}")
        return med_data.id

    # Insert ID into parent children
    if med_data.parentID:
        parent = collection.find_one({'id': med_data.parentID})
        if parent:
            children = parent.get('childrenIDs', [])

            # Check if not already present in parent children
            if med_data.id not in children:
                # Sort children
                children_objects = list(collection.find({'id': {'$in': children}}))
                children_objects.append(med_data.to_dict())

                # Sort by type then by alphabetical order
                children_objects.sort(key=lambda x: (x['type'] != 'directory', x['name']))

                # Extract sorted IDs
                children = [child['id'] for child in children_objects]

                # Update parent with sorted children
                collection.update_one({'id': med_data.parentID}, {'$set': {'childrenIDs': children}})

    # Insert the meddataobject data if there is data
    if json_data:
        data_collection = db[med_data.id]
        result = data_collection.insert_many(json_data)
        print(f"Data inserted with {len(result.inserted_ids)} documents")

    return med_data.id


def overwrite_med_data_object_content(collection_id, json_data):
    """
    Overwrite a MEDDataObject data in the DataBase.

    Args:
        collection_id (str): The ID of the MEDDataObject data to overwrite.
        json_data (list[dict]): The new data for the MEDDataObject.

    Returns:
        bool: True if the operation was successful, False otherwise.
    """
    try:
        db = connect_to_mongo()
        collection = db[collection_id]
        collection.delete_many({})
        collection.insert_many(json_data)
        return True
    except PyMongoError as error:
        print(f"Error in overwrite_med_data_object_content: {error}")
        return False

def get_child_id_by_name(parent_id, child_name):
    """
    Get the ID of the child MEDDataObject by its name.

    Args:
        parent_id (uuid): The parent id.
        child_name (str): The name of the child MEDDataObject.

    Returns:
        str: The ID of the child MEDDataObject, or None if not found.
    """
    db = connect_to_mongo()
    collection = db['medDataObjects']

    # Find the parent object
    parent_object = collection.find_one({'id': parent_id})
    if not parent_object or 'childrenIDs' not in parent_object:
        return None

    # Iterate through children IDs to find the child with the given name
    children_ids = parent_object['childrenIDs']
    for child_id in children_ids:
        child_object = collection.find_one({'id': child_id})
        if child_object and child_object['name'] == child_name:
            return child_id

    return None

def get_pickled_model_from_collection(collection_name):
    """
    Get the pickled model from the specified collection.

    Args:
        collection_name (str): The name of the collection containing the pickled model.

    Returns:
        object: The deserialized model, or None if not found.
    """
    db = connect_to_mongo()
    collection = db[collection_name]

    # Find the document containing the model
    model_document = collection.find_one()
    if not model_document:
        raise ValueError(f"No document found in collection {collection_name}")
    if model_document and 'model' in model_document:
        # Deserialize the model
        pickled_model = model_document['model']
        model = _deserialize_model(pickled_model)
        return model
    elif 'model_path' in model_document:
        model_path = model_document['model_path']
        try:
            import joblib
            model = joblib.load(model_path)
        except FileNotFoundError as e:
            raise ValueError(f"Error loading model: {e}")
        return model
    elif 'pklContent' in model_document:
        pickled_model = model_document['pklContent']
        model = _deserialize_model(pickled_model)
        return model
    return None

def get_dataset_as_pd_df(collection_name):
    """
    Get the pandas dataframe from the specified collection.

    Args:
        collection_name (str): The name of the collection containing the data.

    Returns:
        pandas dataframe
    """
    db = connect_to_mongo()
    collection = db[collection_name]
    collection_data = collection.find({}, {'_id': False})
    return pd.DataFrame(list(collection_data))