"""Import a model trained outside MEDomicsLab as a ``.medmodel``.

Everything downstream -- MED3pa, Evaluation, Application -- already speaks
"medmodel object with a model child and a metadata.json child". Normalizing
external artifacts into that shape here means none of those consumers need to
know an external model exists.

The artifact is probed before anything is written: a model that cannot answer
``predict_proba`` on a synthetic row is rejected at import time, where the user
can still do something about it, rather than midway through an experiment.
"""

import os
import sys
import uuid
from pathlib import Path

import numpy as np
from bson.binary import Binary

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.MEDDataObject import MEDDataObject
from med_libs.mongodb_utils import insert_med_data_object_if_not_exists
from med_libs.model_loading import (DEFAULT_ARTIFACT_CHILD,
                                    FRAMEWORK_BY_EXTENSION,
                                    build_model_from_artifact,
                                    framework_for_extension)

json_params_dict, id_ = parse_arguments()
go_print("running import_external_model.py:" + id_)

MONGO_BSON_MAX = 16_777_216  # 16MB
MONGO_SAFETY_MARGIN = 1_000_000  # 1MB safety margin
FITS_MONGO = MONGO_BSON_MAX - MONGO_SAFETY_MARGIN

# (MEDDataObject type, document key) for the stored artifact, per framework.
# onnx and sklearn keep what every existing model already uses. Newer
# frameworks store under a neutral "artifact" key and take the framework as
# their type, deliberately staying clear of the workspace scan's
# extension-driven content parsing: an xgboost dump is called model.json,
# and a .json in the workspace gets parsed as JSON documents.
ARTIFACT_CHILD_SHAPE = {
    "onnx": ("onnx", "onnx"),
    "sklearn": ("pkl", "model"),
}


