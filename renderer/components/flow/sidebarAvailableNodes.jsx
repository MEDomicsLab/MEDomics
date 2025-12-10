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

const SectionContainer = ({ title, children }) => (
  <div className="card mb-3">
    <h6 className="section-header p-2 border-bottom">
      {title}
    </h6>
    <Stack direction="vertical" gap={1}>
      {children}
    </Stack>
  </div>
)

const SidebarAvailableNodes = ({ title, sidebarType, experimenting }) => {
  const { initializationNodes, trainingNodes, otherNodes } = useMemo(() => {
    const originalNodes = nodesParams[sidebarType] || {}
    const filteredNodes = experimenting
      ? Object.fromEntries(
          Object.entries(originalNodes).filter(([, node]) => 
            node?.experimenting === true
          )
        )
      : Object.fromEntries(
          Object.entries(originalNodes).filter(([, node]) => 
            node?.experimenting === false || node?.section !== 'training' && node?.section !== 'analysis'
          )
        )
    // Categorize nodes when not in experimenting mode
    if (!experimenting) {
      return Object.entries(filteredNodes).reduce((acc, [nodeName, node]) => {
        const section = node?.section?.toLowerCase() || 'other'
        if (section.includes('init')) acc.initializationNodes[nodeName] = node
        else if (section.includes('train')) acc.trainingNodes[nodeName] = node
        else acc.otherNodes[nodeName] = node
        return acc
      }, { 
        initializationNodes: {}, 
        trainingNodes: {}, 
        otherNodes: {} 
      })
    }

    // Return all nodes in one group when not experimenting
    return { 
      initializationNodes: {}, 
      trainingNodes: {}, 
      otherNodes: filteredNodes 
    }
  }, [sidebarType, experimenting])

  const renderNode = (nodeName, node) => (
    <div
      key={nodeName}
      className="draggable-component"
      onDragStart={(event) =>
        onDragStart(event, {
          nodeType: node.type,
          name: node.title,
          image: node.img
        })
      }
      draggable
    >
      <Card
        className="draggable-side-node"
        pt={{
          body: { className: "padding-0-important" },
          header: { className: "header" }
        }}
        header={
          <>
            {node.title}
            <img 
              src={`/icon/${sidebarType}/${node.img}`} 
              alt={node.title} 
              className="icon-nodes" 
            />
          </>
        }
      />
    </div>
  )

  return (
    <div className="available-nodes-panel-container">
      <Card
        className="text-center height-100 available-nodes-panel"
        title={title}
        pt={{
          body: { className: "overflow-auto height-100 p-2" }
        }}
      >
        {!experimenting ? (
          <>
            {Object.keys(initializationNodes).length > 0 && (
              <SectionContainer title="Initialization Nodes">
                {Object.entries(initializationNodes).map(([nodeName, node]) => 
                  renderNode(nodeName, node)
                )}
              </SectionContainer>
            )}

            {Object.keys(trainingNodes).length > 0 && (
              <SectionContainer title="Training Nodes">
                {Object.entries(trainingNodes).map(([nodeName, node]) => 
                  renderNode(nodeName, node)
                )}
              </SectionContainer>
            )}


            {Object.keys(otherNodes).length > 0 && (
              <SectionContainer title="Other Nodes">
                {Object.entries(otherNodes).map(([nodeName, node]) => 
                  renderNode(nodeName, node)
                )}
              </SectionContainer>
            )}
          </>
        ) : (
          <Stack direction="vertical" gap={1}>
            {Object.entries(otherNodes).map(([nodeName, node]) => 
              renderNode(nodeName, node)
            )}
          </Stack>
        )}
      </Card>
    </div>
  )
}

export default SidebarAvailableNodes
