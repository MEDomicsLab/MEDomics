"""
Saves the final model of a MEDfl simulation as a .medflmodel file, so it can be tested later on a holdout dataset.

A .medflmodel file is a zip archive containing:
    metadata.json   what is needed to rebuild the model and preprocess new data the way MEDfl did for training
    model.pth       neural network weights (PyTorch state_dict), or
    model.json      XGBoost booster (native XGBoost JSON format)
"""
import json
import os
import re
import tempfile
import zipfile
from datetime import datetime

MODEL_PACKAGE_EXTENSION = ".medflmodel"
MODEL_PACKAGE_VERSION = 1

# Columns MEDfl adds to the node datasets and drops before training (see FLsetup.create_federated_dataset)
MEDFL_BOOKKEEPING_COLUMNS = ["DataSetName", "NodeId", "DataSetId"]


def get_training_features(fl_setup, train_nodes, target):
    """
    Returns the feature columns in the order the model was trained on.
    They are read the way MEDfl builds them: node dataset columns, minus the bookkeeping columns and the target.
    """
    if not train_nodes:
        raise ValueError("No training client: cannot determine the feature columns")
    dropped = list(MEDFL_BOOKKEEPING_COLUMNS) if not fl_setup.column_name else ["PatientId"]
    columns = train_nodes[0].get_dataset(fl_setup.column_name).columns
    features = [column for column in columns if column not in dropped and column != target]
    return features, dropped


def get_training_scaler(fl_setup):
    """Returns the global feature scaler MEDfl fitted on all the clients' training data."""
    scalers = [entry["X"] for entry in (fl_setup.scalers or {}).values() if entry.get("X") is not None]
    if not scalers:
        raise ValueError("MEDfl did not keep a feature scaler for this run")
    return scalers[0]


def build_preprocessing(fl_setup, train_nodes, target):
    """Describes the preprocessing MEDfl applied, so new data can go through exactly the same steps."""
    features, dropped = get_training_features(fl_setup, train_nodes, target)
    scaler = get_training_scaler(fl_setup)
    if len(features) != int(scaler.n_features_in_):
        raise ValueError(
            f"Found {len(features)} feature columns but the scaler was fitted on {int(scaler.n_features_in_)}: "
            f"the feature order cannot be guaranteed")
    return {
        "features": features,
        "preprocessing": {
            "dropped_columns": dropped,
            # MEDfl fills each dataset with its own column means before scaling (client test sets included).
            # The training means are kept for columns that are entirely missing in a new dataset.
            "missing_values": {"strategy": "mean", "fallback_values": [float(v) for v in scaler.mean_]},
            "scaler": {
                "type": "standard",
                "mean": [float(v) for v in scaler.mean_],
                "scale": [float(v) for v in scaler.scale_],
            },
            "binary_target_mapping": "targets {-1, 1} and {1, 2} are mapped to {0, 1}",
            "rows_without_target": "dropped",
        },
    }


def safe_file_name(name):
    """Keeps letters, digits, '-' and '_' (the workspace zip helpers split paths on '.')."""
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", str(name or "")).strip("_")
    return cleaned or "simulation"


def save_model_package(folder, name, metadata, write_model):
    """
    Writes a .medflmodel file in folder and returns its path.

    Args:
        folder: destination folder (created if missing)
        name: file name without extension
        metadata: dict saved as metadata.json (format information is added)
        write_model: function(directory) writing the model file in directory and returning its file name
    """
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, safe_file_name(name) + MODEL_PACKAGE_EXTENSION)

    with tempfile.TemporaryDirectory() as directory:
        model_file = write_model(directory)
        content = {
            "format": "medflmodel",
            "version": MODEL_PACKAGE_VERSION,
            "created": datetime.now().isoformat(timespec="seconds"),
            **metadata,
        }
        content["model"]["file"] = model_file

        # write next to the destination first, so a failure never leaves a broken .medflmodel behind
        temporary_path = path + ".tmp"
        with zipfile.ZipFile(temporary_path, "w", zipfile.ZIP_DEFLATED) as archive:
            # default=str: settings can hold numpy values
            archive.writestr("metadata.json", json.dumps(content, indent=2, default=str))
            archive.write(os.path.join(directory, model_file), model_file)
        os.replace(temporary_path, path)

    return path


def save_nn_model(folder, name, torch_model, architecture, base_metadata):
    """Saves the final neural network (BinaryClassifier) of a simulation."""
    import torch

    def write_model(directory):
        torch.save({key: value.detach().cpu() for key, value in torch_model.state_dict().items()},
                   os.path.join(directory, "model.pth"))
        return "model.pth"

    metadata = {**base_metadata, "model": {"type": "nn", "architecture": architecture}}
    return save_model_package(folder, name, metadata, write_model)


def save_xgboost_model(folder, name, booster, model_info, base_metadata):
    """Saves the final XGBoost booster of a simulation."""

    def write_model(directory):
        booster.save_model(os.path.join(directory, "model.json"))
        return "model.json"

    metadata = {**base_metadata, "model": {"type": "xgboost", **model_info}}
    return save_model_package(folder, name, metadata, write_model)


def set_package_threshold(path, threshold_selection):
    """Stores an optimized decision threshold in a .medflmodel file (the model file is kept as is)."""
    temporary_path = path + ".tmp"
    try:
        with zipfile.ZipFile(path) as source, zipfile.ZipFile(temporary_path, "w", zipfile.ZIP_DEFLATED) as target:
            for item in source.infolist():
                content = source.read(item.filename)
                if item.filename == "metadata.json":
                    metadata = json.loads(content)
                    metadata["model"]["threshold"] = threshold_selection["threshold"]
                    metadata["threshold_selection"] = threshold_selection
                    content = json.dumps(metadata, indent=2, default=str)
                target.writestr(item, content)
        os.replace(temporary_path, path)
    finally:
        if os.path.exists(temporary_path):
            os.remove(temporary_path)
