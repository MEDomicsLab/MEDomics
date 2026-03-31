import datetime
import json
import os
import sys
from pathlib import Path

import numpy as np

try:
    import pandas as pd
except ModuleNotFoundError:
    pd = None

try:
    import torch
except ModuleNotFoundError:
    torch = None

try:
    import pymongo
except ModuleNotFoundError:
    pymongo = None

try:
    from transformers import AutoTokenizer, AutoModel
except ModuleNotFoundError:

    class _MissingTokenizerDependency:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            raise ModuleNotFoundError(
                "transformers is required to load tokenizer models"
            )

    class _MissingModelDependency:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            raise ModuleNotFoundError(
                "transformers is required to load text extraction models"
            )

    AutoTokenizer = _MissingTokenizerDependency
    AutoModel = _MissingModelDependency

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

MODULE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
REGISTRY_PATH = MODULE_DIR / "text_model_registry.json"


def load_text_model_registry(registry_path: Path = REGISTRY_PATH) -> dict:
    with registry_path.open("r", encoding="utf-8") as registry_file:
        registry = json.load(registry_file)

    models = registry.get("models", [])
    if not models:
        raise ValueError("Text model registry has no models configured")
    return registry


def get_default_model_id(registry: dict) -> str:
    default_models = [
        model
        for model in registry["models"]
        if model.get("default_for_transformer_text")
    ]
    if len(default_models) != 1:
        raise ValueError(
            "Registry must contain exactly one default_for_transformer_text model"
        )
    return default_models[0]["model_id"]


def get_model_path_by_id(model_id: str, registry: dict) -> str:
    for model in registry["models"]:
        if model["model_id"] == model_id:
            return model["hf_model_name_or_path"]
    accepted = sorted(
        model["model_id"] for model in registry["models"] if model.get("enabled", True)
    )
    raise ValueError(
        f"Unknown model_id '{model_id}'. Accepted model IDs: {', '.join(accepted)}"
    )


def resolve_model_path(
    model_source_type: str, model_name_or_path: str, registry: dict
) -> str:
    if model_source_type == "predefined":
        return get_model_path_by_id(model_name_or_path, registry)

    if not model_name_or_path:
        raise ValueError(
            "model_name_or_path must be provided for non-predefined model sources"
        )
    return model_name_or_path


def load_transformer_components(
    primary_model_path: str, default_model_path: str, allow_model_fallback: bool
):
    attempted_paths = []

    def _load(path: str):
        attempted_paths.append(path)
        tokenizer = AutoTokenizer.from_pretrained(path)
        model = AutoModel.from_pretrained(path)
        return tokenizer, model, path

    try:
        return _load(primary_model_path)
    except Exception as primary_error:
        if not allow_model_fallback or default_model_path == primary_model_path:
            raise RuntimeError(
                f"Failed to load model from {primary_model_path}. Error: {primary_error}"
            ) from primary_error

        try:
            return _load(default_model_path)
        except Exception as fallback_error:
            attempted_text = " -> ".join(attempted_paths)
            raise RuntimeError(
                "Failed to load transformer model with fallback. "
                f"Attempted paths: {attempted_text}. "
                f"Primary error: {primary_error}. Fallback error: {fallback_error}"
            ) from fallback_error


