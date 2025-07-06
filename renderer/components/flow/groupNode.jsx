import React, { useContext } from "react"
import { FlowFunctionsContext } from "./context/flowFunctionsContext"
import Node from "./node"

/**
 *
 * @param {*} id id of the node
 * @param {*} data data of the node
 * @param {*} type type of the node
 * @returns {JSX.Element} A GroupNode
 *
 * @description
 * This component is used to display a GroupNode.
 * A GroupNode is a node that contains a subflow, so it handles a click that change the active display subflow.
 * It does not implement a Node because it does not need to have access to an offcanvas
 */
const GroupNode = ({ id, data }) => {
  const { changeSubFlow } = useContext(FlowFunctionsContext) // used to get the functions to change the subflow, run the node and delete the node

  return (
    <>
      <Node id={id} data={data} onClickCustom={() => {changeSubFlow(id) ; console.log(id)}} isGroupNode />
    </>
  )
}

export default GroupNode
