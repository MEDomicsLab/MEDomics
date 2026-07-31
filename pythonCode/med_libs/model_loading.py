"""Loading of base models stored as ``.medmodel`` MEDDataObjects.

A ``.medmodel`` is a MEDDataObject acting as a folder. Models saved by the
Learning module hold a pickled sklearn estimator; models brought in through the
external-model import hold either that or a raw ONNX graph. Both are resolved
here to the same thing: an object exposing ``predict_proba(X) -> (n, 2)``.

That is the entire contract MED3pa requires of a base model -- Med3paExperiment
only ever calls ``base_model_manager.predict_proba(observations)[:, 1]`` and
reads ``.threshold`` -- so anything satisfying it can serve as a base model.
"""

import numpy as np

from .mongodb_utils import (connect_to_mongo, get_child_id_by_name,
                            get_pickled_model_from_collection)

# onnxruntime reports input types as strings; map them to what the graph expects
# so a float64 or int64 export is not silently truncated by a hardcoded cast.
NUMPY_DTYPE_BY_ONNX_TYPE = {
    "tensor(float)": np.float32,
    "tensor(double)": np.float64,
    "tensor(int64)": np.int64,
    "tensor(int32)": np.int32,
}


def _sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


def _softmax(z):
    shifted = z - np.max(z, axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=1, keepdims=True)


class OnnxProbabilityModel:
    """Adapts an ONNX graph to the ``predict_proba`` contract.

    Accepts the export shapes that actually turn up for binary tabular
    classifiers:

    - skl2onnx's default ZipMap output, which is a list of ``{class: proba}``
      dicts rather than an array;
    - a plain ``(n, 2)`` probability tensor (skl2onnx with ``zipmap=False``);
    - a single-column ``(n, 1)`` or ``(n,)`` output, which is what a PyTorch or
      TensorFlow binary head with one sigmoid unit produces.

    ``raw_logits`` must be set explicitly when the graph stops short of the
    final activation. It cannot be detected: logits that happen to land in
    [0, 1] are indistinguishable from probabilities, and guessing wrong yields
    confidence scores that are wrong but entirely plausible-looking.
    """

    def __init__(self, onnx_bytes, output=None, raw_logits=False):
        self._onnx_bytes = onnx_bytes
        self._output = output
        self.raw_logits = raw_logits
        self._init_session()

    def _init_session(self):
        try:
            import onnxruntime as ort
        except ImportError as e:
            raise ImportError(
                "onnxruntime is required to use ONNX base models. "
                "Install it with 'pip install onnxruntime'."
            ) from e

        self.session = ort.InferenceSession(
            self._onnx_bytes, providers=["CPUExecutionProvider"]
        )

        inputs = self.session.get_inputs()
        if len(inputs) != 1:
            raise ValueError(
                f"This ONNX model takes {len(inputs)} inputs "
                f"({[i.name for i in inputs]}). Only single-input graphs are "
                f"supported: a multi-input graph gives no way to know which "
                f"features belong to which input."
            )
        self.input_name = inputs[0].name
        self.input_dtype = NUMPY_DTYPE_BY_ONNX_TYPE.get(inputs[0].type, np.float32)

    # An InferenceSession cannot be pickled, so round-trip the bytes instead.
    # Without this, anything that deep-copies the base model (BaseModelManager's
    # clone, a debugging pickle) fails with an opaque error.
    def __getstate__(self):
        return {
            "_onnx_bytes": self._onnx_bytes,
            "_output": self._output,
            "raw_logits": self.raw_logits,
        }

    def __setstate__(self, state):
        self.__dict__.update(state)
        self._init_session()

    def _select_output(self, outputs):
        """Pick the tensor holding probabilities out of the graph's outputs."""
        names = [o.name for o in self.session.get_outputs()]

        if isinstance(self._output, int):
            return outputs[self._output]
        if isinstance(self._output, str):
            if self._output not in names:
                raise ValueError(
                    f"Output '{self._output}' not found in this ONNX model. "
                    f"Available outputs: {names}."
                )
            return outputs[names.index(self._output)]

        if len(outputs) == 1:
            return outputs[0]
        for i, name in enumerate(names):
            if "prob" in name.lower():
                return outputs[i]
        # skl2onnx emits [label, probabilities] in that order.
        return outputs[1]

    def _to_matrix(self, raw, n_rows):
        """Normalize whatever the graph returned into an (n, 2) float array."""
        # ZipMap: a list of {class_label: probability} dicts, one per row.
        if isinstance(raw, list) and raw and isinstance(raw[0], dict):
            classes = sorted(raw[0].keys())
            if len(classes) != 2:
                raise ValueError(
                    f"This ONNX model predicts {len(classes)} classes "
                    f"({classes}). MED3pa supports binary classification only."
                )
            return np.array([[row[c] for c in classes] for row in raw], dtype=float)

        probs = np.asarray(raw, dtype=float)
        if probs.ndim == 1:
            probs = probs.reshape(n_rows, -1)

        if probs.shape[1] == 1:
            positive = probs[:, 0]
            if self.raw_logits:
                positive = _sigmoid(positive)
            return np.column_stack([1.0 - positive, positive])

        if probs.shape[1] == 2:
            return _softmax(probs) if self.raw_logits else probs

        raise ValueError(
            f"This ONNX model outputs {probs.shape[1]} columns. MED3pa supports "
            f"binary classification only, which means a 1- or 2-column output."
        )

    def predict_proba(self, X):
        X = np.asarray(X, dtype=self.input_dtype)
        outputs = self.session.run(None, {self.input_name: X})
        probs = self._to_matrix(self._select_output(outputs), len(X))

        # A graph that was exported without its final activation, but not
        # declared as such, produces values outside [0, 1]. Saying so here is
        # far better than letting them propagate into confidence scores.
        if not self.raw_logits and (probs.min() < -0.01 or probs.max() > 1.01):
            raise ValueError(
                f"This ONNX model returned values in "
                f"[{probs.min():.3f}, {probs.max():.3f}], which are not "
                f"probabilities. If the graph was exported without its final "
                f"sigmoid/softmax, re-import it with 'raw logits' enabled."
            )
        return np.clip(probs, 0.0, 1.0)

    def predict(self, X, threshold=0.5):
        return (self.predict_proba(X)[:, 1] >= threshold).astype(int)

    def get_params(self):
        """The graph's shape, standing in for sklearn hyperparameters.

        An ONNX graph has no hyperparameters to report -- it is already fitted
        and its training-time settings are not preserved -- so describe how it
        is being driven instead.
        """
        return {
            "input_name": self.input_name,
            # A numpy dtype class is not JSON-serialisable, and this dict ends up
            # in the session document.
            "input_dtype": np.dtype(self.input_dtype).name,
            "outputs": [o.name for o in self.session.get_outputs()],
            "selected_output": self._output,
            "raw_logits": self.raw_logits,
        }

    def get_info(self):
        """Model description for MED3pa's experiment config.

        BaseModelManager.get_info prefers this method and only falls back to
        get_params() on the wrapped object when it is absent.
        """
        return {
            "model": type(self).__name__,
            "model_type": "onnx",
            "params": self.get_params(),
            "data_preparation_strategy": None,
            "pickled_model": False,
            "file_path": "",
        }