class GoExecScriptTransformerExtraction(GoExecutionScript):
    """
    This class is used to execute a process from Go for Generic Transformer Extraction
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self.MODEL_PATH = ""
        self.TOKENIZER = None
        self.MODEL = None
        if torch is None:
            raise ModuleNotFoundError(
                "torch is required for transformer text extraction"
            )
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def split_note_document(self, text, min_length=15):
        """
        Split a text if too long for embeddings generation (max 512 tokens).
        """
        tokens_list_0 = self.TOKENIZER.tokenize(text)

        if len(tokens_list_0) <= 510:
            return [text], [1]

        chunk_parse = []
        chunk_length = []
        chunk = text

        # Go through text and aggregate in groups up to 510 tokens (+ padding)
        tokens_list = self.TOKENIZER.tokenize(chunk)
        if len(tokens_list) >= 510:
            temp = chunk.split("\n")
            ind_start = 0
            len_sub = 0
            for i in range(len(temp)):
                temp_tk = self.TOKENIZER.tokenize(temp[i])
                if len_sub + len(temp_tk) > 510:
                    chunk_parse.append(" ".join(temp[ind_start:i]))
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

    def get_embeddings(self, text):
        """
        Obtain embeddings of text string.
        """
        tokens_pt = self.TOKENIZER(text, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.MODEL(**tokens_pt)
            last_hidden_state = outputs.last_hidden_state
            pooler_output = outputs.pooler_output

            # Move back to CPU for numpy conversion
            hidden_embeddings = last_hidden_state.detach().cpu().numpy()

            # Some models don't have pooler_output, fallback to mean of last hidden state or CLS
            if pooler_output is not None:
                embeddings = pooler_output.detach().cpu().numpy()
            else:
                # Use CLS token (index 0) if available, or mean
                embeddings = last_hidden_state[:, 0, :].detach().cpu().numpy()

        return embeddings, hidden_embeddings

    def get_embeddings_from_event_list(self, event_list):
        """
        For notes obtain fixed-size embeddings (averaging chunks).
        """
        full_embedding = None
        for idx, event_string in enumerate(event_list):
            if pd.isna(event_string) or (
                isinstance(event_string, str) and event_string.strip() == ""
            ):
                continue
            string_list, lengths = self.split_note_document(str(event_string))
            for idx_sub, event_string_sub in enumerate(string_list):
                embedding, _ = self.get_embeddings(event_string_sub)
                if full_embedding is None:
                    full_embedding = embedding
                else:
                    full_embedding = np.concatenate((full_embedding, embedding), axis=0)

        if full_embedding is not None and len(full_embedding) > 0:
            aggregated_embedding = np.average(full_embedding, axis=0)
        else:
            hidden_size = 768
            if self.MODEL and hasattr(self.MODEL.config, "hidden_size"):
                hidden_size = self.MODEL.config.hidden_size
            aggregated_embedding = np.zeros(hidden_size)

        return aggregated_embedding

    def generate_notes_embeddings(
        self,
        collection,
        result_collection,
        identifiers_list,
        frequency,
        column_id,
        column_text,
        column_prefix,
        master_table_compatible,
        column_admission="",
        column_admission_time="",
        column_time="",
    ):
        """
        Function generating notes embeddings.
        """
        if frequency == "Patient":
            for patient_id in identifiers_list:
                patient_records = collection.find({column_id: patient_id})
                df_patient = pd.DataFrame(list(patient_records))
                if column_time and column_time in df_patient.columns:
                    df_patient[column_time] = pd.to_datetime(df_patient[column_time])

                if not df_patient.empty:
                    embeddings = self.get_embeddings_from_event_list(
                        df_patient[column_text]
                    )
                    df_patient_embeddings = pd.DataFrame([embeddings])
                    df_patient_embeddings.insert(0, column_id, patient_id)
                    col_number = len(df_patient_embeddings.columns) - 1
                    df_patient_embeddings.columns = [column_id] + [
                        column_prefix + str(i) for i in range(col_number)
                    ]

                    if (
                        master_table_compatible
                        and column_time
                        and column_time in df_patient.columns
                    ):
                        min_time_record = df_patient.loc[
                            df_patient[column_time].idxmin()
                        ]
                        df_patient_embeddings.insert(
                            1, column_time, min_time_record[column_time]
                        )

                    records = df_patient_embeddings.to_dict("records")
                    result_collection.insert_many(records)

        elif frequency == "Admission":
            for patient_id in identifiers_list:
                patient_records = collection.find({column_id: patient_id})
                df_patient = pd.DataFrame(list(patient_records))
                admissions = df_patient[column_admission].unique()
                for admission_id in admissions:
                    df_admission = df_patient[
                        df_patient[column_admission] == admission_id
                    ]
                    if not df_admission.empty:
                        embeddings = self.get_embeddings_from_event_list(
                            df_admission[column_text]
                        )
                        df_admission_embeddings = pd.DataFrame([embeddings])

                        df_admission_embeddings.insert(
                            0,
                            column_admission_time,
                            df_admission[column_admission_time].iloc[0],
                        )
                        df_admission_embeddings.insert(
                            0, column_admission, admission_id
                        )
                        df_admission_embeddings.insert(0, column_id, patient_id)

                        col_number = len(df_admission_embeddings.columns) - 3
                        df_admission_embeddings.columns = [
                            column_id,
                            column_admission,
                            column_admission_time,
                        ] + [column_prefix + str(i) for i in range(col_number)]

                        records = df_admission_embeddings.to_dict("records")
                        result_collection.insert_many(records)

                        if master_table_compatible:
                            result_collection.update_many(
                                {
                                    column_id: patient_id,
                                    column_admission: int(admission_id),
                                },
                                {"$unset": {column_admission: ""}},
                            )

        elif frequency == "Note":
            patient_records = collection.find({column_id: {"$in": identifiers_list}})
            df = pd.DataFrame(list(patient_records))
            if df.empty:
                return

            # Ensure we treat string index as range
            df.reset_index(inplace=True, drop=True)
            df["index_internal"] = df.index

            for _, row in df.iterrows():
                # Check column existence safely
                if column_text not in row:
                    continue

                embeddings = self.get_embeddings_from_event_list([row[column_text]])
                df_row_embeddings = pd.DataFrame([embeddings])

                df_row_embeddings.insert(0, column_id, row[column_id])

                if master_table_compatible and column_time in row:
                    df_row_embeddings.insert(1, column_time, row[column_time])
                    df_row_embeddings.insert(0, "index", row["index_internal"])

                col_number = len(df_row_embeddings.columns) - (
                    3 if master_table_compatible else 1
                )

                cols = (
                    [column_id]
                    + ([column_time] if master_table_compatible else [])
                    + [column_prefix + str(i) for i in range(col_number)]
                )
                if master_table_compatible:
                    cols = ["index"] + cols

                df_row_embeddings.columns = cols
                records = df_row_embeddings.to_dict("records")
                result_collection.insert_many(records)

            if master_table_compatible:
                result_collection.update_many({}, {"$unset": {"index": ""}})

    def _custom_process(self, json_config: dict) -> dict:
        """
        Run text notes extraction using loaded model.
        """
        # go_print(json.dumps(json_config, indent=4))

        identifiers_list = json_config["identifiersList"]
        extraction_config = json_config["relativeToExtractionType"]

        if pd is None:
            raise ModuleNotFoundError(
                "pandas is required for transformer text extraction"
            )
        if pymongo is None:
            raise ModuleNotFoundError(
                "pymongo is required for transformer text extraction"
            )

        selected_columns = extraction_config["selectedColumns"]
        column_prefix = extraction_config.get("columnPrefix", "embed") + "_attr"

        model_source = extraction_config.get("model_source_type", "predefined")
        model_val = extraction_config.get("model_name_or_path", "")

        registry = load_text_model_registry()
        self.MODEL_PATH = resolve_model_path(model_source, model_val, registry)
        allow_model_fallback = extraction_config.get("allow_model_fallback", True)
        default_model_id = get_default_model_id(registry)
        default_model_path = get_model_path_by_id(default_model_id, registry)

        master_table_compatible = extraction_config.get("masterTableCompatible", False)
        frequency = extraction_config.get("frequency", "Note")

        self.TOKENIZER, self.MODEL, self.MODEL_PATH = load_transformer_components(
            primary_model_path=self.MODEL_PATH,
            default_model_path=default_model_path,
            allow_model_fallback=allow_model_fallback,
        )
        self.MODEL.to(self.device)
        self.MODEL.eval()

        mongo_client = pymongo.MongoClient("mongodb://localhost:54017/")
        database = mongo_client[json_config["DBName"]]
        collection = database[json_config["collectionName"]]
        result_collection = database[json_config["resultCollectionName"]]

        self.generate_notes_embeddings(
            collection,
            result_collection,
            identifiers_list,
            frequency,
            selected_columns["patientIdentifier"],
            selected_columns["notes"],
            column_prefix,
            master_table_compatible,
            selected_columns.get("admissionIdentifier", ""),
            selected_columns.get("admissionTime", ""),
            selected_columns.get("time", ""),
        )

        json_config["collection_length"] = len(list(result_collection.find()))
        self.results = json_config
        return self.results


if __name__ == "__main__":
    json_params_dict, id_ = parse_arguments()
    script = GoExecScriptTransformerExtraction(json_params_dict, id_)
    script.start()
