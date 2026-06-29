import os
import sys
import json
from pathlib import Path

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

json_params_dict, id_ = parse_arguments()
go_print("running run_med3pa_analysis.py:" + id_)


class GoExecScriptRunMed3paAnalysis(GoExecutionScript):
    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}
        self._progress["type"] = "process"

    def _custom_process(self, json_config: dict) -> dict:
        params = json_config["med3pa_params"]         

        base_model   = params["base_model"]
        dataset      = params["chosen_dataset"]
        ipc          = params["ipc"]
        apc          = params["apc"]
        mpc_strategy = params["mpc_strategy"]

        self.set_progress(label="Setting up MED3pa analysis", now=10)
        # ... your calculations here ...
        self.set_progress(label="Computing IPC/APC/MPC", now=60)

        self.results = {"some_result": 42}
        self.set_progress(label="Done", now=100)
        return self.results


runMed3pa = GoExecScriptRunMed3paAnalysis(json_params_dict, id_)
runMed3pa.start()