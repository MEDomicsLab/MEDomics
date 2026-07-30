"""Turns the confidence-metric formula typed in the MED3pa config form into a
MED3pa ``UncertaintyMetric``.

``UncertaintyCalculator`` accepts either one of MED3pa's registered metric names
or an ``UncertaintyMetric`` instance, so a free-text formula only needs to be
wrapped in an object exposing ``calculate``.

Note that everything here resolves to an *instance*, built-in names included.
MED3pa 1.0.4 stores the class rather than an instance on its string path and
then calls ``calculate`` with keywords only, so passing a name straight through
raises "missing 1 required positional argument: 'self'".

The formula itself is compiled and sandboxed by ``safe_expression``.
"""

import numpy as np

from MED3pa.med3pa.uncertainty import UncertaintyCalculator, UncertaintyMetric

from modules.med3pa.safe_expression import SafeExpression

DEFAULT_CONFIDENCE_METRIC = "sigmoidal_error"

# The per-observation values the formula may reference. `x` is the full
# observation matrix (n_samples, n_features); the other three are 1-D arrays of
# length n_samples, threshold being the base model's decision threshold.
_VARIABLES = ("x", "y_true", "predicted_prob", "threshold")

# The config form labels the formula "f(p, y)", so accept that short notation
# alongside the argument names MED3pa uses internally.
_VARIABLE_ALIASES = {
    "p": "predicted_prob",
    "prob": "predicted_prob",
    "y": "y_true",
    "t": "threshold",
}


class UserDefinedMetric(UncertaintyMetric):

    def __init__(self, expression: str):
        self._expression = SafeExpression(expression, _VARIABLES, _VARIABLE_ALIASES,
                                          label="confidence metric")
        self.expression = self._expression.expression
        self.probe_values = self._probe()

    def _probe(self) -> np.ndarray:
        """Run the formula on a tiny sample so a bad one fails now, not an hour
        into the experiment."""
        values = self.calculate(x=np.zeros((3, 1)),
                                predicted_prob=np.array([0.05, 0.5, 0.95]),
                                y_true=np.array([0.0, 1.0, 1.0]),
                                threshold=0.5)
        return self._expression.check_finite(values)

    @property
    def probe_out_of_range(self) -> bool:
        """True when the sample values fall outside [0, 1].

        MED3pa treats these as confidences, so the declaration-rate curve and the
        tree colouring both assume that range. Worth warning about, but not worth
        blocking a metric the user may have scaled deliberately.
        """
        return bool(self.probe_values.min() < 0.0 or self.probe_values.max() > 1.0)

    def calculate(self, x: np.ndarray, predicted_prob: np.ndarray, y_true: np.ndarray,
                  threshold=0.5) -> np.ndarray:
        return self._expression.evaluate(
            {"x": x, "predicted_prob": predicted_prob, "y_true": y_true,
             "threshold": threshold},
            expected_shape=np.shape(predicted_prob),
        )

    def __getstate__(self):
        return {"expression": self.expression}

    def __setstate__(self, state):
        self.__init__(state["expression"])

    def __str__(self):
        return self.expression

    def __repr__(self):
        return f"UserDefinedMetric({self.expression!r})"


def resolve_confidence_metric(value, warn=None) -> UncertaintyMetric:
    """Build the metric instance for whatever the config form sent.

    Accepts a built-in metric name, a formula, or an already-built metric, and
    always returns an instance so MED3pa's broken string path is never taken.
    """
    if isinstance(value, UncertaintyMetric):
        return value

    text = value.strip() if isinstance(value, str) else ""
    if not text:
        text = DEFAULT_CONFIDENCE_METRIC

    if text in UncertaintyCalculator.supported_metrics():
        return UncertaintyCalculator.metric_mapping[text]()

    metric = UserDefinedMetric(text)
    if warn is not None and metric.probe_out_of_range:
        warn(
            f"the custom confidence metric '{metric.expression}' returned values "
            f"outside [0, 1] on a sample ({metric.probe_values.tolist()}). MED3pa treats "
            f"these as confidences, so the declaration rates and the tree colouring may "
            f"be misleading."
        )
    return metric


def describe_confidence_metric(metric) -> str:
    """JSON-safe description, for the saved session config."""
    if isinstance(metric, UserDefinedMetric):
        return metric.expression
    for name, cls in UncertaintyCalculator.metric_mapping.items():
        if isinstance(metric, cls):
            return name
    if isinstance(metric, str):
        return metric
    return type(metric).__name__
