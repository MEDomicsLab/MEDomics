"""Turns the confidence-metric formula typed in the MED3pa config form into a
MED3pa ``UncertaintyMetric``.

``UncertaintyCalculator`` accepts either one of MED3pa's registered metric names
or an ``UncertaintyMetric`` instance, so a free-text formula only needs to be
wrapped in an object exposing ``calculate``.

Note that everything here resolves to an *instance*, built-in names included.
MED3pa 1.0.4 stores the class rather than an instance on its string path and
then calls ``calculate`` with keywords only, so passing a name straight through
raises "missing 1 required positional argument: 'self'".

The formula is evaluated with ``eval``, which is only safe because the AST is
whitelisted first: emptying ``__builtins__`` on its own does not contain an
expression, since ``().__class__.__base__.__subclasses__()`` walks back to the
real builtins using nothing but attribute access.
"""

import ast

import numpy as np

from MED3pa.med3pa.uncertainty import UncertaintyCalculator, UncertaintyMetric

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

# numpy callables the formula may use, either bare or `np.`-prefixed. Attribute
# access is checked against this same set, so `np.<anything else>` is rejected
# rather than trusting numpy to keep its own submodules private.
_SAFE_NUMPY_NAMES = (
    "abs", "absolute", "sign", "clip", "where", "minimum", "maximum",
    "exp", "expm1", "log", "log1p", "log2", "log10", "sqrt", "square", "power",
    "sin", "cos", "tan", "arctan", "sinh", "cosh", "tanh",
    "floor", "ceil", "round", "mean", "std", "median",
    "isnan", "isfinite", "nan_to_num", "logical_and", "logical_or", "logical_not",
)
_SAFE_CONSTANTS = {"pi": np.pi, "e": np.e, "inf": np.inf}

# Formulas get pasted out of papers and out of the form's own help text, so fold
# typographic operators back to the ASCII ones Python can parse.
_TYPOGRAPHIC_OPERATORS = str.maketrans({
    "−": "-",   # minus sign
    "–": "-",   # en dash
    "—": "-",   # em dash
    "×": "*",   # multiplication sign
    "⋅": "*",   # dot operator
    "÷": "/",   # division sign
    "⁄": "/",   # fraction slash
    " ": " ",   # non-breaking space
    "‘": "'", "’": "'", "“": '"', "”": '"',
})

_ALLOWED_NODES = (
    ast.Expression, ast.Constant, ast.Name, ast.Load,
    ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare, ast.IfExp,
    ast.Call, ast.keyword, ast.Attribute, ast.Tuple, ast.List,
    ast.Subscript, ast.Slice,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
    ast.UAdd, ast.USub, ast.Not, ast.And, ast.Or,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
)


def _allowed_names():
    """Every bare identifier the formula is allowed to mention."""
    names = set(_VARIABLES) | set(_VARIABLE_ALIASES) | set(_SAFE_CONSTANTS)
    names.update(_SAFE_NUMPY_NAMES)
    names.add("np")
    return names


def _validate(tree: ast.AST, expression: str) -> None:
    """Reject anything outside the arithmetic subset before the formula runs."""
    allowed = _allowed_names()
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise ValueError(
                f"'{type(node).__name__}' is not allowed in a confidence metric. "
                f"Use arithmetic, comparisons and the supported functions "
                f"({', '.join(sorted(_SAFE_NUMPY_NAMES))})."
            )
        if isinstance(node, ast.Name):
            if node.id.startswith("__"):
                raise ValueError(f"'{node.id}' is not allowed in a confidence metric.")
            if node.id not in allowed:
                raise ValueError(
                    f"Unknown name '{node.id}' in the confidence metric. "
                    f"Available variables: {', '.join(sorted(set(_VARIABLES) | set(_VARIABLE_ALIASES)))}."
                )
        if isinstance(node, ast.Attribute):
            # Only `np.<whitelisted>` — this is what blocks the walk back to the
            # real builtins through `().__class__`, whose root is not a Name.
            if not isinstance(node.value, ast.Name) or node.value.id != "np":
                raise ValueError(
                    "Attribute access is only allowed on 'np' in a confidence metric."
                )
            if node.attr not in _SAFE_NUMPY_NAMES:
                raise ValueError(
                    f"'np.{node.attr}' is not available in a confidence metric. "
                    f"Supported: {', '.join(sorted(_SAFE_NUMPY_NAMES))}."
                )
    _ = expression


class UserDefinedMetric(UncertaintyMetric):

    def __init__(self, expression: str):
        if not isinstance(expression, str) or not expression.strip():
            raise ValueError("The custom confidence metric is empty.")
        self.expression = expression.strip()
        self._build()
        self.probe_values = self._probe()

    def _build(self) -> None:
        source = self.expression.translate(_TYPOGRAPHIC_OPERATORS)
        try:
            tree = ast.parse(source, mode="eval")
        except SyntaxError as exc:
            raise ValueError(
                f"Could not parse the confidence metric '{self.expression}': {exc.msg}"
            ) from exc
        _validate(tree, self.expression)
        # Compiled once here rather than per call: `calculate` runs over every
        # observation in the dataset.
        self._code = compile(tree, "<confidence_metric>", "eval")
        self._globals = {"np": np, "__builtins__": {}}
        self._globals.update({name: getattr(np, name) for name in _SAFE_NUMPY_NAMES})
        self._globals.update(_SAFE_CONSTANTS)

    def _probe(self) -> np.ndarray:
        """Run the formula on a tiny sample so a bad one fails now, not an hour
        into the experiment."""
        probe_prob = np.array([0.05, 0.5, 0.95])
        probe_true = np.array([0.0, 1.0, 1.0])
        probe_x = np.zeros((3, 1))
        try:
            values = self.calculate(x=probe_x, predicted_prob=probe_prob,
                                    y_true=probe_true, threshold=0.5)
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError(
                f"The confidence metric '{self.expression}' failed to evaluate: {exc}"
            ) from exc
        if not np.all(np.isfinite(values)):
            raise ValueError(
                f"The confidence metric '{self.expression}' produced non-finite values "
                f"(got {values.tolist()}). Guard divisions and logs, e.g. with clip()."
            )
        return values

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
        local_names = {
            "x": x,
            "y_true": y_true,
            "predicted_prob": predicted_prob,
            "threshold": threshold,
        }
        for alias, target in _VARIABLE_ALIASES.items():
            local_names[alias] = local_names[target]
        try:
            values = eval(self._code, self._globals, local_names)
        except Exception as exc:
            raise ValueError(
                f"The confidence metric '{self.expression}' failed to evaluate: {exc}"
            ) from exc
        values = np.asarray(values, dtype=float)
        # A formula that ignores its inputs still owes the IPC model one value
        # per observation.
        expected = np.shape(predicted_prob)
        if values.shape != expected:
            try:
                values = np.broadcast_to(values, expected).astype(float, copy=True)
            except ValueError as exc:
                raise ValueError(
                    f"The confidence metric '{self.expression}' returned shape "
                    f"{values.shape}, expected {expected} (one value per observation)."
                ) from exc
        return values

    # Med3paExperiment.run is wrapped in @checkpoint, which hashes its arguments,
    # and the trained models are pickled into MongoDB afterwards. Neither can
    # handle a code object, so the formula text is the only state that travels.
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
            f"WARNING: the custom confidence metric '{metric.expression}' returned values "
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
