import json
import os
import sys
from pathlib import Path

try:
    from huggingface_hub import scan_cache_dir
except ModuleNotFoundError:
    scan_cache_dir = None

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments

MODULE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
REGISTRY_PATH = MODULE_DIR / "text_model_registry.json"


def load_predefined_models(registry_path: Path = REGISTRY_PATH) -> list:
    """Read the model registry JSON and return its 'models' list."""
    with registry_path.open("r", encoding="utf-8") as registry_file:
        registry = json.load(registry_file)
    return registry.get("models", [])


def get_cached_repo_ids() -> set:
    """Return the set of HF repo ids (e.g. 'org/name') present in the local cache.

    Returns an empty set (never raises) if huggingface_hub isn't installed or
    the cache scan fails for any reason (e.g. no cache directory yet) - this
    correctly reads as "nothing downloaded" rather than an error.
    """
    if scan_cache_dir is None:
        return set()
    try:
        cache_info = scan_cache_dir()
    except Exception:
        return set()
    return {repo.repo_id for repo in cache_info.repos}


def compute_download_status(models: list, cached_repo_ids: set) -> dict:
    """Map each model's model_id to whether its HF repo is in cached_repo_ids."""
    return {
        model["model_id"]: model["hf_model_name_or_path"] in cached_repo_ids
        for model in models
    }


class GoExecScriptCheckModelsDownloaded(GoExecutionScript):
    """Reports which predefined text models are already in the local HF cache."""

    def _custom_process(self, json_params: dict) -> dict:
        models = load_predefined_models()
        cached_repo_ids = get_cached_repo_ids()
        return compute_download_status(models, cached_repo_ids)


if __name__ == "__main__":
    json_params_dict, id_ = parse_arguments()
    script = GoExecScriptCheckModelsDownloaded(json_params_dict, id_)
    script.start()
