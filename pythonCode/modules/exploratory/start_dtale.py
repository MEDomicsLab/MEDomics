import threading
import time
import json
import pandas as pd
import dtale
import sys
import os
import pymongo

from pathlib import Path
sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print, find_next_available_port, is_port_in_use
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

json_params_dict, id_ = parse_arguments()

class GoExecScriptDTale(GoExecutionScript):
    """
        This class is used to run a script from Go to open a dashboard
    """

    def __init__(self, json_params: dict, _id: str = "default_id"):
        super().__init__(json_params, _id)
        self.model = None
        self.port = None
        self.now = 0
        self._progress["type"] = "webserver"
        self.thread_delay = 2
        self.speed = 1  # rows/second
        self.dataset = None
        self.dtale_id = 1
        self.row_count = 45
        self.json_config = json_params
        self.is_calculating = True
        self.progress_thread = threading.Thread(
            target=self._update_progress_periodically, args=())
        self.progress_thread.daemon = True
        self.progress_thread.start()
        self.web_server_thread = threading.Thread(
            target=self._server_process, args=())
        self.web_server_thread.daemon = True

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script opening the dashboard
        """
        go_print(json.dumps(json_config, indent=4))
        self.port = find_next_available_port()
        self.web_server_thread.start()
        self.progress_thread.join()
        self.web_server_thread.join()
        return {"results_html": "html"}

    def _update_progress_periodically(self):
        """
        This function is used to update the progress of the pipeline execution.
        """
        while self.is_calculating:
            go_print(str(dtale.instances()))
            if self.port is not None:
                if is_port_in_use(self.port):
                    self._progress["web_server_url"] = f"http://localhost:{self.port}/"
                    self._progress["port"] = self.port
                    self._progress["name"] = self.dataset["name"].split(".")[
                        0].capitalize()
                    self.is_calculating = False

            self.now += round(self.thread_delay *
                              self.speed / self.row_count * 100, 2)
            self._progress["now"] = "{:.2f}".format(self.now)
            self.push_progress()
            time.sleep(self.thread_delay)

    def _server_process(self):
        """
        This function is used to run the dashboard
        """
        # MongoDB setup
        mongo_client = pymongo.MongoClient("mongodb://localhost:54017/")
        database = mongo_client["data"]
        collection = database[self.json_config["dataset"]["id"]]
        collection_data = collection.find({}, {'_id': False})
        df = pd.DataFrame(list(collection_data))

        # DTale
        self.dataset = self.json_config['dataset']
        d = dtale.show(df, subprocess=False, port=self.port, force=True)
        self.is_calculating = False


script = GoExecScriptDTale(json_params_dict, id_)
script.start()
