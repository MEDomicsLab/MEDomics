import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
BACKEND_REGISTRY_PATH = (
    ROOT / "pythonCode/modules/extraction_text/text_model_registry.json"
)
RENDERER_REGISTRY_PATH = (
    ROOT / "renderer/components/extractionTabular/extractionTypes/textModelRegistry.js"
)

REQUIRED_MODEL_KEYS = {
    "model_id",
    "label",
    "hf_model_name_or_path",
    "source_type",
    "hidden_size",
    "enabled",
    "default_for_transformer_text",
    "validation_status",
}


def _load_backend_registry():
    with BACKEND_REGISTRY_PATH.open("r", encoding="utf-8") as registry_file:
        return json.load(registry_file)


def test_registry_entries_contain_required_keys():
    registry = _load_backend_registry()
    assert isinstance(registry.get("version"), str)
    assert isinstance(registry.get("models"), list)
    assert registry["models"]

    for model in registry["models"]:
        assert REQUIRED_MODEL_KEYS.issubset(model.keys())


def test_registry_model_ids_are_unique():
    registry = _load_backend_registry()
    model_ids = [model["model_id"] for model in registry["models"]]
    assert len(model_ids) == len(set(model_ids))


def test_registry_has_single_legacy_default_model():
    registry = _load_backend_registry()
    default_models = [
        model for model in registry["models"] if model["default_for_transformer_text"]
    ]
    assert len(default_models) == 1
    assert default_models[0]["model_id"] == "biobert_v1_1"


def test_registry_contains_new_onboarded_model():
    registry = _load_backend_registry()
    model_ids = {model["model_id"] for model in registry["models"]}
    assert "scibert_scivocab_uncased" in model_ids


def test_renderer_registry_ids_match_backend_registry():
    backend_registry = _load_backend_registry()
    backend_ids = {
        model["model_id"] for model in backend_registry["models"] if model["enabled"]
    }

    renderer_contents = RENDERER_REGISTRY_PATH.read_text(encoding="utf-8")
    renderer_ids = set(re.findall(r'value:\s*"([^"]+)"', renderer_contents))

    assert renderer_ids == backend_ids
