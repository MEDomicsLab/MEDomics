import copy
import pandas as pd
import os
import numpy as np
import json
from .nodes.NodeObj import *
from .nodes import *
from typing import Union
from pathlib import Path
from abc import ABC, abstractmethod
import sys
sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent))

DATAFRAME_LIKE = Union[dict, list, tuple, np.ndarray, pd.DataFrame]
TARGET_LIKE = Union[int, str, list, tuple, np.ndarray, pd.Series]
FOLDER, FILE, INPUT = 1, 2, 3


def is_primitive(obj):
    """
    Checks if the object is a primitive type.
    """
    primitive_types = (int, float, bool, str, bytes, type(
        None), dict, list, tuple, np.ndarray, pd.DataFrame, pd.Series)
    if isinstance(obj, primitive_types):
        # Check if the object is one of the primitive types
        return True

    return False


class MEDexperiment(ABC):
    """Class that represents an experiment. It contains all the information about the experiment, the pipelines, the nodes, etc.
    It also contains the methods to execute the experiment.

    This object takes one parameter in the constructor: the global configuration of the experiment.
    this dict should contain the following keys:
    - pageId: the id of the experiment
    - nbNodes2Run: the number of nodes in the experiment
    - nodes: a list of dict where each key is the node's id and the value is the node's information
    - pipelines: a dict where the keys are the nodes ids and the values are the next nodes ids, it represents the pipelines of the experiment
    - paths: a dict containing paths for handling save/load file. should at least, contains a 'ws' key representing the root path of the experiment

    """

    def __init__(self, global_json_config: json = None):
        """Constructor of the class. It initializes the experiment with the pipelines and the global configuration.

        Args:
            pipelines (json, optional): The pipelines of the experiment. Defaults to None.
            global_json_config (json, optional): The global configuration of the experiment. Defaults to None.
            nb_nodes (float, optional): The number of nodes in the experiment. Defaults to 0.
        """
        self.id = global_json_config['pageId']
        self.experiment_name = "Default experiment name"
        self.experiment = {}
        self.pipelines = global_json_config['pipelines']
        self.pipelines_to_execute = self.pipelines
        self.global_json_config = global_json_config
        self._results_pipeline = {}
        self._progress = {'currentLabel': '', 'now': 0.0}
        self._nb_nodes = global_json_config['nbNodes2Run']
        self._nb_nodes_done: float = 0.0
        self.global_json_config['unique_id'] = 0
        self.pipelines_objects = self.create_next_nodes(self.pipelines, {})

    def update(self, global_json_config: json = None):
        """Updates the experiment with the pipelines and the global configuration.

        Args:
            global_json_config (json, optional): The global configuration of the experiment. Defaults to None.
        """
        self.pipelines = global_json_config['pipelines']
        self.pipelines_to_execute = self.pipelines
        self.global_json_config = global_json_config
        self.global_json_config['unique_id'] = 0
        self._nb_nodes = global_json_config['nbNodes2Run']
        self._nb_nodes_done: float = 0.0
        self._progress = {
            'currentLabel': 'Updating pipeline\'s informations', 'now': 0.0}
        print("Experiment already exists. Updating experiment...")
        self.pipelines_objects = self.create_next_nodes(
            self.pipelines, self.pipelines_objects)

    def create_next_nodes(self, next_nodes: json, pipelines_objects: dict) -> dict:
        """Recursive function that creates the next nodes of the experiment.

        Args:
            next_nodes (json): The next nodes of the experiment.
            pipelines_objects (dict): The pipelines objects of the experiment.

        Returns:
            dict: The next nodes of the recursive sequence.
        """
        nodes = {}
        if next_nodes != {}:
            for current_node_id, next_nodes_id_json in next_nodes.items():
                # if it is a train_model node, we need to point to the model node
                # To be consistent with the rest of the nodes,
                # we create a new node with the same parameters but with the model id
                tmp_subid_list = current_node_id.split('*')
                if len(tmp_subid_list) > 1:
                    self.global_json_config['nodes'][current_node_id] = self.global_json_config['nodes'][tmp_subid_list[0]]
                    self.global_json_config['nodes'][current_node_id]['associated_id'] = tmp_subid_list[1]
                    self.global_json_config['nodes'][current_node_id]['id'] = current_node_id
                # then, we create the node normally
                node = self.create_Node(
                    self.global_json_config['nodes'][current_node_id])
                nodes[current_node_id] = self.handle_node_creation(
                    node, pipelines_objects)
                nodes[current_node_id]['obj'].just_run = False
                # if the node has next nodes
                if current_node_id in pipelines_objects:
                    nodes[current_node_id]['next_nodes'] = \
                        self.create_next_nodes(next_nodes_id_json,
                                               pipelines_objects[current_node_id]['next_nodes'])
                else:
                    nodes[current_node_id]['next_nodes'] = \
                        self.create_next_nodes(next_nodes_id_json, {})
        return nodes

    def handle_node_creation(self, node: Node, pipelines_objects: dict) -> dict:
        """Handles the creation of a node by checking if it already exists in the pipelines objects.

        Args:
            node (Node): The node to handle.
            pipelines_objects (dict): The pipelines objects of the experiment.

        Returns:
            dict: The node information containing the node and the next nodes.
        """
        # if the node already exists in the pipelines objects
        if node.id in pipelines_objects:
            # if the node is not the same object as the one in the pipelines objects
            if node != pipelines_objects[node.id]['obj']:
                return {'obj': node, 'next_nodes': {}}

            # else, we return the node in the pipelines objects
            else:
                tmp = {
                    'obj': pipelines_objects[node.id]['obj'],
                    'next_nodes': {},
                    'results': pipelines_objects[node.id]['results'],
                    'experiment': pipelines_objects[node.id]['experiment']
                }
                return tmp
        # else, we create the node
        else:
            return {'obj': node, 'next_nodes': {}}

    def start(self) -> None:
        """Starts the experiment by executing recursively each nodes of the pipelines to execute  and by saving the results.\n
        *Take note that the first iterations of the recursive function are the dataset nodes so the experiment object
         (pycaret) is created in setup_dataset() only called here in start()*
        """
        if self.pipelines is not None:
            # it starts the recursive with a dataset node
            for current_node_id, next_nodes_id_json in self.pipelines_to_execute.items():
                node_info = self.pipelines_objects[current_node_id]
                node: Node = node_info['obj']
                self._progress['currentLabel'] = node.username
                has_been_run = node.has_run()
                if not has_been_run or 'experiment' not in node_info:
                    node_info['results'] = {
                        'prev_node_id': None,
                        'data': node.execute()
                    }
                    experiment = self.experiment_setup(node_info, node)

                    node_info['experiment'] = experiment
                else:
                    print(
                        f"already run {node.username} -----------------------------------------------------------------------------")
                    experiment = node_info['experiment']

                self._nb_nodes_done += 1.0
                self._progress['now'] = round(
                    self._nb_nodes_done / self._nb_nodes * 100.0, 2)
                self._results_pipeline[current_node_id] = {
                    'next_nodes': copy.deepcopy(next_nodes_id_json),
                    'results': copy.deepcopy(node_info['results'])
                }
                print()
                self.execute_next_nodes(
                    prev_node=node,
                    next_nodes_to_execute=next_nodes_id_json,
                    next_nodes=node_info['next_nodes'],
                    results=self._results_pipeline[current_node_id]['next_nodes'],
                    experiment=self.copy_experiment(experiment)
                )

            print('finished')
            self._progress['currentLabel'] = 'finished'

    @abstractmethod
    def copy_experiment(self, exp: dict):
        """Copies the experiment object (pycaret) to be used in the recursive function.

        Args:
            exp (Object): The experiment object (pycaret).

        Returns:
            Object: The copied experiment object (pycaret).
        """
        return copy.deepcopy(exp)

    @abstractmethod
    def experiment_setup(self, node_info: dict, node: Node):
        """Sets up the experiment object

        Args:
            node_info (dict): The node information.
            node (Node): The node.

        Returns:
            Object: The experiment object (pycaret).
        """
        pass

    def execute_next_nodes(self, prev_node: Node, next_nodes_to_execute: json, next_nodes: json, results: json,
                           experiment: json):
        """Recursive function that executes the next nodes of the experiment pipeline.

        Args:
            prev_node (Node): The previous node already executed.
            next_nodes_to_execute (json): The next nodes to execute of the experiment.
            next_nodes (json): The next nodes of the experiment.
            results (json): The results of the experiment.
            experiment (json): The experiment object (pycaret).
        """
        if next_nodes_to_execute != {}:
            for current_node_id, next_nodes_id_json in next_nodes_to_execute.items():

                node_can_go = True
                node_info = next_nodes[current_node_id]
                node = node_info['obj']
                experiment = self.copy_experiment(experiment)
                exp_to_return = experiment
                self._progress['currentLabel'] = node.username
                if not node.has_run() or prev_node.has_changed():
                    if node.type == 'group_models':
                        print("group_models")
                        data = node.execute(experiment, **prev_node.get_info_for_next_node())
                        node_can_go = data['prev_node_complete']
                    else:
                        data = node.execute(experiment, **prev_node.get_info_for_next_node())

                    node_info['results'] = {
                        'prev_node_id': prev_node.id,
                        'data': data,
                    }
                    # Clean node return experiment
                    if "experiment" in node_info['results']['data']:
                        new_experiment = node_info['results']['data']['experiment']
                        self.modify_node_info(node_info, node, new_experiment)
                        node_info['experiment'] = new_experiment
                        exp_to_return = new_experiment

                    else:
                        self.modify_node_info(node_info, node, experiment)
                        node_info['experiment'] = experiment
                else:
                    print(
                        f"already run {node.username} -----------------------------------------------------------------------------")
                    experiment = node_info['experiment']

                self._nb_nodes_done += 1
                self._progress['now'] = round(
                    self._nb_nodes_done / self._nb_nodes * 100, 2)
                results[current_node_id] = {
                    'next_nodes': copy.deepcopy(next_nodes_id_json),
                    'results': node_info['results']
                }
                self.execute_next_nodes(
                    prev_node=node,
                    next_nodes_to_execute=next_nodes_id_json,
                    next_nodes=node_info['next_nodes'],
                    results=results[current_node_id]['next_nodes'],
                    experiment=exp_to_return
                )
                print(f'END-{node.username}')

    @abstractmethod
    def modify_node_info(self, node_info: dict, node: Node, experiment: dict):
        """Modifies the node information after the execution of the node.

        Args:
            node_info (dict): The node information.
            node (Node): The node.
            experiment (dict): The experiment object (pycaret).
        """
        pass

    @abstractmethod
    def create_Node(self, node_config: json) -> Node:
        """Creates a node from a json config composed of the node settings and other metadata.

        Args:
            node_config (json): The json config of the node.

        Returns:
            Node: The created node.
        """
        pass

    def get_results(self) -> dict:
        """Returns the results of the pipeline execution using some cleaning.

        Returns:
            dict: The results of the pipeline execution.
        """
        self._progress['currentLabel'] = 'Generating results'
        return_dict = {}
        for key, value in self._results_pipeline.items():
            if is_primitive(value):
                if isinstance(value, dict) or isinstance(value, list):
                    return_dict[key] = self.add_only_object(value)
                else:
                    try:
                        json.dumps(value)
                        return_dict[key] = value
                    except TypeError:
                        pass
                    try:
                        json.dumps(value)
                        return_dict[key] = value
                    except TypeError:
                        pass
        return return_dict

    def add_only_object(self, next_item: Union[dict, list]) -> dict:
        """Recursively adding only primitive objects.

        Args:
            next_item (json): The json to check.

        Returns:
            dict: The cleaned json.
        """
        to_iterate = []
        return_dict = {}
        if isinstance(next_item, dict):
            to_iterate = next_item.items()
        elif isinstance(next_item, list):
            to_iterate = enumerate(next_item)

        for key, value in to_iterate:
            if is_primitive(value):
                if isinstance(value, dict) or isinstance(value, list):
                    return_dict[key] = self.add_only_object(value)
                else:
                    try:
                        json.dumps(value)
                        return_dict[key] = value
                    except TypeError:
                        pass

                    except TypeError:
                        pass

        return return_dict

    def get_progress(self) -> dict:
        """Returns the progress of the pipeline execution.\n
        self._progress is a dict containing the current node in execution and the current progress of all processed nodes.\n
        this function is called by the frontend to update the progress bar continuously when the pipeline is running.

        Returns:
            dict: The progress of all pipelines execution.
        """
        return self._progress

    def set_progress(self, now: int = -1, label: str = "same") -> None:
        """Sets the progress of the pipeline execution.

        Args:
            now (int, optional): The current progress. Defaults to 0.
            label (str, optional): The current node in execution. Defaults to "".
        """
        if now == -1:
            now = self._progress['now']
        if label == "same":
            label = self._progress['currentLabel']
        self._progress = {'currentLabel': label, 'now': now}

    def make_save_ready(self):
        """Makes the experiment ready to be saved.
        """
        self._make_save_ready_rec(self.pipelines_objects)

    @abstractmethod
    def _make_save_ready_rec(self, next_nodes: dict):
        """
        Recursive function that makes the experiment ready to be saved.
        """
        pass

    def init_obj(self):
        """
        Initializes the experiment object (pycaret) from a path.
        """
        self._init_obj_rec(self.pipelines_objects)

    @abstractmethod
    def _init_obj_rec(self, next_nodes: dict):
        """
        Recursive function that initializes the experiment object (pycaret) from a path.
        """
        pass
