import os
import sys
from pathlib import Path
import psutil
import platform

# GPU utility library
try:
    import GPUtil
except ImportError:
    GPUtil = None

# Ensure parent directory is on path
sys.path.append(
    str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent)
)

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print

# Parse incoming JSON parameters and execution ID from Go
json_params_dict, id_ = parse_arguments()
go_print(json_params_dict.get('path', ''))

class GoExecScriptMachineSpecs(GoExecutionScript):
    """
    Collects and returns the host machine's characteristics, including GPU details if available.

    Args:
        json_params: JSON parameters from Go
        _id:      Execution ID
    """
    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": {}}

    def _custom_process(self, json_config: dict) -> dict:
        # Gather OS information
        specs = {
            'os': f"{platform.system()} {platform.release()}",
            'cpu_physical_cores': psutil.cpu_count(logical=False),
            'cpu_logical_cores': psutil.cpu_count(logical=True),
            'cpu_usage_percent': psutil.cpu_percent(interval=1),
        }

        # Memory stats
        mem = psutil.virtual_memory()
        specs.update({
            'total_memory_mb': mem.total // (1024**2),
            'memory_usage_percent': mem.percent,
        })

        # GPU details (if GPUtil is installed)
        gpu_info = []
        if GPUtil:
            try:
                gpus = GPUtil.getGPUs()
                go_print(f"Found {len(gpus)} GPU(s).")
                for gpu in gpus:
                    gpu_info.append({
                        'id': gpu.id,
                        'name': gpu.name,
                        'load_percent': round(gpu.load * 100, 2),
                        'memory_used_mb': gpu.memoryUsed,
                        'memory_total_mb': gpu.memoryTotal,
                        'temperature_c': gpu.temperature,
                    })
            except Exception as e:
                go_print(f"Error retrieving GPU information: {e}. GPUtil may not be installed or compatible.")
                # If any error occurs during GPU query, leave list empty
                pass
        else:
            go_print("GPUtil is not installed. GPU information will not be available.")
        specs['gpus'] = gpu_info

        # Package results
        self.results = {
            "data": specs,
            "stringFromBackend": "Machine characteristics retrieved"
        }
        self.set_progress(label="Machine specs retrieved", now=100)
        return self.results

# Instantiate and start the script
fl_machine_specs = GoExecScriptMachineSpecs(json_params_dict, id_)
fl_machine_specs.start()
