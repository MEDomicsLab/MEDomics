import os
import re
import sys
from pathlib import Path

sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
)

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running readPTHmodel.py:" + id_)


class GoExecScriptReadPthModel(GoExecutionScript):
    """
        Reads the architecture of a pretrained PyTorch state_dict, so the Model node
        can fill 'Number of layers' and 'Hidden size' from the file.

        Expected JSON:
        {
            "pthPath": "/path/to/model.pth"
        }
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        import torch

        pth_path = json_config.get("pthPath")
        if not pth_path:
            raise ValueError("No path to the pretrained model was provided.")
        pth_path = os.path.abspath(pth_path)
        if not os.path.exists(pth_path):
            raise FileNotFoundError(f"Model file not found at: {pth_path}")

        go_print(f"Reading pretrained model architecture from: {pth_path}")

        # Same loading rules as the simulation (plain state_dict only)
        try:
            state_dict = torch.load(pth_path, map_location=torch.device('cpu'), weights_only=True)
        except Exception as e:
            # torch's message is long and colored, keep it in the logs only
            go_print(f"torch.load failed: {e}")
            raise ValueError(
                "Could not load the file as a state_dict. Save the pretrained model with "
                "torch.save(model.state_dict(), path), not torch.save(model, path).")
        if not isinstance(state_dict, dict):
            raise ValueError(
                f"The file does not contain a state_dict (got {type(state_dict).__name__}). "
                f"Save it with torch.save(model.state_dict(), path).")

        # The simulation's BinaryClassifier stores its weights as layers.<i>.weight / layers.<i>.bias
        layer_weights = {}
        for key, tensor in state_dict.items():
            match = re.fullmatch(r"layers\.(\d+)\.(weight|bias)", key)
            if match is None:
                raise ValueError(
                    f"Unexpected key '{key}': the file does not come from the MEDfl simulation model "
                    f"(expected only layers.<i>.weight / layers.<i>.bias keys).")
            if match.group(2) == "weight":
                layer_weights[int(match.group(1))] = tensor

        indices = sorted(layer_weights)
        if len(indices) < 2 or indices != list(range(len(indices))):
            raise ValueError("The file must contain an input layer and an output layer (layers.0 ... layers.N).")

        weights = [layer_weights[i] for i in indices]
        if any(w.dim() != 2 for w in weights):
            raise ValueError("All layer weights must be 2D (nn.Linear).")

        hidden_size = int(weights[0].shape[0])
        input_size = int(weights[0].shape[1])

        # Hidden layers are hidden x hidden, the output layer is 1 x hidden
        for i, w in enumerate(weights[1:-1], start=1):
            if tuple(w.shape) != (hidden_size, hidden_size):
                raise ValueError(
                    f"layers.{i}.weight has shape {tuple(w.shape)}, expected ({hidden_size}, {hidden_size}): "
                    f"all hidden layers must have the same size.")
        if tuple(weights[-1].shape) != (1, hidden_size):
            raise ValueError(
                f"The output layer has shape {tuple(weights[-1].shape)}, expected (1, {hidden_size}).")

        self.results = {
            "data": {
                "num_layers": len(weights) - 1,
                "hidden_size": hidden_size,
                "input_size": input_size,
            },
            "stringFromBackend": "Model architecture successfully extracted.",
        }
        return self.results


readPthModel = GoExecScriptReadPthModel(json_params_dict, id_)
readPthModel.start()
