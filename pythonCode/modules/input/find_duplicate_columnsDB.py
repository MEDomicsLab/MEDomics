import sys
import json
import argparse
import pandas as pd
from pymongo import MongoClient
import xxhash 


MAX_ROWS = 5000

def hash_column(column):
    # Round floats to accelerate the process
    if pd.api.types.is_float_dtype(column):
        column = column.round(5)
    # Return a non cryptographic hash
    return xxhash.xxh64(column.to_string(index=False)).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-param", required=True, help="JSON configuration from Go backend")
    parser.add_argument("--id", required=False)  
    args = parser.parse_args()

    try:
        config = json.loads(args.json_param)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON"}))
        return

    collection_name = config.get("collectionName")
    if not collection_name:
        print(json.dumps({"error": "Missing 'collectionName'"}))
        return

    try:
        client = MongoClient("mongodb://localhost:54017", serverSelectionTimeoutMS=20000)
        db = client["data"]
        collection = db[collection_name]

        docs = list(collection.find().limit(MAX_ROWS))
        if not docs:
            print(json.dumps({"duplicates": []}))
            return

        # Transform into DataFrame
        df = pd.DataFrame(docs).drop(columns=["_id"], errors="ignore")

        column_hashes = {}
        duplicates = []

        for col in df.columns:
            h = hash_column(df[col])
            if h in column_hashes:
                duplicates.append([column_hashes[h], col])
            else:
                column_hashes[h] = col

        print(json.dumps({"duplicates": duplicates}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))


if __name__ == "__main__":
    main()
