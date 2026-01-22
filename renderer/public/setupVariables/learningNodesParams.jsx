import classificationSettings from "./possibleSettings/learning/classificationSettings"
import regressionSettings from "./possibleSettings/learning/regressionSettings"
import classificationModelsSettings from "./possibleSettings/learning/classificationModelSettings"
import regressionModelsSettings from "./possibleSettings/learning/regressionModelSettings"
/* eslint-disable */

export const sceneDescription = {
  extension: "medml",
  externalFolders: ["models", "notebooks"],
  internalFolders: []
}

const nodesParams = {
  dataset: {
    type: "datasetNode",
    nameID: "Dataset",
    classes: "object dataset run startNode",
    nbInput: 0,
    nbOutput: 1,
    input: [],
    output: ["dataset"],
    img: "dataset.png",
    title: "Dataset",
    link: "https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.setup",
    experimenting: true,
    section: "initialization",
    possibleSettings: {
      classification: classificationSettings["dataset"],
      regression: regressionSettings["dataset"]
    }
  },
  split: {
    type: "splitNode",
    nameID: "Split",
    classes: "action analyze run endNode",
    nbInput: 1,
    nbOutput: 1,
    input: ["dataset"],
    output: ["dataset"],
    img: "split.png",
    title: "Split",
    experimenting: false,
    section: "initialization",
    possibleSettings: { classification: classificationSettings["split"], regression: regressionSettings["analyze"] }
  },
  clean: {
    type: "standardNode",
    nameID: "Clean",
    classes: "action clean run",
    nbInput: 1,
    nbOutput: 1,
    input: ["dataset"],
    output: ["dataset"],
    img: "clean.png",
    title: "Clean",
    link: "https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.setup",
    experimenting: true,
    section: "initialization",
    possibleSettings: { classification: classificationSettings["clean"], regression: regressionSettings["clean"] }
  },
  model: {
    type: "selectionNode",
    nameID: "Model",
    classes: "object model",
    nbInput: 0,
    nbOutput: 1,
    input: [],
    output: ["model_config"],
    img: "model.png",
    title: "Model",
    link: "https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.create_model",
    experimenting: false,
    section: "initialization",
    possibleSettings: { classification: classificationModelsSettings, regression: regressionModelsSettings }
  },
  train_model: {
    type: "trainModelNode",
    nameID: "Train Model",
    classes: "action create_model run",
    nbInput: 2,
    nbOutput: 1,
    input: ["dataset", "model_config"],
    output: ["model"],
    img: "create_model.png",
    title: "Train model",
    link: "https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.create_model",
    experimenting: false,
    section: "training",
    possibleSettings: { classification: classificationSettings["create_model"], regression: regressionSettings["create_model"] }
  },
  compare_models: {
    type: "standardNode",
    nameID: "Compare Models",
    classes: "action compare_models run",
    nbInput: 1,
    nbOutput: 1,
    input: ["dataset"],
    output: ["model"],
    img: "compare_models.png",
    title: "Compare models",
    link: "https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.compare_models",
    experimenting: true,
    section: "training",
    possibleSettings: { classification: classificationSettings["compare_models"], regression: regressionSettings["compare_models"] }
  },
  combine_models: {
    type: "CombineModelsNode",
    nameID: "Combine Models",
    classes: "action combine_models",
    nbInput: 1,
    nbOutput: 1,
    input: ["model"],
    output: ["model"],
    img: "group_models.png",
    title: "Combine models",
    experimenting: false,
    section: "training",
    possibleSettings: { classification: classificationSettings["combine_models"], regression: regressionSettings["group_models"] }
  },
  load_model: {
    type: "loadModelNode",
    nameID: "Load Model",
    classes: "action load_model run",
    nbInput: 1,
    nbOutput: 1,
    input: ["dataset"],
    output: ["model"],
    img: "load_model.png",
    title: "Load model",
    link: "https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.load_model",
    experimenting: false,
    section: "unknown",
    possibleSettings: { classification: classificationSettings["load_model"], regression: regressionSettings["load_model"] }
  },
  /*optimize: {
    type: "groupNode",
    classes: "action optimize run",
    nbInput: 1,
    nbOutput: 1,
    input: ["model"],
    output: ["model"],
    img: "optimize.png",
    title: "Optimize",
    experimenting: false,
    section: "unknown",
    possibleSettings: { classification: classificationSettings["optimize"], regression: regressionSettings["optimize"] }
  },
  analyze: {
    type: "selectionNode",
    nameID: "Analyze",
    classes: "action analyze run endNode",
    nbInput: 1,
    nbOutput: 0,
    input: ["model"],
    output: [],
    img: "analyze.png",
    title: "Analyze",
    experimenting: true,
    section: "analysis",
    link: "https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.plot_model",
    possibleSettings: { classification: classificationSettings["analyze"], regression: regressionSettings["analyze"] }
  },*/
}

export default nodesParams
