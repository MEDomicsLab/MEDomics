import learningNodesParams from "./learningNodesParams"
import optimizeNodesParams from "./optimizeNodesParams"
import extractionMEDimageNodesParams from "./extractionMEDimageNodesParams"
import featuresNodesParams from "./featuresNodesParams"
import medflNodesParams from "./medflNodesParams"
import flNetworkNodesParams from './flNetworkNodesParams'
import flrwNodeParams from './medflrwNodesParams'
import flrwNetworkNodeParams from './medflrwNetwork'

const nodesParams = {
  learning: learningNodesParams,
  optimize: optimizeNodesParams,
  extraction: extractionMEDimageNodesParams,
  features: featuresNodesParams, 
  fl : medflNodesParams, 
  flNetwork : flNetworkNodesParams , 
  rwfl : flrwNodeParams , 
  rwflNetwork : flrwNetworkNodeParams
  
}

export default nodesParams
