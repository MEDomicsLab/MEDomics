/* eslint-disable */
const nodesParams = {
  // dataset: {
  //   type: "DatasetrwNode",
  //   classes: "object startNode",
  //   nbInput: 0,
  //   nbOutput: 1,
  //   input: [],
  //   output: ["dataset"],
  //   img: "dataset.png",
  //   title: "Dataset",
  //   possibleSettings: {}
  // },
  model: {
    type: "flModelNode",
    classes: "object model startNode",
    nbInput: 0,
    nbOutput: 1,
    input: ["dataset"],
    output: ["model"],
    img: "model.png",
    title: "Model",
    section: "initialization",
    possibleSettings: {}
  },
  fl_network: {
    type: "flrwNetworkNode",
    classes: "object",
    nbInput: 1,
    nbOutput: 1,
    input: ["model"],
    output: ["fl_network"],
    img: "network.png",
    section: "network",
    title: "FL Network",
    possibleSettings: {}
  },
  optimize: {
    type: "flOptimizeNode",
    classes: "action optimize run",
    nbInput: 2,
    nbOutput: 1,
    input: ["dataset", "model"],
    output: ["model"],
    img: "optimize.png",
    title: "Optimize",
    section: "train",
    possibleSettings: {}
  },
  // optimize: {
  //   type: "flOptimizeNode",
  //   classes: "action optimize run",
  //   nbInput: 2,
  //   nbOutput: 1,
  //   input: ["dataset", "model"],
  //   output: ["model"],
  //   img: "optimize.png",
  //   title: "Optimize",
  //   possibleSettings: {}
  // },

  // fl_strategy: {
  //   type: "flStrategyNode",
  //   classes: "object",
  //   nbInput: 1,
  //   nbOutput: 1,
  //   input: ["model"],
  //   output: ["strategy"],
  //   img: "strategy.png",
  //   title: "FL Strategy",
  //   possibleSettings: {}
  // },
  ml_strategy: {
    type: "mlStrategyNode",
    classes: "object",
    nbInput: 1,
    nbOutput: 1,
    input: ["fl_network"],
    output: ["ml_strategy"],
    img: "ml_icon.png",
    title: "ML Strategy",
    section: "train",
    possibleSettings: {}
  },
  fl_strategy: {
    type: "flRunServerNode",
    classes: "object",
    nbInput: 1,
    nbOutput: 0,
    input: ["ml_strategy"],
    output: ["results"],
    img: "strategy.png",
    title: "FL Strategy",
    section: "train",
    possibleSettings: {}
  }

  // save_results: {
  //   type: "flSaveModelNode",
  //   classes: "object",
  //   nbInput: 1,
  //   nbOutput: 0,
  //   input: ["results"],
  //   output: [],
  //   img: "save_model.png",
  //   title: "Save results",
  //   possibleSettings: {}
  // }
}

export default nodesParams
