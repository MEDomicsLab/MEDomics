"""
Tests a saved MEDfl model (.medflmodel, see model_package.py) on a holdout dataset.

The holdout goes through the preprocessing MEDfl applied to the client test sets during training:
    1. keep the training feature columns, in the training order
    2. fill missing values with the holdout column means (training means for columns entirely missing)
    3. drop the rows without a target
    4. standardize with the scaler fitted on the clients' training data
    5. map binary targets {-1, 1} or {1, 2} to {0, 1}

The federated holdout test (evaluate_federated_holdout) tests the model on each client's own holdout file and
aggregates the client results the way the real-world server does (MEDfl.rw.holdout).
"""
import json
import os
import tempfile
import zipfile
from types import SimpleNamespace

import numpy as np
import pandas as pd
from MEDfl.rw.holdout import HOLDOUT_FAILED, HOLDOUT_MISSING, aggregate_federated_holdout, local_holdout_summary
from sklearn.metrics import roc_auc_score, roc_curve

MAX_ROC_POINTS = 200


def read_model_package(path):
    """Returns the metadata of a .medflmodel file and the path of its extracted model file (in a temporary folder)."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model file not found: {path}")
    with zipfile.ZipFile(path) as archive:
        metadata = json.loads(archive.read("metadata.json"))
        directory = tempfile.mkdtemp(prefix="medflmodel_")
        model_file = metadata["model"]["file"]
        archive.extract(model_file, directory)
    return metadata, os.path.join(directory, model_file)


def load_predictor(metadata, model_file):
    """Returns a function mapping preprocessed features (numpy array) to positive-class probabilities."""
    model_info = metadata["model"]

    if model_info["type"] == "nn":
        import torch
        import torch.nn as nn
        import torch.nn.functional as F

        # same layout as the BinaryClassifier trained in run_fl_pipeline_copy.py
        class BinaryClassifier(nn.Module):
            def __init__(self, input_size, num_layers, layer_size):
                super().__init__()
                layers = [nn.Linear(input_size, layer_size)]
                layers += [nn.Linear(layer_size, layer_size) for _ in range(num_layers - 1)]
                layers.append(nn.Linear(layer_size, 1))
                self.layers = nn.ModuleList(layers)

            def forward(self, x):
                for layer in self.layers[:-1]:
                    x = F.relu(layer(x))
                return self.layers[-1](x)

        architecture = model_info["architecture"]
        model = BinaryClassifier(architecture["input_size"], architecture["num_layers"], architecture["hidden_size"])
        model.load_state_dict(torch.load(model_file, map_location="cpu", weights_only=True), strict=True)
        model.eval()

        def predict(X):
            with torch.no_grad():
                return torch.sigmoid(model(torch.tensor(X, dtype=torch.float32))).squeeze(1).numpy()

        return predict

    if model_info["type"] == "xgboost":
        import xgboost as xgb

        if metadata.get("task", "binary") != "binary":
            raise ValueError(f"Holdout testing supports binary models only (this XGBoost model is '{metadata.get('task')}')")
        booster = xgb.Booster()
        booster.load_model(model_file)

        def predict(X):
            names = booster.feature_names
            matrix = xgb.DMatrix(X, feature_names=names if names and len(names) == X.shape[1] else None)
            return np.asarray(booster.predict(matrix), dtype=float)

        return predict

    raise ValueError(f"Unknown model type '{model_info['type']}'")


def load_model_package(path):
    """Returns the metadata of a .medflmodel file and its predictor (see load_predictor)."""
    metadata, model_file = read_model_package(path)
    try:
        return metadata, load_predictor(metadata, model_file)
    finally:
        os.remove(model_file)
        os.rmdir(os.path.dirname(model_file))


def prepare_holdout(metadata, holdout_path):
    """Applies the training preprocessing to the holdout file. Returns (X, y, dataset information)."""
    if not os.path.exists(holdout_path):
        raise FileNotFoundError(f"Holdout file not found: {holdout_path}")
    data = pd.read_csv(holdout_path)
    target = metadata["target"]
    features = metadata["features"]
    preprocessing = metadata["preprocessing"]

    if target not in data.columns:
        raise ValueError(f"The holdout dataset has no '{target}' column (the model target)")
    missing = [column for column in features if column not in data.columns]
    if missing:
        raise ValueError(f"The holdout dataset is missing {len(missing)} training column(s): {', '.join(missing)}")

    X = data[features].apply(pd.to_numeric, errors="coerce")
    non_numeric = [column for column in features if data[column].notna().any() and X[column].isna().all()]
    if non_numeric:
        raise ValueError(f"These holdout columns are not numeric: {', '.join(non_numeric)}")

    # 2. holdout means, as MEDfl does for client test sets; training means for columns with no value at all
    fallback = pd.Series(preprocessing["missing_values"]["fallback_values"], index=features)
    X = X.fillna(X.mean()).fillna(fallback)

    # 3. rows without a target are dropped
    y = pd.to_numeric(data[target], errors="coerce")
    keep = y.notna().values
    X, y = X.values[keep], y.values[keep].astype(float)
    if len(y) == 0:
        raise ValueError(f"The holdout dataset has no row with a '{target}' value")

    # 4. training scaler
    scaler = preprocessing["scaler"]
    X = (X - np.asarray(scaler["mean"])) / np.asarray(scaler["scale"])

    # 5. binary target mapping
    classes = set(np.unique(y))
    if classes == {-1.0, 1.0}:
        y = (y + 1.0) / 2.0
    elif classes == {1.0, 2.0}:
        y = y - 1.0
    classes = set(np.unique(y))
    if not classes.issubset({0.0, 1.0}):
        raise ValueError(
            f"The target '{target}' must be binary (0/1) in the holdout dataset, found {len(classes)} values: "
            f"{sorted(classes)[:10]}")

    info = {
        "name": os.path.basename(holdout_path),
        "path": holdout_path,
        "rows": int(len(y)),
        "rows_without_target": int((~keep).sum()),
        "positives": int(y.sum()),
        "negatives": int(len(y) - y.sum()),
    }
    return X.astype(np.float32), y, info


def binary_metrics(y_true, y_prob, threshold):
    """Same definitions as MEDfl's custom_classification_report, with a configurable threshold."""
    y_pred = (y_prob >= threshold).astype(float)
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    tn = int(((y_pred == 0) & (y_true == 0)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())

    def ratio(numerator, denominator):
        return numerator / denominator if denominator else 0.0

    sensitivity, ppv = ratio(tp, tp + fn), ratio(tp, tp + fp)
    both_classes = len(np.unique(y_true)) == 2
    metrics = {
        # AUC is undefined when the holdout contains a single class
        "auc": float(roc_auc_score(y_true, y_prob)) if both_classes else None,
        "accuracy": ratio(tp + tn, tp + tn + fp + fn),
        "sensitivity": sensitivity,
        "specificity": ratio(tn, tn + fp),
        "ppv": ppv,
        "npv": ratio(tn, tn + fn),
        "f1": ratio(2 * sensitivity * ppv, sensitivity + ppv),
    }

    roc = None
    if both_classes:
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        if len(fpr) > MAX_ROC_POINTS:
            keep = np.unique(np.linspace(0, len(fpr) - 1, MAX_ROC_POINTS).astype(int))
            fpr, tpr = fpr[keep], tpr[keep]
        roc = {"fpr": [float(v) for v in fpr], "tpr": [float(v) for v in tpr]}

    return metrics, {"TP": tp, "FP": fp, "FN": fn, "TN": tn}, roc


def evaluate_model_package(model_path, holdout_path, threshold=None):
    """Tests a .medflmodel file on a holdout CSV and returns the holdout results."""
    metadata, predict = load_model_package(model_path)

    if threshold is None:
        threshold = metadata["model"].get("threshold", 0.5)
    threshold = float(threshold)
    if not 0 < threshold < 1:
        raise ValueError(f"The threshold must be between 0 and 1 (got {threshold})")

    X, y, dataset = prepare_holdout(metadata, holdout_path)
    probabilities = predict(X)
    metrics, confusion, roc = binary_metrics(y, probabilities, threshold)

    return {
        "dataset": dataset,
        "threshold": threshold,
        "metrics": metrics,
        "confusion_matrix": confusion,
        "roc_curve": roc,
        "model": {"name": metadata.get("name"), "type": metadata["model"]["type"], "target": metadata["target"]},
    }


def evaluate_federated_holdout(model_path, client_holdouts, holdout_config):
    """
    Federated holdout test of a simulation: each client tests the final model on its own holdout file
    (with its own column means for the missing values, as for its test set) and only sends aggregate numbers.
    The results are aggregated by MEDfl's real-world holdout code, so the result has the real-world format.

    Args:
        model_path: .medflmodel file
        client_holdouts: list of (client name, holdout csv path or None)
        holdout_config: MEDfl HoldoutConfig (threshold, minimum samples, ...)
    """
    metadata, predict = load_model_package(model_path)

    results = []
    for name, holdout_path in client_holdouts:
        if not holdout_path:
            metrics = {"holdout_status": HOLDOUT_MISSING, "holdout_client_id": name,
                       "holdout_error": "No holdout dataset selected on this client"}
        else:
            try:
                X, y, dataset = prepare_holdout(metadata, holdout_path)
                dataset.pop("path", None)
                summary = local_holdout_summary(y, predict(X), holdout_config.threshold, holdout_config.num_bins,
                                                holdout_config.minimum_samples, name, dataset)
                metrics = {"holdout_status": summary["status"], "holdout_client_id": name,
                           "holdout_result": json.dumps(summary, allow_nan=False)}
            except Exception as e:
                metrics = {"holdout_status": HOLDOUT_FAILED, "holdout_client_id": name, "holdout_error": str(e)}
        # same (client, evaluate result) pairs as the ones the real-world server aggregates
        results.append((name, SimpleNamespace(metrics=metrics)))

    backend = "pytorch" if metadata["model"]["type"] == "nn" else metadata["model"]["type"]
    return aggregate_federated_holdout(results, [], holdout_config, backend)
