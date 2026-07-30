"""Turns the MPC combination strategy typed in the MED3pa config form into
something ``MPCModel`` will actually use.

This mirrors ``confidence_metrics`` but needs one extra step. ``UncertaintyCalculator``
was given an extension point upstream (it accepts an ``UncertaintyMetric`` instance),
whereas ``MPCModel`` has none:

    supported_strategy = ["minimum"]
    assert strategy in MPCModel.supported_strategy
    ...
    if self.strategy == "minimum":
        return np.minimum(IPC, APC)

Both the constructor and ``predict`` hard-code the single supported name, and
``Med3paExperiment`` builds the MPCModel internally so a subclass cannot be
injected. ``install()`` therefore patches those two methods in place, leaving the
built-in "minimum" behaviour untouched and adding a branch for our strategies.

Note that "average" is offered by the config form but is *not* one of MED3pa's
supported strategies -- without this module it raises AssertionError.
"""

import numpy as np

from MED3pa.med3pa.models import MPCModel

from modules.med3pa.safe_expression import SafeExpression

DEFAULT_MPC_STRATEGY = "minimum"

# The form labels the formula "f(IPC, APC)"; both are 1-D arrays of per-observation
# confidences, already predicted by the trained IPC and APC models.
_VARIABLES = ("IPC", "APC")
_VARIABLE_ALIASES = {"ipc": "IPC", "apc": "APC"}

# Named strategies, expressed as formulas so they take exactly the same path as a
# user-typed one. "minimum" is also MED3pa's own default.
BUILTIN_STRATEGIES = {
    "minimum": "minimum(IPC, APC)",
    "average": "(IPC + APC) / 2",
}


class MpcStrategy:
    """Combines the IPC and APC confidence columns into the MPC column."""

    def __init__(self, expression: str, name: str = None):
        self._expression = SafeExpression(expression, _VARIABLES, _VARIABLE_ALIASES,
                                          label="MPC strategy")
        self.expression = self._expression.expression
        # Built-ins keep their name so the saved config reads "minimum" rather
        # than the formula it happens to be implemented with.
        self.name = name
        self.probe_values = self._probe()

    def _probe(self) -> np.ndarray:
        """Evaluate on a tiny sample so a bad formula fails before training."""
        values = self.combine(np.array([0.1, 0.5, 0.9]), np.array([0.8, 0.4, 0.2]))
        return self._expression.check_finite(values)

    @property
    def probe_out_of_range(self) -> bool:
        """True when the sample values fall outside [0, 1].

        MPC values are confidences: the declaration-rate sweep and the tree
        colouring both assume that range.
        """
        return bool(self.probe_values.min() < 0.0 or self.probe_values.max() > 1.0)

    def combine(self, ipc_values: np.ndarray, apc_values: np.ndarray) -> np.ndarray:
        return self._expression.evaluate(
            {"IPC": np.asarray(ipc_values, dtype=float),
             "APC": np.asarray(apc_values, dtype=float)},
            expected_shape=np.shape(ipc_values),
        )

    def __getstate__(self):
        return {"expression": self.expression, "name": self.name}

    def __setstate__(self, state):
        self.__init__(state["expression"], state["name"])

    def __str__(self):
        return self.name or self.expression

    def __repr__(self):
        return f"MpcStrategy({self.expression!r}, name={self.name!r})"


def resolve_mpc_strategy(value, warn=None) -> MpcStrategy:
    """Build the strategy for whatever the config form sent.

    Accepts a built-in name, a formula, or an already-built strategy. Always
    returns an MpcStrategy so every run takes one code path.
    """
    if isinstance(value, MpcStrategy):
        return value

    text = value.strip() if isinstance(value, str) else ""
    if not text:
        text = DEFAULT_MPC_STRATEGY

    if text in BUILTIN_STRATEGIES:
        return MpcStrategy(BUILTIN_STRATEGIES[text], name=text)

    strategy = MpcStrategy(text)
    if warn is not None and strategy.probe_out_of_range:
        warn(
            f"the custom MPC strategy '{strategy.expression}' returned values outside "
            f"[0, 1] on a sample ({strategy.probe_values.tolist()}). MPC values are "
            f"treated as confidences, so the declaration rates and the tree colouring "
            f"may be misleading."
        )
    return strategy


def describe_mpc_strategy(strategy) -> str:
    """JSON-safe description, for the saved session config."""
    if isinstance(strategy, MpcStrategy):
        return strategy.name or strategy.expression
    if isinstance(strategy, str):
        return strategy
    return type(strategy).__name__


def install() -> None:
    """Teach MED3pa's MPCModel to accept an MpcStrategy. Safe to call repeatedly."""
    if getattr(MPCModel, "_medomics_strategy_patch", False):
        return

    original_init = MPCModel.__init__
    original_predict = MPCModel.predict

    def __init__(self, IPC_model, APC_model, strategy=DEFAULT_MPC_STRATEGY):
        # MED3pa's own __init__ asserts the strategy is in supported_strategy,
        # which only ever contains "minimum"; bypass it for our objects only.
        if isinstance(strategy, MpcStrategy):
            self.IPC_model = IPC_model
            self.APC_model = APC_model
            self.strategy = strategy
        else:
            original_init(self, IPC_model, APC_model, strategy)

    def predict(self, X):
        if isinstance(self.strategy, MpcStrategy):
            return self.strategy.combine(self.IPC_model.predict(X),
                                         self.APC_model.predict(X))
        return original_predict(self, X)

    MPCModel.__init__ = __init__
    MPCModel.predict = predict
    MPCModel._medomics_strategy_patch = True
