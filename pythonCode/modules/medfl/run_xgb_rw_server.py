from MEDfl.rw.server import FederatedServer
from MEDfl.rw.xgboost.strategy import XGBoostStrategy

import os
import sys
import traceback
from pathlib import Path
from datetime import datetime

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
)

from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments


from MEDfl.LearningManager.shap import (
    SHAPConfig,
)



XGB_LOG_FILE = "/tmp/medfl_xgb_server.log"


def xgb_log(message: str):
    """
    Log to:
    1. Go console through go_print
    2. stderr terminal
    3. persistent file /tmp/medfl_xgb_server.log

    This helps even if Go/Electron stops showing Python stdout.
    """

    msg = f"[XGB SERVER][PID={os.getpid()}][{datetime.now()}] {message}"

    try:
        go_print(msg)
    except Exception:
        pass

    try:
        print(msg, file=sys.stderr, flush=True)
    except Exception:
        pass

    try:
        with open(XGB_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass


def xgb_log_exception(e: BaseException):
    xgb_log("========== XGBOOST SERVER ERROR ==========")
    xgb_log(f"Exception type: {type(e).__name__}")
    xgb_log(f"Exception message: {str(e)}")
    xgb_log(traceback.format_exc())
    xgb_log("==========================================")


xgb_log("Starting the Federated XGBoost Server script...")

json_params_dict, id_ = parse_arguments()

xgb_log(f"Arguments parsed successfully. id={id_}")
xgb_log(f"Received json params: {json_params_dict}")


class GoExecScriptRunXGBoostServerFromMEDfl(GoExecutionScript):
    """
    Execute a federated XGBoost server process from Go.

    This file is dedicated only to the XGBoost backend.
    It does not modify or affect the existing neural-network server launcher.
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def start(self):
        """
        Custom start for long-running XGBoost RW server.

        The NN backend can use the default GoExecutionScript.start()
        because training finishes and returns results.

        The RW XGBoost server is different:
        server.start() is blocking and must keep the Python process alive.

        So here we:
        1. Send response-ready immediately to Go/frontend.
        2. Then start the blocking Flower server in the same process.
        """

        try:
            xgb_log("Custom XGBoost start() called")
            xgb_log(f"Current Python PID: {os.getpid()}")

            self.push_progress()

            self.results = {
                "pid": os.getpid(),
                "backend": "xgboost",
                "status": "started",
                "log_file": XGB_LOG_FILE,
            }

            xgb_log("Sending response-ready before server.start()")
            self.send_response(self.results)

            xgb_log("Response sent successfully")
            xgb_log("Now starting blocking Flower XGBoost server...")

            self._start_server(self._json_params)

            xgb_log("server.start() returned. Server stopped.")

        except BaseException as e:
            xgb_log_exception(e)
            raise

    def _build_xgb_params(self, json_config: dict) -> dict:
        """
        Build XGBoost native parameters from the frontend/backend config.
        """

        xgb_log("Building XGBoost params")

        xgb_params = json_config.get("xgb_params")

        if isinstance(xgb_params, dict):
            params = dict(xgb_params)
            xgb_log(f"Using provided xgb_params dict: {params}")
        else:
            params = {
                "objective": json_config.get("xgb_objective", "binary:logistic"),
                "eval_metric": json_config.get("xgb_eval_metric", "auc"),
                "tree_method": json_config.get("xgb_tree_method", "hist"),
                "max_depth": int(json_config.get("xgb_max_depth", 6)),
                "eta": float(json_config.get("xgb_eta", 0.1)),
            }

            if "xgb_subsample" in json_config:
                params["subsample"] = float(json_config["xgb_subsample"])

            if "xgb_colsample_bytree" in json_config:
                params["colsample_bytree"] = float(
                    json_config["xgb_colsample_bytree"]
                )

        if "max_depth" in params:
            params["max_depth"] = int(params["max_depth"])

        if "eta" in params:
            params["eta"] = float(params["eta"])
            if params["eta"] <= 0:
                raise ValueError(
                    f"Invalid XGBoost parameter eta={params['eta']}. "
                    "Expected value > 0."
                )

        if "subsample" in params:
            params["subsample"] = float(params["subsample"])
            if not 0 < params["subsample"] <= 1:
                raise ValueError(
                    f"Invalid XGBoost parameter subsample={params['subsample']}. "
                    "Expected value in range (0, 1]."
                )

        if "colsample_bytree" in params:
            params["colsample_bytree"] = float(params["colsample_bytree"])
            if not 0 < params["colsample_bytree"] <= 1:
                raise ValueError(
                    "Invalid XGBoost parameter "
                    f"colsample_bytree={params['colsample_bytree']}. "
                    "Expected value in range (0, 1]."
                )

        xgb_log(f"Final XGBoost params: {params}")

        return params

    def _prepare_features_and_target(self, json_config: dict):
        """
        Prepare features and target.

        Also removes target from features if the frontend accidentally includes it.
        """

        raw_features = json_config["features"]
        target = json_config["target"]

        if isinstance(raw_features, str):
            feature_list = [f.strip() for f in raw_features.split(",") if f.strip()]
        elif isinstance(raw_features, list):
            feature_list = [str(f).strip() for f in raw_features if str(f).strip()]
        else:
            raise ValueError(
                f"features must be string or list, got {type(raw_features).__name__}"
            )

        if target in feature_list:
            xgb_log(
                f"WARNING: target column '{target}' found inside features. Removing it."
            )
            feature_list = [f for f in feature_list if f != target]

        final_features = ",".join(feature_list)

        xgb_log(f"Final features: {final_features}")
        xgb_log(f"Final target: {target}")

        return final_features, target

    def _start_server(self, json_config: dict):
        """
        Start the Flower server using MEDfl XGBoost strategy.
        This function blocks at server.start().
        """

        xgb_log("_start_server() entered")
        xgb_log("Starting the Federated XGBoost Server with configuration:")
        xgb_log(str(json_config))

        xgb_params = self._build_xgb_params(json_config)
        features, target = self._prepare_features_and_target(json_config)

        xgb_log("Creating XGBoostStrategy...")

        shap_config = None
                 
        if json_config.get("flShapNode"):
                    
        
            shap_config = SHAPConfig(
                        enabled=True,
        
                        # Required for XGBoost.
                        explainer="tree",
        
                        # train, validation, or test
                        data_split=json_config["flShapNode"].get("dataSplit", "validation"),
        
                        # Used as TreeExplainer background data.
                        background_size=json_config["flShapNode"].get("backgroundSize", 100),
        
                        # Maximum samples explained per client.
                        explanation_size=json_config["flShapNode"].get("explanationSize", 50),
        
                        random_seed=json_config["flShapNode"].get("random_seed", 42),
        
                        minimum_samples=json_config["flShapNode"].get("minimumSamples", 10),
        
                        clipping_value=None,
        
                        include_client_results=json_config["flShapNode"].get("includeClientResults", True),
        
                    )

        custom_strategy = XGBoostStrategy(
            mode=json_config.get("xgb_mode", json_config.get("mode", "bagging")),
            task=json_config.get("xgb_task", json_config.get("task", "binary")),

            num_classes=json_config.get(
                "xgb_num_classes",
                json_config.get("num_classes", None),
            ),

            features=features,
            target=target,

            local_num_boost_round=int(
                json_config.get(
                    "xgb_local_num_boost_round",
                    json_config.get("local_num_boost_round", 10),
                )
            ),

            xgb_params=xgb_params,

            fraction_fit=float(json_config.get("fraction_fit", 1.0)),
            fraction_evaluate=float(json_config.get("fraction_evaluate", 1.0)),

            min_fit_clients=int(json_config["min_fit_clients"]),
            min_evaluate_clients=int(json_config["min_evaluate_clients"]),
            min_available_clients=int(json_config["min_available_clients"]),

            threshold=float(json_config.get("threshold", 0.5)),

            savingPath=None,
            saveOnRounds=int(json_config.get("saveOnRounds", 1)),
            total_rounds=int(json_config["num_rounds"]),

            val_fraction=float(json_config.get("val_fraction", 0.10)),
            test_fraction=float(json_config.get("test_fraction", 0.10)),
            split_mode=json_config.get("split_mode", "global"),
            id_col=json_config.get("id_col", "id"),
            client_fractions=json_config.get("client_fractions", {}),
            shap_config=shap_config
        )

        xgb_log("XGBoostStrategy created successfully")

        host = json_config.get("host", "0.0.0.0")
        port = int(json_config["port"])
        num_rounds = int(json_config["num_rounds"])

        xgb_log(f"Creating FederatedServer on {host}:{port}")
        xgb_log(f"Number of rounds: {num_rounds}")

        server = FederatedServer(
            host=host,
            port=port,
            num_rounds=num_rounds,
            strategy=custom_strategy,
            shap_config=shap_config
        )

        xgb_log("FederatedServer created successfully")
        xgb_log("Calling server.start() now. The process should block here.")

       

        server.start()

        xgb_log("server.start() returned. Server stopped.")
      

    def _custom_process(self, json_config: dict) -> dict:
        """
        Not used for XGBoost RW server because start() is overridden.

        Kept only to satisfy GoExecutionScript abstract method.
        """

        xgb_log("_custom_process() called unexpectedly")

        return {
            "pid": os.getpid(),
            "backend": "xgboost",
            "status": "started",
            "log_file": XGB_LOG_FILE,
        }


xgb_log("Creating XGBoost server pipeline object")

try:
    fl_pipeline = GoExecScriptRunXGBoostServerFromMEDfl(json_params_dict, id_)
    xgb_log("Calling fl_pipeline.start()")
    fl_pipeline.start()
except BaseException as e:
    xgb_log_exception(e)
    raise