def get_model_metadata(model_object_id):
    """Read the ``metadata.json`` child of a ``.medmodel``.

    Returns an empty dict when absent, so callers can stay tolerant of models
    saved before a given metadata field existed.
    """
    metadata_id = get_child_id_by_name(model_object_id, "metadata.json")
    if metadata_id is None:
        return {}
    db = connect_to_mongo()
    document = db[metadata_id].find_one({})
    if not document:
        return {}
    metadata = dict(document)
    metadata.pop("_id", None)
    return metadata


def _get_onnx_bytes(child_id):
    db = connect_to_mongo()
    document = db[child_id].find_one({})
    if not document:
        raise ValueError(f"No ONNX content found in collection {child_id}.")
    if "onnx" in document:
        return bytes(document["onnx"])
    if "model_path" in document:
        # Graphs over the 16MB BSON cap are left on disk and referenced by path,
        # mirroring how oversized pickles are handled.
        with open(document["model_path"], "rb") as f:
            return f.read()
    raise ValueError(f"Collection {child_id} holds no 'onnx' or 'model_path' field.")


def load_base_model(model_object_id):
    """Load a ``.medmodel`` as a ``predict_proba``-capable object.

    Returns:
        tuple: (model, metadata dict)
    """
    metadata = get_model_metadata(model_object_id)

    if metadata.get("framework") == "onnx":
        onnx_child_id = get_child_id_by_name(model_object_id, "model.onnx")
        if onnx_child_id is None:
            raise ValueError(
                f"Model {model_object_id} is declared as ONNX but has no "
                f"'model.onnx' child."
            )
        model = OnnxProbabilityModel(
            _get_onnx_bytes(onnx_child_id),
            output=metadata.get("onnx_output"),
            raw_logits=metadata.get("onnx_raw_logits", False),
        )
        return model, metadata

    # Prefer the pycaret-free estimator; fall back to the full pipeline for
    # models saved before that export existed.
    pickle_object_id = get_child_id_by_name(model_object_id, "model_sklearn.pkl")
    if pickle_object_id is None:
        pickle_object_id = get_child_id_by_name(model_object_id, "model.pkl")
    if pickle_object_id is None:
        raise ValueError(
            f"Could not find 'model_sklearn.pkl' or 'model.pkl' inside model "
            f"{model_object_id}."
        )

    model = get_pickled_model_from_collection(pickle_object_id)
    if model is None:
        raise ValueError("The base model could not be loaded from the database.")
    return model, metadata


def get_model_feature_columns(metadata):
    """The ordered feature list a model expects, or None when unknown.

    ``sklearn_columns`` is the transformed feature space the estimator actually
    sees; ``columns`` is the pre-transformation list. Externally imported models
    write the same list to both.
    """
    return metadata.get("sklearn_columns") or metadata.get("columns") or None
