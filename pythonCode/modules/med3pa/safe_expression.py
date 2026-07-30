"""Compiles a formula typed into the MED3pa config form into a restricted,
array-aware callable.

Shared by the IPC confidence metric and the MPC combination strategy: both take
free text from the form and both must evaluate it over whole columns of
observations. Only the variable names differ, so they are passed in.

The formula is evaluated with ``eval``, which is only safe because the AST is
whitelisted first. Emptying ``__builtins__`` does not contain an expression on
its own, since ``().__class__.__base__.__subclasses__()`` walks back to the real
builtins using nothing but attribute access.
"""

import ast

import numpy as np

# numpy callables a formula may use, either bare or `np.`-prefixed. Attribute
# access is checked against this same set, so `np.<anything else>` is rejected
# rather than trusting numpy to keep its own submodules private.
SAFE_NUMPY_NAMES = (
    "abs", "absolute", "sign", "clip", "where", "minimum", "maximum",
    "exp", "expm1", "log", "log1p", "log2", "log10", "sqrt", "square", "power",
    "sin", "cos", "tan", "arctan", "sinh", "cosh", "tanh",
    "floor", "ceil", "round", "mean", "std", "median",
    "isnan", "isfinite", "nan_to_num", "logical_and", "logical_or", "logical_not",
)
SAFE_CONSTANTS = {"pi": np.pi, "e": np.e, "inf": np.inf}

# Formulas get pasted out of papers and out of the form's own help text, so fold
# typographic operators back to the ASCII ones Python can parse.
TYPOGRAPHIC_OPERATORS = str.maketrans({
    "−": "-",   # minus sign
    "–": "-",   # en dash
    "—": "-",   # em dash
    "×": "*",   # multiplication sign
    "⋅": "*",   # dot operator
    "÷": "/",   # division sign
    "⁄": "/",   # fraction slash
    " ": " ",   # non-breaking space
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


class SafeExpression:
    """One compiled formula, restricted to arithmetic over the given variables."""

    def __init__(self, expression: str, variables, aliases: dict = None,
                 label: str = "expression"):
        if not isinstance(expression, str) or not expression.strip():
            raise ValueError(f"The custom {label} is empty.")
        self.expression = expression.strip()
        self.variables = tuple(variables)
        self.aliases = dict(aliases or {})
        self.label = label
        self._build()

    def _build(self) -> None:
        source = self.expression.translate(TYPOGRAPHIC_OPERATORS)
        try:
            tree = ast.parse(source, mode="eval")
        except SyntaxError as exc:
            raise ValueError(
                f"Could not parse the {self.label} '{self.expression}': {exc.msg}"
            ) from exc
        self._validate(tree)
        # Compiled once here rather than per call: the formula runs over every
        # observation in the dataset.
        self._code = compile(tree, f"<{self.label}>", "eval")
        self._globals = {"np": np, "__builtins__": {}}
        self._globals.update({name: getattr(np, name) for name in SAFE_NUMPY_NAMES})
        self._globals.update(SAFE_CONSTANTS)

    def _allowed_names(self) -> set:
        names = set(self.variables) | set(self.aliases) | set(SAFE_CONSTANTS)
        names.update(SAFE_NUMPY_NAMES)
        names.add("np")
        return names

    def _validate(self, tree: ast.AST) -> None:
        """Reject anything outside the arithmetic subset before the formula runs."""
        allowed = self._allowed_names()
        usable = ", ".join(sorted(set(self.variables) | set(self.aliases)))
        for node in ast.walk(tree):
            if not isinstance(node, _ALLOWED_NODES):
                raise ValueError(
                    f"'{type(node).__name__}' is not allowed in a {self.label}. "
                    f"Use arithmetic, comparisons and the supported functions "
                    f"({', '.join(sorted(SAFE_NUMPY_NAMES))})."
                )
            if isinstance(node, ast.Name):
                if node.id.startswith("__"):
                    raise ValueError(f"'{node.id}' is not allowed in a {self.label}.")
                if node.id not in allowed:
                    raise ValueError(
                        f"Unknown name '{node.id}' in the {self.label}. "
                        f"Available variables: {usable}."
                    )
            if isinstance(node, ast.Attribute):
                # Only `np.<whitelisted>` — this is what blocks the walk back to
                # the real builtins through `().__class__`, whose root is not a Name.
                if not isinstance(node.value, ast.Name) or node.value.id != "np":
                    raise ValueError(
                        f"Attribute access is only allowed on 'np' in a {self.label}."
                    )
                if node.attr not in SAFE_NUMPY_NAMES:
                    raise ValueError(
                        f"'np.{node.attr}' is not available in a {self.label}. "
                        f"Supported: {', '.join(sorted(SAFE_NUMPY_NAMES))}."
                    )

    def evaluate(self, values: dict, expected_shape=None) -> np.ndarray:
        """Run the formula. `values` is keyed by the canonical variable names."""
        local_names = dict(values)
        for alias, target in self.aliases.items():
            local_names[alias] = values[target]
        try:
            raw = eval(self._code, self._globals, local_names)
        except Exception as exc:
            raise ValueError(
                f"The {self.label} '{self.expression}' failed to evaluate: {exc}"
            ) from exc
        result = np.asarray(raw, dtype=float)
        # A formula that ignores its inputs still owes one value per observation.
        if expected_shape is not None and result.shape != expected_shape:
            try:
                result = np.broadcast_to(result, expected_shape).astype(float, copy=True)
            except ValueError as exc:
                raise ValueError(
                    f"The {self.label} '{self.expression}' returned shape "
                    f"{result.shape}, expected {expected_shape} (one value per observation)."
                ) from exc
        return result

    def check_finite(self, values: np.ndarray) -> np.ndarray:
        if not np.all(np.isfinite(values)):
            raise ValueError(
                f"The {self.label} '{self.expression}' produced non-finite values "
                f"(got {values.tolist()}). Guard divisions and logs, e.g. with clip()."
            )
        return values

    # Med3paExperiment.run is wrapped in @checkpoint, which hashes its arguments,
    # and models get pickled into MongoDB afterwards. Neither can handle a code
    # object, so the formula text is the only state that travels.
    def __getstate__(self):
        return {"expression": self.expression, "variables": self.variables,
                "aliases": self.aliases, "label": self.label}

    def __setstate__(self, state):
        self.__init__(state["expression"], state["variables"],
                      state["aliases"], state["label"])

    def __str__(self):
        return self.expression
