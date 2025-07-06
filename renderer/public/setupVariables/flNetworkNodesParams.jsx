/* eslint-disable */
const nodesParams = {
  client: {
    type: "flClientNode",
    classes: "object",
    nbInput: 0,
    nbOutput: 1,
    input: [],
    output: ["client"],
    img: "node.png",
    title: "Client",
    possibleSettings: {}
  },

  fl_server: {
    type: "flServerNode",
    classes: "object   ",
    nbInput: 1,
    nbOutput: 0,
    input: ["client"],
    output: [],
    img: "server.png",
    title: "FL Server",
    possibleSettings: {}
  }
}

export default nodesParams
