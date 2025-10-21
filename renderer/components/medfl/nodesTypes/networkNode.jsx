import React from "react"
import Node from "../../flow/node"
import { Button } from "react-bootstrap"
import { PiFloppyDisk } from "react-icons/pi"

// MEDfl context
import { useMEDflContext } from "../../workspace/medflContext"

export default function NetworkNode({ id, data }) {
  // context
  const { medflData, addFlData } = useMEDflContext()

  return (
    <>
      {/* build on top of the Node component */}
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        // the body of the node is a form select (particular to this node)
        nodeBody={
          <>
            <div className="center">
              <Button
                onClick={() => {
                  addFlData({
                    ...medflData,
                    network: {
                      name: "new Network"
                    }
                  })
                  console.log(medflData)
                }}
                icon={<PiFloppyDisk size={"1.5rem"} />}
                rounded
                className="btn-secondary border  ms-auto"
              >
                Create FL network
              </Button>
            </div>
          </>
        }
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            <div>{medflData.network?.name}</div>
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<>test</>}
      />
    </>
  )
}
