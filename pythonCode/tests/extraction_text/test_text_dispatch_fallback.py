from pathlib import Path
import sys
import types

import pytest


ROOT = Path(__file__).resolve().parents[3]
BACKEND_REGISTRY_PATH = (
    ROOT / "pythonCode/modules/extraction_text/text_model_registry.json"
)
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

from pythonCode.modules.extraction_text import text_feature_extraction as tfe


def _load_registry():
    return tfe.load_text_model_registry(BACKEND_REGISTRY_PATH)


def test_predefined_model_id_resolves_from_registry():
    registry = _load_registry()
    resolved = tfe.resolve_model_path("predefined", "biobert_v1_1", registry)
    assert resolved == "dmis-lab/biobert-v1.1"


def test_unknown_model_id_raises_deterministic_error_without_fallback():
    registry = _load_registry()
    with pytest.raises(ValueError) as err:
        tfe.resolve_model_path("predefined", "does_not_exist", registry)

    message = str(err.value)
    assert "Accepted model IDs" in message
    assert "biobert_v1_1" in message


def test_fallback_to_default_predefined_model(monkeypatch):
    registry = _load_registry()
    default_model_id = tfe.get_default_model_id(registry)
    default_model_path = tfe.get_model_path_by_id(default_model_id, registry)

    called_paths = []

    def fake_tokenizer_loader(path):
        called_paths.append(("tokenizer", path))
        if path == "broken/model":
            raise RuntimeError("primary tokenizer load failed")
        return object()

    def fake_model_loader(path):
        called_paths.append(("model", path))
        if path == "broken/model":
            raise RuntimeError("primary model load failed")
        return object()

    monkeypatch.setattr(tfe.AutoTokenizer, "from_pretrained", fake_tokenizer_loader)
    monkeypatch.setattr(tfe.AutoModel, "from_pretrained", fake_model_loader)

    tokenizer, model, selected_path = tfe.load_transformer_components(
        primary_model_path="broken/model",
        default_model_path=default_model_path,
        allow_model_fallback=True,
    )

    assert tokenizer is not None
    assert model is not None
    assert selected_path == default_model_path
    assert ("tokenizer", "broken/model") in called_paths
    assert ("tokenizer", default_model_path) in called_paths


def test_go_routes_remain_stable():
    contents = GO_ROUTES_PATH.read_text(encoding="utf-8")
    assert "/BioBERT_extraction/" in contents
    assert "/TransformerText_extraction/" in contents
    assert "/progress/" in contents
