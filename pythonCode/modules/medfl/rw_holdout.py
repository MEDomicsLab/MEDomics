"""
Builds the MEDfl federated holdout configuration of a real-world run from its Federated Holdout node.

Each client tests the final global model on its own local holdout file after the last round
(see MEDfl.rw.holdout). The server aggregates the results and prints them on a log line the app reads.
"""
from MEDfl.rw.holdout import HoldoutConfig


def _as_bool(value, default):
    if value is None or value == "":
        return default
    if isinstance(value, str):
        return value.strip().lower() not in ("false", "0", "no")
    return bool(value)


def _as_number(value, default, cast):
    if value is None or value == "":
        return default
    return cast(float(value))


def _threshold_criterion(value):
    """MEDfl criterion key of a node value (key or label, as in threshold_selection.py)."""
    labels = {"youden": "Youden's J", "target_sensitivity": "Target sensitivity"}
    for key, label in labels.items():
        if value in (key, label):
            return key
    raise ValueError(f"Unknown threshold criterion '{value}' (expected one of: {', '.join(labels.values())})")


def build_holdout_config(json_config):
    """Returns the HoldoutConfig of the run, or None when there is no Federated Holdout node."""
    settings = json_config.get("flHoldoutNode")
    if not settings:
        return None
    optimized = str(settings.get("thresholdSource", "")).lower().startswith("optimized")
    threshold_options = {}
    if optimized:
        # the threshold is chosen on the clients' validation splits (MEDfl >= 2.0.11)
        threshold_options = dict(
            threshold_source="optimized",
            threshold_criterion=_threshold_criterion(settings.get("thresholdCriterion") or "youden"),
            target_sensitivity=_as_number(settings.get("targetSensitivity"), 0.9, float),
        )
    try:
        config = HoldoutConfig(
            enabled=True,
            threshold=_as_number(settings.get("threshold"), 0.5, float),
            num_bins=_as_number(settings.get("numBins"), 100, int),
            minimum_samples=_as_number(settings.get("minimumSamples"), 10, int),
            include_client_results=_as_bool(settings.get("includeClientResults"), True),
            **threshold_options,
        )
    except TypeError as exc:
        if threshold_options:
            raise RuntimeError("The optimized holdout threshold requires MEDfl 2.0.11 or later on the server") from exc
        raise
    config.validate()
    return config
