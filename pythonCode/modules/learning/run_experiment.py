import os
import threading
import time
import sys
import pymongo

from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.server_utils import go_print
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.MEDml.MEDexperiment_learning import MEDexperimentLearning

USE_RAM_FOR_EXPERIMENTS_STORING = 1
USE_SAVE_FOR_EXPERIMENTS_STORING = 0

json_params_dict, id_ = parse_arguments()
go_print("running run_experiment.py:" + id_)


class GoExecScriptRunExperiment(GoExecutionScript):
    """
        This class is used to run the pipeline execution of pycaret

        Args:
            json_params: The json params of the pipeline execution
            _id: The id of the pipeline execution
            isProgressInThread: A boolean indicating if the progress is updated in a thread
    """

    def __init__(self, json_params: dict, _id: str = None, isProgressInThread: bool = False):
        super().__init__(json_params, _id, debug=False)
        self.storing_mode = USE_RAM_FOR_EXPERIMENTS_STORING
        # self.storing_mode = USE_SAVE_FOR_EXPERIMENTS_STORING
        self.current_experiment = None
        self._progress["type"] = "process"
        self._progress_update_frequency_HZ = 1.0
        if isProgressInThread:
            self.progress_thread = threading.Thread(target=self._update_progress_periodically, args=())
            self.progress_thread.daemon = True
            self.progress_thread.start()

    def _custom_process(self, json_config: dict) -> dict:
        """
        This function is the main script of the pipeline execution
        """

        # MongoDB setup
        mongo_client = pymongo.MongoClient("mongodb://localhost:54017/")
        database = mongo_client[json_config["DBName"]]
        collection = database[json_config["id"]]
        flow = list(collection.find({}, {'_id': False}))[0]
        flow['finalize'] = json_config.get("saveAndFinalize", False)
        flow['modelToFinalize'] = json_config.get("modelToFinalize", None)
        flow['modelName'] = json_config.get("modelName", None)
        flow['workspacePath'] = json_config.get('workspacePath', None)
        flow['sceneName'] = json_config.get('sceneName', None)
        self.current_experiment = MEDexperimentLearning(flow)
        self.current_experiment.start()
        results_pipeline = self.current_experiment.get_results()
        if self.storing_mode == USE_SAVE_FOR_EXPERIMENTS_STORING:
            self.current_experiment.set_progress(label='Saving the experiment')
        return results_pipeline

    def update_progress(self):
        """
        This function is used to update the progress of the pipeline execution.
        It is called periodically by the thread self.progress_thread
        """
        if self.current_experiment is not None:
            progress = self.current_experiment.get_progress()
            self.set_progress(now=progress['now'], label=progress['currentLabel'])
        else:
            self.set_progress(now=0, label="")

    def _update_progress_periodically(self):
        while True:
            self.update_progress()
            self.push_progress()
            time.sleep(1.0 / self._progress_update_frequency_HZ)

def save_experiment(experiment: MEDexperimentLearning):
    """
    triggered by the button save in the dashboard, it saves the pipeline execution

    Returns: the results of the pipeline execution
    """
    
    # A ÉTÉ ENLEVÉ DANS UN COMMIT PRÉCÉDENT... À REMETTRE ET UPDATER POUR MONGODB
    # go_print("saving experiment")
    # experiment.make_save_ready()
    # basePath = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
    # local_path = os.path.join(basePath, 'local_dir')
    # if not os.path.exists(local_path):
    #     os.makedirs(local_path)
    # with open(os.path.join(local_path, 'MEDexperiment_' + experiment.id + '.medexp'), 'wb') as f:
    #     pickle.dump(experiment, f)
    #     del experiment
    pass
        


def load_experiment(id_):
    """
    triggered by the button load in the dashboard, it loads the pipeline execution

    Returns: the previously saved MEDexperiment
    """
    # A ÉTÉ ENLEVÉ DANS UN COMMIT PRÉCÉDENT... À REMETTRE ET UPDATER POUR MONGODB
    # go_print("loading experiment")
    # basePath = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
    # local_path = os.path.join(basePath, 'local_dir')
    # if not os.path.exists(local_path):
    #     os.makedirs(local_path)
    # with open(os.path.join(local_path, 'MEDexperiment_' + id_ + '.medexp'), 'rb') as f:
    #     experiment = pickle.load(f)
    #     experiment.init_obj()
    #     return experiment
    pass


def is_experiment_exist(id_):
    """
    triggered by the button load in the dashboard, it loads the pipeline execution

    Returns: the results of the pipeline execution
    """
    # A ÉTÉ ENLEVÉ DANS UN COMMIT PRÉCÉDENT... À REMETTRE ET UPDATER POUR MONGODB
    # basePath = str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
    # local_path = os.path.join(basePath, 'local_dir')
    # if not os.path.exists(local_path):
    #     os.makedirs(local_path)
    # return os.path.exists(os.path.join(local_path, 'MEDexperiment_' + id_ + '.medexp'))
    pass

run_experiment = GoExecScriptRunExperiment(json_params_dict, id_, True)
run_experiment.start()
