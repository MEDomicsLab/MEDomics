"""Loading of base models stored as ``.medmodel`` MEDDataObjects.

A ``.medmodel`` is a MEDDataObject acting as a folder. Models saved by the
Learning module hold a pickled sklearn estimator; models brought in through the
external-model import hold either that or a raw ONNX graph. Both are resolved
here to the same thing: an object exposing ``predict_proba(X) -> (n, 2)``.

That is the entire contract MED3pa requires of a base model -- Med3paExperiment
only ever calls ``base_model_manager.predict_proba(observations)[:, 1]`` and
reads ``.threshold`` -- so anything satisfying it can serve as a base model.
"""

import importlib
import io
import os
import sys
import tempfile

import numpy as np

from .mongodb_utils import (_deserialize_model, connect_to_mongo,
                            get_child_id_by_name,
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


def normalise_to_proba(raw, n_rows, raw_logits, source):
    """Normalize whatever a model returned into an (n, 2) float array.

    Shared by every adapter, because the shapes a fitted binary classifier
    hands back do not depend on its framework: a ZipMap list of
    ``{class: proba}`` dicts, a plain (n, 2) matrix, or a single column of
    positive-class scores. ``source`` only names the model in error messages.
    """
    # ZipMap: a list of {class_label: probability} dicts, one per row.
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        classes = sorted(raw[0].keys())
        if len(classes) != 2:
            raise ValueError(
                f"This {source} model predicts {len(classes)} classes "
                f"({classes}). MED3pa supports binary classification only."
            )
        return np.array([[row[c] for c in classes] for row in raw], dtype=float)

    probs = np.asarray(raw, dtype=float)
    if probs.ndim == 1:
        probs = probs.reshape(n_rows, -1)

    if probs.shape[1] == 1:
        positive = probs[:, 0]
        if raw_logits:
            positive = _sigmoid(positive)
        return np.column_stack([1.0 - positive, positive])

    if probs.shape[1] == 2:
        return _softmax(probs) if raw_logits else probs

    raise ValueError(
        f"This {source} model outputs {probs.shape[1]} columns. MED3pa supports "
        f"binary classification only, which means a 1- or 2-column output."
    )


def check_proba_range(probs, raw_logits, source):
    """Reject values that are not probabilities, then clip the rest.

    A model exported without its final activation, but not declared as such,
    produces values outside [0, 1]. Saying so here is far better than letting
    them propagate into confidence scores.
    """
    if not raw_logits and (probs.min() < -0.01 or probs.max() > 1.01):
        raise ValueError(
            f"This {source} model returned values in "
            f"[{probs.min():.3f}, {probs.max():.3f}], which are not "
            f"probabilities. If it was exported without its final "
            f"sigmoid/softmax, re-import it with 'raw logits' enabled."
        )
    return np.clip(probs, 0.0, 1.0)


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
            # onnxruntime is pinned in pythonEnv/requirements.txt, so reaching
            # here usually means one of two quite different things: the
            # requirements were never installed into the interpreter running
            # this script, or onnxruntime is installed but cannot load (on Linux
            # it needs libgomp.so.1, which minimal images lack). The original
            # error distinguishes them, so do not hide it behind stock advice.
            raise ImportError(
                f"onnxruntime could not be imported by {sys.executable}: {e}. "
                f"It is pinned in requirements.txt, so either the python "
                f"environment was never set up (check Settings > Python "
                f"environment path), or the install is broken - on Linux a "
                f"missing libgomp.so.1 is the usual cause "
                f"(sudo apt install libgomp1)."
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
        return normalise_to_proba(raw, n_rows, self.raw_logits, "ONNX")

    def predict_proba(self, X):
        X = np.asarray(X, dtype=self.input_dtype)
        outputs = self.session.run(None, {self.input_name: X})
        probs = self._to_matrix(self._select_output(outputs), len(X))

        return check_proba_range(probs, self.raw_logits, "ONNX")

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


def _require(module_name, framework):
    """Import a framework's library, or explain precisely what is missing.

    Not every framework's library is pinned in requirements.txt -- tensorflow
    and lightgbm are not, because weighing down every install for a model type
    most workspaces never use is a poor trade. The cost of that choice is this
    message, so make it actionable rather than generic.
    """
    try:
        return importlib.import_module(module_name)
    except ImportError as e:
        raise ImportError(
            f"This base model is a {framework} model, which needs the "
            f"'{module_name}' package. {sys.executable} cannot import it: {e}. "
            f"Install it into that interpreter with "
            f"'{sys.executable} -m pip install {module_name}', or point the app "
            f"at a python environment that already has it."
        ) from e


def _maybe(fn, default=None):
    """Call an optional introspection method, tolerating its absence."""
    try:
        return fn()
    except Exception:
        return default


class CallableProbabilityModel:
    """Adapts any callable mapping X -> scores to the ``predict_proba`` contract.

    Every framework below is already a fitted binary classifier; what differs
    is the call convention and the output shape, not the idea. Wrapping the
    call in a closure and funnelling the result through ``normalise_to_proba``
    means a new framework costs one loader function, not a new model class.

    ``raw_logits`` must be set explicitly when the model stops short of its
    final activation -- xgboost's ``binary:logitraw``, a PyTorch head with no
    sigmoid. It cannot be detected: logits that happen to land in [0, 1] are
    indistinguishable from probabilities, and guessing wrong yields confidence
    scores that are wrong but entirely plausible-looking.
    """

    def __init__(self, fn, framework, raw_logits=False, params=None, artifact=None):
        self._fn = fn
        self.framework = framework
        self.raw_logits = raw_logits
        self._params = dict(params or {})
        # (framework, bytes, options), kept so __setstate__ can rebuild: a
        # closure over a live booster or torch module is not picklable, and
        # BaseModelManager clones the base model.
        self._artifact = artifact

    def predict_proba(self, X):
        x = np.asarray(X)
        probs = normalise_to_proba(self._fn(x), len(x), self.raw_logits, self.framework)
        return check_proba_range(probs, self.raw_logits, self.framework)

    def predict(self, X, threshold=0.5):
        return (self.predict_proba(X)[:, 1] >= threshold).astype(int)

    def __getstate__(self):
        if self._artifact is None:
            raise TypeError(
                f"This {self.framework} base model was built without its "
                f"artifact bytes, so it cannot be pickled or cloned."
            )
        return {
            "_artifact": self._artifact,
            "framework": self.framework,
            "raw_logits": self.raw_logits,
            "_params": self._params,
        }

    def __setstate__(self, state):
        self.__dict__.update(state)
        # Rebuild the closure from the bytes rather than storing the live
        # object; the loader is the single place that knows how.
        self._fn = build_model_from_artifact(*self._artifact)._fn

    def get_params(self):
        return dict(self._params, raw_logits=self.raw_logits)

    def get_info(self):
        """Model description for MED3pa's experiment config.

        BaseModelManager.get_info prefers this method and only falls back to
        get_params() on the wrapped object when it is absent.
        """
        return {
            "model": type(self).__name__,
            "model_type": self.framework,
            "params": self.get_params(),
            "data_preparation_strategy": None,
            "pickled_model": False,
            "file_path": "",
        }


def _load_onnx_artifact(data, options):
    return OnnxProbabilityModel(
        data,
        output=options.get("onnx_output"),
        raw_logits=options.get("raw_logits", False),
    )


def _load_sklearn_artifact(data, options):
    """A pickled estimator already satisfies the contract -- or does not at all."""
    model = _deserialize_model(data)
    if not hasattr(model, "predict_proba"):
        raise ValueError(
            f"This pickled object is a {type(model).__name__}, which has no "
            f"predict_proba method. MED3pa needs one to compute confidence."
        )
    return model


def _load_xgboost_artifact(data, options):
    """A native xgboost Booster (.json/.ubj), not the sklearn wrapper.

    XGBClassifier pickles already work through the sklearn path, since they
    have predict_proba. A Booster has only predict(), which wants a DMatrix
    and returns a single column.
    """
    xgb = _require("xgboost", "xgboost")
    booster = xgb.Booster()
    try:
        booster.load_model(bytearray(data))
    except Exception as e:
        raise ValueError(
            f"xgboost could not load this file as a Booster: {e}. A pickled "
            f"XGBClassifier should be imported as a scikit-learn model instead."
        ) from e

    params = {
        "num_features": _maybe(booster.num_features),
        "num_boosted_rounds": _maybe(booster.num_boosted_rounds),
    }

    def predict(x):
        return booster.predict(xgb.DMatrix(np.asarray(x, dtype=np.float32)))

    return CallableProbabilityModel(
        predict, "xgboost", options.get("raw_logits", False), params,
        ("xgboost", data, options),
    )


def _load_lightgbm_artifact(data, options):
    """A native LightGBM Booster, which is saved as text."""
    lgb = _require("lightgbm", "LightGBM")
    try:
        model_str = data.decode("utf-8")
    except UnicodeDecodeError as e:
        raise ValueError(
            f"A LightGBM Booster file is text, and this one is not decodable "
            f"as UTF-8 ({e}). A pickled LGBMClassifier should be imported as a "
            f"scikit-learn model instead."
        ) from e
    try:
        booster = lgb.Booster(model_str=model_str)
    except Exception as e:
        raise ValueError(f"LightGBM could not load this file as a Booster: {e}.") from e

    params = {
        "num_features": _maybe(booster.num_feature),
        "num_trees": _maybe(booster.num_trees),
    }

    def predict(x):
        return booster.predict(np.asarray(x, dtype=float))

    return CallableProbabilityModel(
        predict, "lightgbm", options.get("raw_logits", False), params,
        ("lightgbm", data, options),
    )


def _load_pytorch_artifact(data, options):
    """A whole saved nn.Module -- a state_dict cannot work on its own."""
    torch = _require("torch", "PyTorch")
    try:
        # weights_only defaults to True from torch 2.6, which refuses a whole
        # module; versions before 1.13 do not accept the keyword at all.
        obj = torch.load(io.BytesIO(data), map_location="cpu", weights_only=False)
    except TypeError:
        obj = torch.load(io.BytesIO(data), map_location="cpu")

    if isinstance(obj, dict):
        raise ValueError(
            "This file holds a state_dict (a plain dict of tensors), not a "
            "model. A state_dict cannot be used on its own, because the module "
            "class defining the architecture is not stored with it. Re-save "
            "with torch.save(model) instead of torch.save(model.state_dict()), "
            "or export the model to ONNX."
        )
    if not callable(obj):
        raise ValueError(
            f"This file deserialized to a {type(obj).__name__}, which is not "
            f"callable, so it cannot be run as a PyTorch model."
        )

    obj.eval()
    params = {"module": type(obj).__name__}

    def predict(x):
        with torch.no_grad():
            tensor = torch.as_tensor(np.asarray(x, dtype=np.float32))
            return obj(tensor).detach().cpu().numpy()

    return CallableProbabilityModel(
        predict, "pytorch", options.get("raw_logits", False), params,
        ("pytorch", data, options),
    )


def _load_keras_artifact(data, options):
    """A Keras model, which can only be loaded from a path -- so stage it."""
    try:
        keras = importlib.import_module("keras")
    except ImportError:
        keras = _require("tensorflow", "Keras").keras

    suffix = os.path.splitext(options.get("artifact_child") or "model.keras")[1] or ".keras"
    handle = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        handle.write(data)
        handle.close()
        model = keras.models.load_model(handle.name)
    except Exception as e:
        raise ValueError(f"Keras could not load this file as a model: {e}.") from e
    finally:
        try:
            os.unlink(handle.name)
        except OSError:
            pass

    params = {"name": getattr(model, "name", None)}

    def predict(x):
        return model.predict(np.asarray(x, dtype=np.float32), verbose=0)

    return CallableProbabilityModel(
        predict, "keras", options.get("raw_logits", False), params,
        ("keras", data, options),
    )


# Adding a framework means adding a loader here and its extensions below --
# nothing in MED3pa, the import route or the UI needs to know about it.
ARTIFACT_LOADERS = {
    "onnx": _load_onnx_artifact,
    "sklearn": _load_sklearn_artifact,
    "xgboost": _load_xgboost_artifact,
    "lightgbm": _load_lightgbm_artifact,
    "pytorch": _load_pytorch_artifact,
    "keras": _load_keras_artifact,
}

# File extensions offered at import, per framework. `.json` and `.txt` are
# ambiguous in general, but in a model-import dialog they are overwhelmingly an
# xgboost dump and a LightGBM Booster; the framework can be set explicitly when
# they are not.
FRAMEWORK_EXTENSIONS = {
    "onnx": (".onnx",),
    "sklearn": (".pkl", ".pickle", ".joblib"),
    "xgboost": (".json", ".ubj", ".xgb"),
    "lightgbm": (".txt", ".lgb"),
    "pytorch": (".pt", ".pth"),
    "keras": (".keras", ".h5"),
}

FRAMEWORK_BY_EXTENSION = {
    extension: framework
    for framework, extensions in FRAMEWORK_EXTENSIONS.items()
    for extension in extensions
}

# The child object the artifact is written to. The two legacy names are what
# every model saved before the registry existed already uses, so they must not
# change; newer frameworks record their own name in metadata.artifact_child.
DEFAULT_ARTIFACT_CHILD = {
    "onnx": "model.onnx",
    "sklearn": "model.pkl",
}


def framework_for_extension(extension):
    """Map a file extension to a framework name, or None when unrecognised."""
    return FRAMEWORK_BY_EXTENSION.get((extension or "").lower())


def build_model_from_artifact(framework, data, options=None):
    """Build a predict_proba-capable model from a framework's own artifact bytes.

    The single place that knows how each framework loads, shared by the import
    route (which probes a candidate before saving it) and by load_base_model
    (which reads it back) -- so the two can never disagree about what a stored
    model means.
    """
    loader = ARTIFACT_LOADERS.get(framework)
    if loader is None:
        raise ValueError(
            f"Unknown model framework '{framework}'. Known frameworks: "
            f"{', '.join(sorted(ARTIFACT_LOADERS))}."
        )
    return loader(data, options or {})


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


ARTIFACT_CONTENT_KEYS = ("artifact", "onnx", "model", "pklContent")


def _get_artifact_bytes(child_id, child_name):
    """Read a model artifact's bytes from its own collection.

    The content key varies by vintage -- "onnx" and "model" predate the
    registry, newer imports write "artifact" -- and anything over the 16MB
    BSON cap is left on disk and referenced by path instead.
    """
    db = connect_to_mongo()
    document = db[child_id].find_one({})
    if not document:
        raise ValueError(f"No content found in collection {child_id} for '{child_name}'.")
    for key in ARTIFACT_CONTENT_KEYS:
        if key in document:
            return bytes(document[key])
    if "model_path" in document:
        with open(document["model_path"], "rb") as f:
            return f.read()
    raise ValueError(
        f"Collection {child_id} holds none of "
        f"{list(ARTIFACT_CONTENT_KEYS) + ['model_path']}."
    )


def load_base_model(model_object_id):
    """Load a ``.medmodel`` as a ``predict_proba``-capable object.

    Returns:
        tuple: (model, metadata dict)
    """
    metadata = get_model_metadata(model_object_id)
    framework = metadata.get("framework") or "sklearn"
    options = {
        "onnx_output": metadata.get("onnx_output"),
        # onnx_raw_logits is what imports before the registry wrote.
        "raw_logits": metadata.get(
            "raw_logits", metadata.get("onnx_raw_logits", False)
        ),
        "artifact_child": metadata.get("artifact_child"),
    }

    if framework == "sklearn":
        # Learning-module models and every pre-registry pickle import.
        # Prefer the pycaret-free estimator; fall back to the full
        # pipeline for models saved before that export existed.
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

    if framework not in ARTIFACT_LOADERS:
        raise ValueError(
            f"Model {model_object_id} declares framework '{framework}', which "
            f"this version cannot load. Known frameworks: "
            f"{', '.join(sorted(ARTIFACT_LOADERS))}."
        )

    child_name = options["artifact_child"] or DEFAULT_ARTIFACT_CHILD.get(framework)
    if child_name is None:
        raise ValueError(
            f"Model {model_object_id} is declared as {framework} but records no "
            f"'artifact_child', so there is no way to tell which child holds it."
        )
    child_id = get_child_id_by_name(model_object_id, child_name)
    if child_id is None:
        raise ValueError(
            f"Model {model_object_id} is declared as {framework} but has no "
            f"'{child_name}' child."
        )
    data = _get_artifact_bytes(child_id, child_name)
    return build_model_from_artifact(framework, data, options), metadata


def get_model_feature_columns(metadata):
    """The ordered feature list a model expects, or None when unknown.

    ``sklearn_columns`` is the transformed feature space the estimator actually
    sees; ``columns`` is the pre-transformation list. Externally imported models
    write the same list to both.
    """
    return metadata.get("sklearn_columns") or metadata.get("columns") or None
