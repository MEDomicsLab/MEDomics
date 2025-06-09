import { Card } from "primereact/card"
import nodesParams from "../../public/setupVariables/allNodesParams"
import { Stack } from "react-bootstrap"
import { useMemo } from "react"

/**
 *
 * @param {*} event Represents the drag event that is fired when a node is dragged from the sidebar
 * @param {*} node Information about the node that is being dragged
 *
 * @description
 * This function is called when a node is dragged from the sidebar.
 * It sets the data that is being dragged.
 *
 * @returns {void}
 */
const onDragStart = (event, node) => {
  const stringNode = JSON.stringify(node)
  event.dataTransfer.setData("application/reactflow", stringNode)
  event.dataTransfer.effectAllowed = "move"
}

/**
 * @param {string} title The title of the sidebar
 * @param {string} sidebarType Corresponding to a key in nodesParams
 *
 * @returns {JSX.Element} A Card for each node in nodesParams[sidebarType]
 *
 * @description
 * This component is used to display the nodes available in the sidebar.
 *
 */
const SidebarAvailableNodes = ({ title, sidebarType, experimenting }) => {
  // Create filtered copy without mutating the original
  const filteredNodes = useMemo(() => {
    const originalNodes = nodesParams[sidebarType]
    return experimenting 
      ? Object.fromEntries(
          Object.entries(originalNodes).filter(([, node]) => 
            node?.experimenting === true
          )
        )
      : originalNodes
  }, [sidebarType, experimenting]) // Re-run when these change

  return (
    <>
      <div className="available-nodes-panel-container ">
        <Card
          className="text-center height-100 available-nodes-panel"
          title={title}
          pt={{
            body: { className: "overflow-auto height-100" }
          }}
        >
          <Stack direction="vertical" gap={1}>
            {Object.keys(filteredNodes).map((nodeName) => {
              // this code is executed for each node in nodesParams[sidebarType] and returns a Card for each node
              // it also attaches the onDragStart function to each Card so that the node can be dragged from the sidebar and dropped in the flow
              // the data that is being dragged is set in the onDragStart function and passed to the onDrop function in the flow
              let node = filteredNodes[nodeName]
              return (
                <div
                  key={nodeName}
                  className="draggable-component"
                  onDragStart={(event) =>
                    onDragStart(event, {
                      nodeType: `${node.type}`,
                      name: `${node.title}`,
                      image: `${node.img}`
                    })
                  }
                  draggable
                >
                  <Card
                    key={node.title}
                    className="draggable-side-node"
                    pt={{
                      body: { className: "padding-0-important" },
                      header: { className: "header" }
                    }}
                    header={
                      <>
                        {node.title}
                        <img src={`/icon/${sidebarType}/${node.img}`} alt={node.title} className="icon-nodes" />
                      </>
                    }
                  />
                </div>
              )
            })}
          </Stack>
          {/* </div> */}
        </Card>
      </div>
    </>
  )
}

export default SidebarAvailableNodes
