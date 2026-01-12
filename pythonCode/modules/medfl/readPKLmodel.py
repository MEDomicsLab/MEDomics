import os
import json
import sys
from pathlib import Path
import time
import traceback

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
)

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print

import joblib  # <-- NEW: to load sklearn Pipeline .pkl


json_params_dict, id_ = parse_arguments()
go_print("running hello_world_medfl.py:" + id_)


class GoExecScriptReadPklmodel(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The json params of the execution
            _id: The id of the execution
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script of the execution of the process from Go.

        Expected JSON (example):

        {
            "pklPath": "/absolute/or/relative/path/to/model_pipeline.pkl"
        }
        """
        try:
            self.set_progress(label="Starting model inspection...", now=5)

            # ---------------------------------------------------------
            # 1) Get the .pkl path from the config
            # ---------------------------------------------------------
            # Preferred key: "pklPath"
            pkl_path = json_config.get("pklPath")

            # Optional: support nested structure like { "file": { "path": "..." } }
            if pkl_path is None and "file" in json_config:
                file_cfg = json_config["file"]
                if isinstance(file_cfg, dict):
                    pkl_path = file_cfg.get("path")

            if not pkl_path:
                raise ValueError(
                    "No path to the .pkl model was provided. "
                    "Expected key 'pklPath' (or json_config['file']['path'])."
                )

            # Resolve to absolute path if needed
            pkl_path = os.path.abspath(pkl_path)
            go_print(f"Loading sklearn pipeline from: {pkl_path}")

            if not os.path.exists(pkl_path):
                raise FileNotFoundError(f"Model file not found at: {pkl_path}")

            self.set_progress(label="Loading model from .pkl", now=25)
            time.sleep(0.5)  # simulate some work

            # ---------------------------------------------------------
            # 2) Load sklearn Pipeline
            # ---------------------------------------------------------
            pipeline = joblib.load(pkl_path)

            # ---------------------------------------------------------
            # 3) Get the trained model and its params
            # ---------------------------------------------------------
            # We know from earlier that the step name is "trained_model"
            if not hasattr(pipeline, "named_steps"):
                raise TypeError("Loaded object is not a sklearn Pipeline with named_steps.")

            if "trained_model" not in pipeline.named_steps:
                # Fallback: try to use the last step as model
                step_names = list(pipeline.named_steps.keys())
                if not step_names:
                    raise ValueError("Pipeline has no steps; cannot find model.")
                model_step_name = step_names[-1]
                trained_model = pipeline.named_steps[model_step_name]
            else:
                model_step_name = "trained_model"
                trained_model = pipeline.named_steps["trained_model"]

            self.set_progress(label="Extracting model parameters", now=60)

            # get_params() of the sklearn model
            params = trained_model.get_params()

            # ---------------------------------------------------------
            # 4) Optional: extract simple architecture information
            # ---------------------------------------------------------
            architecture = {}
            try:
                # This will work for MLPClassifier and similar models with coefs_
                if hasattr(trained_model, "coefs_") and hasattr(trained_model, "intercepts_"):
                    coefs = trained_model.coefs_
                    intercepts = trained_model.intercepts_

                    input_dim = coefs[0].shape[0]
                    output_dim = coefs[-1].shape[1]

                    hidden_layer_sizes = params.get("hidden_layer_sizes", None)
                    activation = params.get("activation", None)

                    if isinstance(hidden_layer_sizes, int):
                        hidden_layer_sizes = [hidden_layer_sizes]

                    architecture = {
                        "model_step_name": model_step_name,
                        "input_dim": int(input_dim),
                        "output_dim": int(output_dim),
                        "hidden_layers": list(hidden_layer_sizes)
                        if hidden_layer_sizes is not None
                        else None,
                        "activation": activation,
                        "n_layers": len(coefs),  # number of weight matrices
                    }
                else:
                    architecture = {
                        "model_step_name": model_step_name,
                        "info": "Model does not expose coefs_/intercepts_; architecture summary limited.",
                    }
            except Exception as arch_err:
                # Don't fail the entire endpoint if architecture parsing fails
                go_print(f"Error while parsing architecture: {arch_err}")
                architecture = {
                    "model_step_name": model_step_name,
                    "info": "Error while parsing architecture.",
                }

            self.set_progress(label="Preparing response", now=90)

            # ---------------------------------------------------------
            # 5) Build result JSON
            # ---------------------------------------------------------
            self.results = {
                "data": {
                    "pklPath": pkl_path,
                    "modelStepName": model_step_name,
                    "params": params,
                    "architecture": architecture,
                },
                "stringFromBackend": "Model parameters successfully extracted.",
            }

            self.set_progress(label="Done", now=100)
            return self.results

        except Exception as e:
            # In case of error, return details in the result
            go_print("Error in _custom_process: " + str(e))
            tb = traceback.format_exc()
            go_print(tb)

            self.set_progress(label="Error while reading the model", now=100)
            self.results = {
                "error": str(e),
                "traceback": tb,
                "stringFromBackend": "Failed to read model parameters from .pkl.",
            }
            return self.results


helloWorldTest = GoExecScriptReadPklmodel(json_params_dict, id_)
helloWorldTest.start()
