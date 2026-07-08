from pathlib import Path
import sys
import types

import pytest


ROOT = Path(__file__).resolve().parents[3]
GO_ROUTES_PATH = ROOT / "go_server/blueprints/extraction_text/extraction_text.go"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

server_utils_stub = types.ModuleType("med_libs.server_utils")
server_utils_stub.go_print = lambda *_args, **_kwargs: None
sys.modules.setdefault("med_libs.server_utils", server_utils_stub)

go_exec_stub = types.ModuleType("med_libs.GoExecutionScript")


class _GoExecutionScript:
    def __init__(self, *_args, **_kwargs):
        pass


def _parse_arguments():
    return {}, "test-id"


go_exec_stub.GoExecutionScript = _GoExecutionScript
go_exec_stub.parse_arguments = _parse_arguments
sys.modules.setdefault("med_libs.GoExecutionScript", go_exec_stub)

from pythonCode.modules.extraction_text import check_models_downloaded as cmd


FAKE_MODELS = [
    {"model_id": "model_a", "hf_model_name_or_path": "org/model-a"},
    {"model_id": "model_b", "hf_model_name_or_path": "org/model-b"},
]


def test_compute_download_status_marks_cached_repo_true():
    result = cmd.compute_download_status(FAKE_MODELS, {"org/model-a"})
    assert result == {"model_a": True, "model_b": False}


def test_compute_download_status_all_false_when_cache_empty():
    result = cmd.compute_download_status(FAKE_MODELS, set())
    assert result == {"model_a": False, "model_b": False}


def test_get_cached_repo_ids_returns_empty_set_when_library_missing(monkeypatch):
    monkeypatch.setattr(cmd, "scan_cache_dir", None)
    assert cmd.get_cached_repo_ids() == set()


def test_get_cached_repo_ids_returns_empty_set_on_scan_failure(monkeypatch):
    def _raise():
        raise RuntimeError("cache corrupted")

    monkeypatch.setattr(cmd, "scan_cache_dir", _raise)
    assert cmd.get_cached_repo_ids() == set()


def test_get_cached_repo_ids_extracts_repo_ids_from_scan_result(monkeypatch):
    class FakeRepo:
        def __init__(self, repo_id):
            self.repo_id = repo_id

    class FakeCacheInfo:
        repos = [FakeRepo("dmis-lab/biobert-v1.1"), FakeRepo("allenai/scibert_scivocab_uncased")]

    monkeypatch.setattr(cmd, "scan_cache_dir", lambda: FakeCacheInfo())
    result = cmd.get_cached_repo_ids()
    assert result == {"dmis-lab/biobert-v1.1", "allenai/scibert_scivocab_uncased"}


def test_load_predefined_models_reads_real_registry():
    models = cmd.load_predefined_models()
    model_ids = {model["model_id"] for model in models}
    assert "biobert_v1_1" in model_ids
    assert "scibert_scivocab_uncased" in model_ids


def test_go_route_registered_for_check_models_downloaded():
    contents = GO_ROUTES_PATH.read_text(encoding="utf-8")
    assert "/check_models_downloaded/" in contents
