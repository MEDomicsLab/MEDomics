import dask.dataframe as dd
import datetime
import json
import os
import pandas as pd
import sys
import pymongo

from pathlib import Path
from tsfresh import extract_features
from tsfresh.feature_extraction import ComprehensiveFCParameters, EfficientFCParameters, MinimalFCParameters

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecScriptTSfreshExtraction(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def generate_TSfresh_embeddings(self, collection, result_collection, identifiers_list, frequency, column_id, column_weight, column_kind, column_value, default_fc_parameters, master_table_compatible, column_prefix, column_admission="", column_admission_time="", column_time=""):
        """
        Function generating TSfresh embeddings for time series.

        :param collection: MongoDB collection containing necessary data to proceed.
        :param result_collection: MongoDB collection in which we want to save the data.
        :param identifiers_list: List of identifiers in order to proceed by batch.
        :param frequency: May be "Patient" "Admission" or a timedelta range, depending on the desired type of extraction.
        :param column_id: Column name in the dataframe containing patient identifiers.
        :param column_weight: Column name in the dataframe containing weights of the time series.
        :param column_kind: Column name in the dataframe identifying kind of time series.
        :param column_value: Column name in the dataframe containing the time series values.
        :param default_fc_parameters: TSfresh feature generation option.
        :param master_table_compatible: Boolean true if the returned dataframe must matching the sub-master table format.
        :param column_prefix: Prefix to set to extracted columns.
        :param column_admission: Column name in the dataframe containing admission identifiers, may be null if frequency is not "Admission".
        :param column_admission_time: Column name in the dataframe containing admission time, may be null if frequency is not "Admission".
        :param column_time: Time column in the dataframe, may be null if frequency is not a hour range.

        """
        if frequency == "Patient":
            # Iterate over patients
            for patient_id in identifiers_list:
                patient_records = collection.find({column_id: patient_id})
                df_patient = pd.DataFrame(list(patient_records))
                df_patient[column_value] = pd.to_numeric(df_patient[column_value])
                if column_time:
                    df_patient = df_patient.astype({column_time : "datetime64[ns]"})
                df_patient.dropna(subset=[column_id, column_weight, column_kind, column_value], inplace=True)
                if not df_patient.empty:
                    embeddings = extract_features(df_patient, column_id=column_id, 
                                                            column_sort=column_weight, 
                                                            column_kind=column_kind, 
                                                            column_value=column_value,
                                                            disable_progressbar=True,
                                                            default_fc_parameters=default_fc_parameters, n_jobs=0)
                    df_patient_embeddings = pd.DataFrame(embeddings)
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
                df_patient[column_value] = pd.to_numeric(df_patient[column_value])
                if column_admission_time:
                    df_patient = df_patient.astype({column_admission_time : "datetime64[ns]"})
                    df_patient.dropna(subset=[column_id, column_admission_time, column_weight, column_kind, column_value], inplace=True)
                else:
                    df_patient.dropna(subset=[column_id, column_weight, column_kind, column_value], inplace=True)
                admissions = df_patient[column_admission].unique()
                for admission_id in admissions:
                    df_admission = df_patient[df_patient[column_admission] == admission_id]
                    if not df_admission.empty:
                        embeddings = extract_features(df_admission, column_id=column_id, 
                                                                column_sort=column_weight, 
                                                                column_kind=column_kind, 
                                                                column_value=column_value,
                                                                disable_progressbar=True,
                                                                default_fc_parameters=default_fc_parameters, n_jobs=0)
                        df_admission_embeddings = pd.DataFrame(embeddings)
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
        
        elif column_time != "":
            # Iterate over patients
            for patient_id in identifiers_list:
                patient_records = collection.find({column_id: patient_id}).sort(column_time)
                df_patient = pd.DataFrame(list(patient_records))
                df_patient[column_value] = pd.to_numeric(df_patient[column_value])
                df_patient = df_patient.astype({column_time : "datetime64[ns]"})
                df_patient.dropna(subset=[column_id, column_weight, column_kind, column_value], inplace=True)
                if not df_patient.empty:
                    # Iterate over time
                    start_date = df_patient[column_time].iloc[0]
                    end_date = start_date + frequency
                    last_date = df_patient[column_time].iloc[-1]
                    while start_date <= last_date:
                        df_time = df_patient[(df_patient[column_time] >= start_date) & (df_patient[column_time] < end_date)]
                        if not df_time.empty:
                            embeddings = extract_features(df_time, column_id=column_id, 
                                                                column_sort=column_weight, 
                                                                column_kind=column_kind, 
                                                                column_value=column_value,
                                                                disable_progressbar=True,
                                                                default_fc_parameters=default_fc_parameters,n_jobs=0)
                            df_time_embeddings = pd.DataFrame(embeddings)
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
        Run time series extraction using TSfresh library.

        Returns: self.results : dict containing data relative to extraction.

        """
        #go_print(json.dumps(json_config, indent=4))

        # Set local variables
        identifiers_list = json_config["identifiersList"]
        selected_columns = json_config["relativeToExtractionType"]["selectedColumns"]
        column_prefix = json_config["relativeToExtractionType"]["columnPrefix"] + '_attr_'
        columnKeys = [key for key in selected_columns]
        columnValues = []
        for key in columnKeys:
            if selected_columns[key] != "" and selected_columns[key] not in columnValues:
                columnValues.append(selected_columns[key])
        frequency = json_config["relativeToExtractionType"]["frequency"]
        if frequency == "HourRange":
            frequency = datetime.timedelta(hours=json_config["relativeToExtractionType"]["hourRange"])

        # MongoDB setup
        mongo_client = pymongo.MongoClient("mongodb://localhost:54017/")
        database = mongo_client[json_config["DBName"]]
        collection = database[json_config["collectionName"]]
        result_collection = database[json_config["resultCollectionName"]]

        # Feature extraction
        if json_config["relativeToExtractionType"]["featuresOption"] == "Efficient":
            settings = EfficientFCParameters()
        elif json_config["relativeToExtractionType"]["featuresOption"] == "Minimal":
            settings = MinimalFCParameters()
        else:
            settings = ComprehensiveFCParameters()

        self.generate_TSfresh_embeddings(collection, result_collection, identifiers_list, frequency, 
                                                            selected_columns["patientIdentifier"], 
                                                            selected_columns["measurementWeight"], 
                                                            selected_columns["measuredItemIdentifier"], 
                                                            selected_columns["measurementValue"], settings,
                                                            json_config["relativeToExtractionType"]["masterTableCompatible"], 
                                                            column_prefix,
                                                            selected_columns["admissionIdentifier"],
                                                            selected_columns["admissionTime"],
                                                            selected_columns["time"])

        # Send results to front
        json_config["collection_length"] = len(list(result_collection.find()))
        self.results = json_config
        return self.results


script = GoExecScriptTSfreshExtraction(json_params_dict, id_)
script.start()
