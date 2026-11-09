"""
Chooses the decision threshold of a binary MEDfl simulation model on the training clients' validation data.

The validation sets are the ones MEDfl splits from each training client (FederatedDataset.valloaders). They never
update the model, so choosing the threshold on them leaves the clients' test sets and the holdout untouched.
A simulation has all the validation predictions in one process, so the threshold is chosen exactly on the pooled
validation predictions.

Criteria:
    youden              maximizes sensitivity + specificity - 1
    target_sensitivity  highest threshold whose sensitivity reaches the target (the best specificity under it)
"""
import numpy as np

from holdout_eval import binary_metrics, load_model_package

# criterion key -> label of the Holdout Test node
CRITERIA = {"youden": "Youden's J", "target_sensitivity": "Target sensitivity"}

# the holdout tests require 0 < threshold < 1
MIN_THRESHOLD, MAX_THRESHOLD = 1e-9, 1 - 1e-9


def criterion_key(value):
    """Returns the criterion key of a Holdout Test node value (key or label)."""
    for key, label in CRITERIA.items():
        if value in (key, label):
            return key
    raise ValueError(f"Unknown threshold criterion '{value}' (expected one of: {', '.join(CRITERIA.values())})")


def collect_validation_data(fl_dataset):
    """
    Returns (X, y, number of clients with validation rows) from the training clients' validation sets.
    They are already preprocessed by MEDfl (imputed, scaled, binary targets mapped to 0/1).
    """
    X_parts, y_parts, clients = [], [], 0
    for loader in fl_dataset.valloaders or []:
        rows = 0
        for X_batch, y_batch in loader:
            X_parts.append(np.asarray(X_batch, dtype=np.float32))
            y_parts.append(np.asarray(y_batch, dtype=float).reshape(-1))
            rows += len(y_batch)
        if rows:
            clients += 1
    if not clients:
        raise ValueError("The training clients have no validation data: set a validation fraction above 0 "
                         "in the MasterDataset node")
    return np.concatenate(X_parts), np.concatenate(y_parts), clients


def select_threshold(y_true, y_prob, criterion, target_sensitivity=None):
    """
    Chooses the threshold on (y_true, y_prob) and returns (threshold, description of the choice).

    A threshold between two consecutive distinct scores gives the same predictions anywhere in that interval:
    the threshold is placed halfway, so it does not sit on a validation score.
    """
    y_true = np.asarray(y_true, dtype=float)
    y_prob = np.asarray(y_prob, dtype=float)
    if not set(np.unique(y_true)).issubset({0.0, 1.0}):
        raise ValueError("Threshold optimization requires a binary 0/1 target")
    positives = int(y_true.sum())
    negatives = len(y_true) - positives
    if positives == 0 or negatives == 0:
        raise ValueError(f"The validation data has a single class ({positives} positive, {negatives} negative): "
                         f"the threshold cannot be optimized")

    # candidate k predicts positive the scores >= scores[k]
    scores = np.unique(y_prob)
    tp = positives - np.searchsorted(np.sort(y_prob[y_true == 1]), scores, side="left")
    fp = negatives - np.searchsorted(np.sort(y_prob[y_true == 0]), scores, side="left")
    sensitivity = tp / positives
    specificity = 1 - fp / negatives

    if criterion == "youden":
        youden = sensitivity + specificity - 1
        ties = np.flatnonzero(youden >= youden.max() - 1e-12)
        # the middle of the best plateau
        k = int(ties[len(ties) // 2])
    elif criterion == "target_sensitivity":
        target = float(target_sensitivity)
        if not 0 < target <= 1:
            raise ValueError(f"The target sensitivity must be between 0 and 1 (got {target})")
        # sensitivity decreases with k, and k = 0 (all positive) always reaches the target
        k = int(np.flatnonzero(sensitivity >= target - 1e-12).max())
    else:
        raise ValueError(f"Unknown threshold criterion '{criterion}'")

    threshold = scores[k]
    if k > 0:
        midpoint = (scores[k - 1] + scores[k]) / 2
        # two adjacent floats can have a midpoint equal to the lower one
        if midpoint > scores[k - 1]:
            threshold = midpoint
    threshold = float(np.clip(threshold, MIN_THRESHOLD, MAX_THRESHOLD))

    # metrics at the threshold actually used
    # the validation ROC curve, to show the chosen point on it
    metrics, confusion, roc = binary_metrics(y_true, y_prob, threshold)
    return threshold, {
        "criterion": criterion,
        "criterion_label": CRITERIA[criterion],
        "target_sensitivity": float(target_sensitivity) if criterion == "target_sensitivity" else None,
        "threshold": threshold,
        "validation": {"rows": len(y_true), "positives": positives, "negatives": negatives},
        "metrics": metrics,
        "confusion_matrix": confusion,
        "roc_curve": roc,
    }


def optimize_model_threshold(model_path, fl_dataset, criterion, target_sensitivity=None):
    """Chooses the threshold of a .medflmodel file on the pooled validation sets of the training clients."""
    metadata, predict = load_model_package(model_path)
    X, y, clients = collect_validation_data(fl_dataset)
    if X.shape[1] != len(metadata["features"]):
        raise ValueError(f"The validation data has {X.shape[1]} features but the model was trained on "
                         f"{len(metadata['features'])}")
    _, selection = select_threshold(y, predict(X), criterion_key(criterion), target_sensitivity)
    selection["validation"]["clients"] = clients
    return selection