class GoExecScriptImportExternalModel(GoExecutionScript):
    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self._progress["type"] = "process"
        self.warnings = []

    def warn(self, message: str) -> None:
        """Record a warning where it can be seen.

        The Go server drops stdout lines that are not progress or response
        markers, so warnings go to stderr and are also returned to the caller.
        """
        self.warnings.append(message)
        print(f"WARNING: {message}", file=sys.stderr, flush=True)

    def _custom_process(self, json_config: dict) -> dict:
        params = json_config["import_params"]

        file_path = params.get("file_path")
        model_name = (params.get("model_name") or "").strip()
        parent_id = params.get("parent_id")
        columns = params.get("columns") or []
        target = params.get("target")
        ml_type = params.get("ml_type") or "classification"
        threshold = params.get("threshold")

        if not file_path or not os.path.isfile(file_path):
            raise ValueError(f"No file found at '{file_path}'.")
        if not model_name:
            raise ValueError("A name for the imported model is required.")
        if not parent_id:
            raise ValueError("No destination folder was given for the imported model.")
        if not target:
            raise ValueError("The name of the target column is required.")

        extension = Path(file_path).suffix.lower()
        # An explicit framework from the form wins, so an ambiguous extension
        # (.json is an xgboost dump far more often than anything else, but not
        # always) can be corrected by the user.
        framework = params.get("framework") or framework_for_extension(extension)
        if not framework:
            raise ValueError(
                f"Unsupported model file '{extension}'. Expected one of "
                f"{', '.join(sorted(FRAMEWORK_BY_EXTENSION))}."
            )

        self.set_progress(label="Loading model file", now=20)

        # onnx_raw_logits is what the form sent before other frameworks could
        # also be exported without their final activation.
        raw_logits = bool(params.get("raw_logits", params.get("onnx_raw_logits", False)))
        onnx_output = params.get("onnx_output") or None

        with open(file_path, "rb") as f:
            artifact_bytes = f.read()

        # The child this artifact will be stored as. Decided before loading so
        # the probe below runs against exactly the options an analysis will
        # later rebuild the model with.
        artifact_child = DEFAULT_ARTIFACT_CHILD.get(framework) or f"model{extension}"
        options = {
            "raw_logits": raw_logits,
            "onnx_output": onnx_output,
            "artifact_child": artifact_child,
        }

        # One code path with load_base_model, so the two can never disagree
        # about what a stored model means.
        model = build_model_from_artifact(framework, artifact_bytes, options)

        if not columns:
            inferred = getattr(model, "feature_names_in_", None)
            if inferred is not None:
                columns = [str(c) for c in inferred]
        declared_features = self._declared_feature_count(model, framework)

        if not columns:
            raise ValueError(
                "The model does not record its feature names, so the ordered list of "
                "features it expects has to be given explicitly."
            )
        if declared_features is not None and declared_features != len(columns):
            raise ValueError(
                f"The model expects {declared_features} features but {len(columns)} "
                f"feature names were given: {columns}."
            )

        self.set_progress(label="Validating model", now=45)
        self._probe(model, len(columns))

        self.set_progress(label="Saving model", now=70)
        model_id = self._write_med_objects(
            model_name=model_name,
            parent_id=parent_id,
            framework=framework,
            artifact_bytes=artifact_bytes,
            file_path=file_path,
            columns=columns,
            target=target,
            ml_type=ml_type,
            threshold=threshold,
            onnx_output=onnx_output,
            raw_logits=raw_logits,
            artifact_child=artifact_child,
            algorithm=type(model).__name__,
        )

        self.results = {
            "status": "completed",
            "model_id": model_id,
            "name": model_name + ".medmodel",
            "columns": columns,
            "warnings": self.warnings,
        }
        self.set_progress(label="Done", now=100)
        return self.results

    def _declared_feature_count(self, model, framework):
        """How many features the artifact itself says it expects, if it says.

        Used only to catch a feature list that disagrees with the model, so
        None (unknown) simply skips that check rather than failing the import.
        """
        if framework == "onnx":
            return self._onnx_feature_count(model)
        # sklearn-style estimators record this directly.
        declared = getattr(model, "n_features_in_", None)
        if declared is not None:
            return declared
        # The adapters surface a booster's own feature count through get_params.
        if hasattr(model, "get_params"):
            try:
                return (model.get_params() or {}).get("num_features")
            except Exception:
                return None
        return None

    def _onnx_feature_count(self, model):
        """Feature count from the graph's input shape, when it is static."""
        shape = model.session.get_inputs()[0].shape
        if len(shape) == 2 and isinstance(shape[1], int):
            return shape[1]
        return None

    def _probe(self, model, n_features):
        """Call predict_proba exactly the way MED3pa will call it.

        MED3pa passes a plain numpy array, so probing with anything else would
        validate a path the experiment never takes.
        """
        probe_row = np.zeros((1, n_features))
        try:
            probs = model.predict_proba(probe_row)
        except Exception as e:
            raise ValueError(
                f"The model could not predict on a test row of {n_features} features: "
                f"{type(e).__name__}: {e}"
            ) from e

        probs = np.asarray(probs)
        if probs.ndim != 2 or probs.shape[1] != 2:
            raise ValueError(
                f"predict_proba returned an array of shape {probs.shape}, but MED3pa "
                f"needs one probability pair per row (n, 2). MED3pa supports binary "
                f"classification only."
            )

    def _write_med_objects(self, model_name, parent_id, framework, artifact_bytes,
                           file_path, columns, target, ml_type, threshold,
                           onnx_output, raw_logits, artifact_child, algorithm):
        """Write the medmodel object and its children, matching what the
        Learning module's save_model node produces."""
        model_object = MEDDataObject(
            id=str(uuid.uuid4()),
            name=model_name + ".medmodel",
            type="medmodel",
            parentID=parent_id,
            childrenIDs=[],
            inWorkspace=False,
        )
        model_id = insert_med_data_object_if_not_exists(model_object, None)
        if model_id != model_object.id:
            raise ValueError(
                f"A model named '{model_name}.medmodel' already exists in this folder. "
                f"Choose another name."
            )

        # onnx and sklearn keep their legacy child names, because that is what
        # every existing consumer falls back to; anything else is model<ext>
        # and is found again through metadata.artifact_child.
        child_name = artifact_child
        child_type, content_key = ARTIFACT_CHILD_SHAPE.get(
            framework, (framework, "artifact")
        )

        child_object = MEDDataObject(
            id=str(uuid.uuid4()),
            name=child_name,
            type=child_type,
            parentID=model_id,
            childrenIDs=[],
            inWorkspace=False,
        )

        if len(artifact_bytes) <= FITS_MONGO:
            content = [{content_key: Binary(artifact_bytes)}]
        else:
            # Too large for a BSON document; reference the file where it already
            # lives instead of refusing the import.
            content = [{"model_path": file_path}]
            child_object.inWorkspace = True
            child_object.path = file_path
            self.warn(
                f"'{Path(file_path).name}' is larger than MongoDB's 16MB document "
                f"limit, so the database references it at '{file_path}' instead of "
                f"storing a copy. Moving or deleting that file will break this model."
            )
        insert_med_data_object_if_not_exists(child_object, content)

        metadata = {
            "columns": columns,
            # Externally imported models do no preprocessing of their own inside
            # MEDomicsLab, so both feature spaces are the same list.
            "sklearn_columns": columns,
            "target": target,
            "ml_type": ml_type,
            "algorithm": algorithm,
            "source": "external",
            "framework": framework,
        }
        if threshold is not None:
            metadata["model_threshold"] = float(threshold)
        # Where the artifact lives and how to drive it -- load_base_model needs
        # both to rebuild this model without guessing.
        metadata["artifact_child"] = child_name
        metadata["raw_logits"] = raw_logits
        if framework == "onnx" and onnx_output is not None:
            metadata["onnx_output"] = onnx_output

        metadata_object = MEDDataObject(
            id=str(uuid.uuid4()),
            name="metadata.json",
            type="json",
            parentID=model_id,
            childrenIDs=[],
            inWorkspace=False,
        )
        insert_med_data_object_if_not_exists(metadata_object, [metadata])

        return model_id


importExternalModel = GoExecScriptImportExternalModel(json_params_dict, id_)
importExternalModel.start()
