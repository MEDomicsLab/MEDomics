import copy
import json
from colorama import Fore
from pycaret.loggers.base_logger import BaseLogger


class MEDml_logger(BaseLogger):
    """
    This is the class for the MEDml logger.
    It is used to log the results of the experiments.
    It extends the BaseLogger class from pycaret to be able to use the pycaret logging functions therefore it can be used by pycaret.
    """

    def __init__(self) -> None:
        self.current_logging_step = None
        self.results = {}
        self.counter = 0

    def init_logger(self):
        print(Fore.GREEN + f"init logger" + Fore.RESET)

    def __del__(self):
        try:
            self.finish_experiment()
        except Exception as e:
            print(e)

    def __repr__(self) -> str:
        return self.__class__.__name__

    def log_params(self, params, model_name=None):
        print()
        print(Fore.GREEN + f"log params: {params}, {model_name}" + Fore.RESET)
        self.results[self.current_logging_step]['params'] = params

    def init_experiment(self, exp_name_log, full_name=None, **kwargs):
        if full_name.__contains__('Session'):
            full_name = 'setup'
        print()
        print(Fore.GREEN +
              f"init experiment: {exp_name_log}, {full_name}" + Fore.RESET)
        self.current_logging_step = full_name
        self.results[self.current_logging_step] = {}

    def set_tags(self, source, experiment_custom_tags, runtime, USI=None):
        print(
            Fore.GREEN + f"set tags: {source}, {experiment_custom_tags}, {runtime}, {USI}" + Fore.RESET)

    def log_sklearn_pipeline(self, experiment, prep_pipe, model, path=None):
        # print(Fore.GREEN + f"log sklearn pipeline: {experiment}, {prep_pipe}, {model}, {path}" + Fore.RESET)
        pass

    def log_model_comparison(self, model_result, source):
        print()
        print(Fore.GREEN +
              f"log model comparison: {model_result}, {source}" + Fore.RESET)
        # self.results[self.current_logging_step]['model_results_comp'] = model_result.to_json()

    def log_metrics(self, metrics, source=None):
        if source == 'finalize_model':
            return
        print(Fore.GREEN + f"log metrics: {metrics}, {source}" + Fore.RESET)
        self.results[self.current_logging_step]['metrics'] = metrics

    def log_plot(self, plot, title):
        print(Fore.GREEN + f"log plot: {plot}, {title}" + Fore.RESET)

    def log_hpram_grid(self, html_file, title="hpram_grid"):
        print(Fore.GREEN +
              f"log hpram grid: {html_file}, {title}" + Fore.RESET)

    def log_artifact(self, file, type="artifact"):
        # print(Fore.GREEN + f"log artifact: {file}, {type}" + Fore.RESET)
        pass

    def finish_experiment(self) -> dict:
        print(Fore.GREEN + f"Compiling logs" + Fore.RESET)

    def get_results(self):
        print(Fore.GREEN + f"gathering results" + Fore.RESET)
        results = copy.deepcopy(self.results)
        self.results = {}
        return results

    def info(self, msg):
        print(Fore.GREEN + f"{msg}" + Fore.RESET)
