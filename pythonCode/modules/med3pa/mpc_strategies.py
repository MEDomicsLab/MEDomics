"""Turns the MPC combination strategy typed in the MED3pa config form into
something ``MPCModel`` will actually use.
"""

import numpy as np

from MED3pa.med3pa.models import MPCModel, MpcStrategy

from modules.med3pa.safe_expression import SafeExpression

DEFAULT_MPC_STRATEGY = "minimum"

# The form labels the formula "f(IPC, APC)"; both are 1-D arrays of per-observation
# confidences, already predicted by the trained IPC and APC models.
_VARIABLES = ("IPC", "APC")
_VARIABLE_ALIASES = {"ipc": "IPC", "apc": "APC"}

class UserDefinedMpcStrategy(MpcStrategy):
    """Combines the IPC and APC confidence columns into the MPC column."""

    def __init__(self, expression: str, name: str = None):
        self._expression = SafeExpression(expression, _VARIABLES, _VARIABLE_ALIASES,
                                          label="MPC strategy")
        self.expression = self._expression.expression
        # Built-ins keep their name so the saved config reads "minimum" rather
        # than the formula it happens to be implemented with.
        self._name = name
        self.probe_values = self._probe()
    @property
    def name(self) -> str:
        return self._name or self.expression
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
        return {"expression": self.expression, "name": self._name}
    
    def __setstate__(self, state):
        self.__init__(state["expression"], state["name"])

    def __str__(self):
        return self.name

    def __repr__(self):
        return f"UserDefinedMpcStrategy({self.expression!r}, name={self._name!r})"


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

    if text in MPCModel.strategy_mapping:
        return MPCModel.strategy_mapping[text]()

    strategy = UserDefinedMpcStrategy(text)
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
        return strategy.name
    if isinstance(strategy, str):
        return strategy
    return type(strategy).__name__


