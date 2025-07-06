import React, { useState } from "react"
import Node from "../../flow/node"
import { Button, Form } from "react-bootstrap"
import FlResultsModal from "../flResultsModal"
import FlInput from "../flInput"
import { Message } from "primereact/message"
import Image from "next/image"

import flresglob from "../../../public/images/flResGlob.png"
import flresnode from "../../../public/images/flResNode.png"
import flrescomp from "../../../public/images/flResComp.png"

export default function FlResultsNode({ id, data }) {
  const [resultsType, setType] = useState("global")
  const [showModal, setModalShow] = useState(false)

  const onSelectionChange = (e) => {
    setType(e.target.value)
  }

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
            <Form.Select
              aria-label="machine learning model"
              onChange={onSelectionChange}
              defaultValue={resultsType}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <option
                key="global"
                value={"global"}
                // selected={optionName === selection}
              >
                Global results
              </option>
              <option
                key="node"
                value={"by_node"}
                // selected={optionName === selection}
              >
                Results by node
              </option>
              <option
                key="comp"
                value={"compare"}
                // selected={optionName === selection}
              >
                Compare results
              </option>
            </Form.Select>
          </>
        }
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            <Message
              severity="info"
              text={
                resultsType === "global"
                  ? " The global test results represent the cumulative total of all tests conducted on each individual node."
                  : resultsType === "by_node"
                    ? "The results  by node represent the tests specifically conducted on the selected node."
                    : "Comparing results between nodes involves considering all the nodes in the network and providing an overview of the results for each individual node."
              }
            />
            {resultsType === "by_node" ? (
              <FlInput
                name="Select Node"
                settingInfos={{
                  type: "list",
                  tooltip: "<p>Specify the node name</p>",
                  choices: [{ name: "North" }, { name: "south" }]
                }}
                currentValue={data.internal.settings.files || {}}
                onInputChange={() => {}}
                setHasWarning={() => {}}
              />
            ) : null}

            <FlInput
              name="Select pipeline"
              settingInfos={{
                type: "list",
                tooltip: "<p>Specify the pipeline name</p>",
                choices: [{ name: "First pipeline" }, { name: "second pipeline" }]
              }}
              currentValue={data.internal.settings.files || {}}
              onInputChange={() => {}}
              setHasWarning={() => {}}
            />
            <Button variant="light" className="width-100 btn-contour" onClick={() => setModalShow(true)}>
              {" "}
              Show results{" "}
            </Button>
            <FlResultsModal
              show={showModal}
              onHide={() => setModalShow(false)}
              results={
                <>
                  <Image src={resultsType === "global" ? flresglob : resultsType === "by_node" ? flresnode : flrescomp} alt={flresglob} />
                </>
              }
              title="Server global results"
            />
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<></>}
      />
    </>
  )
}
