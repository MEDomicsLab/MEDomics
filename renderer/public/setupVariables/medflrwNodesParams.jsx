/* eslint-disable */
const nodesParams = {
  dataset: {
    type: "DatasetrwNode",
    classes: "object startNode",
    nbInput: 0,
    nbOutput: 1,
    input: [],
    output: ["dataset"],
    img: "dataset.png",
    title: "Dataset",
    possibleSettings: {}
  },
  model: {
    type: "flModelNode",
    classes: "object model",
    nbInput: 1,
    nbOutput: 1,
    input: ["dataset"],
    output: ["model"],
    img: "model.png",
    title: "Model",
    possibleSettings: {}
  },
  network: {
    type: "groupNode",
    classes: "object",
    nbInput: 1,
    nbOutput: 1,
    input: ["model"],
    output: ["network"],
    img: "network.png",
    title: "Network",
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
  //   output: ["run_server"],
  //   img: "strategy.png",
  //   title: "FL Strategy",
  //   possibleSettings: {}
  // },
  run_server: {
    type: "flRunServerNode",
    classes: "object",
    nbInput: 1,
    nbOutput: 1,
    input: ["network"],
    output: ["results"],
    img: "server.png",
    title: "Run Server",
    possibleSettings: {}
  },

  save_results: {
    type: "flSaveModelNode",
    classes: "object",
    nbInput: 1,
    nbOutput: 0,
    input: ["results"],
    output: [],
    img: "save_model.png",
    title: "Save results",
    possibleSettings: {}
  }
}

export default nodesParams
