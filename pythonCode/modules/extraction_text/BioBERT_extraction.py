import dask.dataframe as dd
import datetime
import json
import numpy as np
import os
import pandas as pd
import sys
import torch # Necessary to avoid a bug with transformers
import pymongo
from pathlib import Path
from transformers import AutoTokenizer, AutoModel

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

json_params_dict, id_ = parse_arguments()
#go_print("running script.py:" + id_)


class GoExecScriptBioBERTExtraction(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self.BIOBERT_PATH =  ""
        self.BIOBERT_TOKENIZER = None
        self.BIOBERT_MODEL = None



    def split_note_document(self, text, min_length=15):
        """
        Function taken from the GitHub repository of the HAIM study. Split a text if too long for embeddings generation.

        :param text: String of text to be processed into an embedding. BioBERT can only process a string with â‰¤ 512 tokens
            . If the input text exceeds this token count, we split it based on line breaks (driven from the discharge
            summary syntax).
        :param min_length: When parsing the text into its subsections, remove text strings below a minimum length. These are
            generally very short and encode minimal information (e.g. 'Name: ___').

        :return: chunk_parse: A list of "chunks", i.e. text strings, that breaks up the original text into strings with 512
                tokens.
                chunk_length: A list of the token counts for each "chunk".

        """
        tokens_list_0 = self.BIOBERT_TOKENIZER.tokenize(text)

        if len(tokens_list_0) <= 510:
            return [text], [1]

        chunk_parse = []
        chunk_length = []
        chunk = text

        # Go through text and aggregate in groups up to 510 tokens (+ padding)
        tokens_list = self.BIOBERT_TOKENIZER.tokenize(chunk)
        if len(tokens_list) >= 510:
            temp = chunk.split('\n')
            ind_start = 0
            len_sub = 0
            for i in range(len(temp)):
                temp_tk = self.BIOBERT_TOKENIZER.tokenize(temp[i])
                if len_sub + len(temp_tk) > 510:
                    chunk_parse.append(' '.join(temp[ind_start:i]))
                    chunk_length.append(len_sub)
                    # reset for next chunk
                    ind_start = i
                    len_sub = len(temp_tk)
                else:
                    len_sub += len(temp_tk)
        elif len(tokens_list) >= min_length:
            chunk_parse.append(chunk)
            chunk_length.append(len(tokens_list))

        return chunk_parse, chunk_length


    def get_biobert_embeddings(self, text):
        """
        Function taken from the GitHub repository of the HAIM study. Obtain BioBERT embeddings of text string.

        :param text: Input text (str).

        :return: embeddings: Final Biobert embeddings with vector dimensionality = (1,768).
                hidden_embeddings: Last hidden layer in Biobert model with vector dimensionality = (token_size,768).

        """
        tokens_pt = self.BIOBERT_TOKENIZER(text, return_tensors="pt")
        outputs = self.BIOBERT_MODEL(**tokens_pt)
        last_hidden_state = outputs.last_hidden_state
        pooler_output = outputs.pooler_output
        hidden_embeddings = last_hidden_state.detach().numpy()
        embeddings = pooler_output.detach().numpy()

        return embeddings, hidden_embeddings


    def get_biobert_embeddings_from_event_list(self, event_list):
        """
        Function taken from the GitHub repository of the HAIM study. For notes obtain fixed-size BioBERT embeddings.

        :param event_list: Timebound ICU patient stay structure filtered by max_time_stamp or min_time_stamp if any.
        :param event_weights: Weights for aggregation of features in final embeddings. (Removed in our version)

        :return: aggregated_embeddings: BioBERT event features for all events.

        """
        for idx, event_string in enumerate(event_list):
            string_list, lengths = self.split_note_document(event_string)
            for idx_sub, event_string_sub in enumerate(string_list):
                # Extract biobert embedding
                embedding, hidden_embedding = self.get_biobert_embeddings(event_string_sub)
                # Concatenate
                if (idx == 0) & (idx_sub == 0):
                    full_embedding = embedding
                else:
                    full_embedding = np.concatenate((full_embedding, embedding), axis=0)

        # Return the weighted average of embedding vector across temporal dimension
        try:
            aggregated_embedding = np.average(full_embedding, axis=0)
        except:
            aggregated_embedding = np.zeros(768)

        return aggregated_embedding


    def generate_biobert_notes_embeddings(self, collection, result_collection, identifiers_list, frequency, column_id, column_text, column_prefix, master_table_compatible, column_admission="", column_admission_time="", column_time=""):
        """
        Function generating notes embeddings from BioBERT pre-trained model.

        :param collection: MongoDB collection containing necessary data to proceed.
        :param result_collection: MongoDB collection in which we want to save the data.
        :param identifiers_list: List of identifiers in order to proceed by batch.
        :param frequency: May be "Patient" "Admission" or a timedelta range, depending on the desired type of extraction.
        :param column_id: Column name in the dataframe containing patient identifiers.
        :param column_text: Column name in the dataframe containing the text notes.
        :param column_prefix: Prefix to set to column in the returning dataframe.
        :param master_table_compatible: Boolean indicating if the data must be master table compatible.
        :param column_admission: Column name in the dataframe containing admission identifiers, may be null if frequency is not "Admission".
        :param column_admission_time: Column name in the dataframe containing admission time, may be null if frequency is not "Admission".
        :param column_time: Time column in the dataframe, may be null if frequency is not a hour range.

        """
        if frequency == "Patient":
            # Iterate over patients
            for patient_id in identifiers_list:
                patient_records = collection.find({column_id: patient_id})
                df_patient = pd.DataFrame(list(patient_records))
                df_patient = df_patient.astype({column_time : "datetime64[ns]"})
                if not df_patient.empty:
                    embeddings = self.get_biobert_embeddings_from_event_list(df_patient[column_text])
                    df_patient_embeddings = pd.DataFrame([embeddings])
                    # Insert patient_id in the dataframe
                    df_patient_embeddings.insert(0, column_id, patient_id)
                    # Rename columns
                    col_number = len(df_patient_embeddings.columns) - 1
                    df_patient_embeddings.columns = [column_id] + [column_prefix + str(i) for i in range(col_number)]
                    # If Master Table Compatible
                    if master_table_compatible:
                        min_time_record = df_patient.loc[df_patient[column_time].idxmin()]
                        df_patient_embeddings.insert(1, column_time, min_time_record[column_time])
                    # Insert data in the result database
                    records = df_patient_embeddings.to_dict("records")
                    result_collection.insert_many(records)

        elif frequency == "Admission":
            # Iterate over combinations of [patients, admissions]
            for patient_id in identifiers_list:
                patient_records = collection.find({column_id: patient_id})
                df_patient = pd.DataFrame(list(patient_records))
                admissions = df_patient[column_admission].unique()
                for admission_id in admissions:
                    df_admission = df_patient[df_patient[column_admission] == admission_id]
                    if not df_admission.empty:
                        embeddings = self.get_biobert_embeddings_from_event_list(df_admission[column_text])
                        df_admission_embeddings = pd.DataFrame([embeddings])
                        # Insert admission_time in the dataframe
                        df_admission_embeddings.insert(0, column_admission_time, df_admission[column_admission_time].iloc[0])
                        # Insert admission_id in the dataframe
                        df_admission_embeddings.insert(0, column_admission, admission_id)
                        # Insert patient_id in the dataframe
                        df_admission_embeddings.insert(0, column_id, patient_id)
                        # Rename columns
                        col_number = len(df_admission_embeddings.columns) - 3
                        df_admission_embeddings.columns = [column_id, column_admission, column_admission_time] + [column_prefix + str(i) for i in range(col_number)]
                        # Insert data in the result database
                        records = df_admission_embeddings.to_dict("records")
                        result_collection.insert_many(records)
                        # If Master Table Compatible
                        if master_table_compatible:
                            result_collection.update_many(
                                {column_id: patient_id, column_admission: int(admission_id)},
                                {"$unset": {column_admission: ""}}
                            )

        elif frequency == "Note":
            patient_records = collection.find({column_id: {"$in": identifiers_list}})
            df = pd.DataFrame(list(patient_records))
            df["index"] = df.index
            # Iterate over all the dataframe
            for _, row in df.iterrows():
                embeddings = self.get_biobert_embeddings_from_event_list([row[column_text]])
                df_row_embeddings = pd.DataFrame([embeddings])
                # Insert patient_id in the dataframe
                df_row_embeddings.insert(0, column_id, row[column_id])
                # Insert index in the dataframe
                if master_table_compatible:
                    df_row_embeddings.insert(1, column_time, row[column_time])
                    df_row_embeddings.insert(0, "index", row["index"])
                # Rename columns
                col_number = len(df_row_embeddings.columns) - (3 if master_table_compatible else 1)
                df_row_embeddings.columns = (["index"] if master_table_compatible else []) + [column_id] + ([column_time] if master_table_compatible else []) + [column_prefix + str(i) for i in range(col_number)]
                # Insert data in the result database
                records = df_row_embeddings.to_dict("records")
                result_collection.insert_many(records)
            # If Master Table Compatible
            if master_table_compatible:
                result_collection.update_many({}, {"$unset": {"index": ""}})

        elif column_time:
            # Iterate over patients
            for patient_id in identifiers_list:
                patient_records = collection.find({column_id: patient_id}).sort(column_time)
                df_patient = pd.DataFrame(list(patient_records))
                df_patient = df_patient.astype({column_time : "datetime64[ns]"})
                if not df_patient.empty:
                    # Iterate over time
                    start_date = df_patient[column_time].iloc[0]
                    end_date = start_date + frequency
                    last_date = df_patient[column_time].iloc[-1]
                    while start_date <= last_date:
                        df_time = df_patient[(df_patient[column_time] >= start_date) & (df_patient[column_time] < end_date)]
                        if not df_time.empty:
                            embeddings = self.get_biobert_embeddings_from_event_list(df_time[column_text])
                            df_time_embeddings = pd.DataFrame([embeddings])
                            # Insert time in the dataframe
                            df_time_embeddings.insert(0, "end_date", end_date)
                            df_time_embeddings.insert(0, "start_date", start_date)
                            # Insert patient_id in the dataframe
                            df_time_embeddings.insert(0, column_id, patient_id)
                            # Rename columns
                            col_number = len(df_time_embeddings.columns) - 3
                            df_time_embeddings.columns = [column_id, "start_date", "end_date"] + [column_prefix + str(i) for i in range(col_number)]
                            # Insert data in the result database
                            records = df_time_embeddings.to_dict("records")
                            result_collection.insert_many(records)
                        start_date += frequency
                        end_date += frequency
            # If Master Table Compatible
            if master_table_compatible:
                result_collection.update_many({}, {"$unset": {"end_date": ""}})


    def _custom_process(self, json_config: dict) -> dict:
        """
        Run text notes extraction using BioBERT pre-trained model.

        Returns: self.results : dict containing data relative to extraction.

        """
        #go_print(json.dumps(json_config, indent=4))

        # Set local variables
        identifiers_list = json_config["identifiersList"]
        selected_columns = json_config["relativeToExtractionType"]["selectedColumns"]
        column_prefix = json_config["relativeToExtractionType"]["columnPrefix"] + '_attr'
        biobert_path = json_config["relativeToExtractionType"]["biobertPath"]
        master_table_compatible = json_config["relativeToExtractionType"]["masterTableCompatible"]
        columnKeys = [key for key in selected_columns]
        columnValues = []
        for key in columnKeys:
            if selected_columns[key] != "" and selected_columns[key] not in columnValues:
                columnValues.append(selected_columns[key])
        frequency = json_config["relativeToExtractionType"]["frequency"]
        if frequency == "HourRange":
            frequency = datetime.timedelta(hours=json_config["relativeToExtractionType"]["hourRange"])

        # Set biobert parameters
        self.BIOBERT_PATH =  biobert_path
        self.BIOBERT_TOKENIZER = AutoTokenizer.from_pretrained(self.BIOBERT_PATH)
        self.BIOBERT_MODEL = AutoModel.from_pretrained(self.BIOBERT_PATH)

        # MongoDB setup
        mongo_client = pymongo.MongoClient("mongodb://localhost:54017/")
        database = mongo_client[json_config["DBName"]]
        collection = database[json_config["collectionName"]]
        result_collection = database[json_config["resultCollectionName"]]

        # Feature extraction
        self.generate_biobert_notes_embeddings(collection, result_collection, identifiers_list, frequency,
                                                                selected_columns["patientIdentifier"], 
                                                                selected_columns["notes"],
                                                                column_prefix,
                                                                master_table_compatible,
                                                                selected_columns["admissionIdentifier"],
                                                                selected_columns["admissionTime"],
                                                                selected_columns["time"])

        # Send results to front
        json_config["collection_length"] = len(list(result_collection.find()))
        self.results = json_config
        return self.results


script = GoExecScriptBioBERTExtraction(json_params_dict, id_)
script.start()
