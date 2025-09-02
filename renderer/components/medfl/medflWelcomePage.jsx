import React, { useContext } from "react"
import { Button, Card, Stack } from "react-bootstrap"
import Image from "next/image"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { FaCogs, FaGlobe } from "react-icons/fa"
import { LayoutModelContext } from "../layout/layoutContext"

export default function MedflWelcomePage({}) {
  const { dispatchLayout, developerMode, setDeveloperMode } = useContext(LayoutModelContext)

  function choosePage(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}Module`)
    dispatchLayout({ type: `open${name}Module`, payload: { pageId: name } })
  }

  return (
    <div className="h-100 w-100">
      <h1 className="text-center  fw-bold text-secondary my-5" style={{ fontSize: "3rem", marginBottom: "1rem", letterSpacing: "1px" }}>
        Federated Learning Module
      </h1>
      <div style={{ paddingTop: "1rem", display: "flex", flexDirection: "vertical", flexGrow: "10", width: "100%", margin: "auto" }}>
        <Stack direction="vertical" gap={3} style={{ padding: "20px 0 0 0" }}>
          {/* Large Federated Learning Module heading */}

          {/* Welcome Line */}
          <h4 className="px-3 text-center">
            Welcome to MEDfl <Image src={myimage} alt="" style={{ height: "25px", width: "25px" }} />
          </h4>

          {/* Main Title and Subtitle */}
          <Stack direction="horizontal" gap={5} style={{ padding: "0" }}>
            <div>
              <h3 style={{ fontSize: "3.5rem", fontWeight: "400" }} className="text-center mb-3 w-75 mx-auto">
                <span style={{ fontWeight: "800" }} className="text-primary">
                  MEDfl
                </span>{" "}
                A Friendly Federated Learning Framework for Medicine
              </h3>
            </div>

            {/* Optional image on the right */}
            {/* <Image src={myimage} alt="" style={{ height: "175px", width: "175px" }} /> */}
          </Stack>

          {/* <h5 className="px-3 w-75"> A comprehensive package for simulating the federated learning process in the medical field, featuring an intuitive user interface for seamless interaction.</h5> */}
          <div className="h-100 w-100 d-flex justify-content-center align-items-center">
            <Stack direction="horizontal" gap={4} className="w-75">
              {/* Simulation Card */}
              <Card className="flex-fill shadow-sm border-primary h-100 hover-border-success" onClick={(e) => choosePage(e, "MEDfl")} style={{ cursor: "pointer" }}>
                <Card.Header className="bg-primary text-white d-flex align-items-center">
                  <FaCogs className="me-2" />
                  <h5 className="mb-0">Simulation FL</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={myimage} alt="Simulation" width={120} height={120} />
                  <Card.Text className="mt-3 text-center text-muted">
                    Run a full federated learning simulation locally. Perfect for testing pipelines, debugging strategies, and visualizing metrics in a controlled environment.
                  </Card.Text>
                  <Button variant="primary" onClick={(e) => choosePage(e, "MEDfl")}>
                    Start Simulation
                  </Button>
                </Card.Body>
              </Card>

              {/* Real-World Card */}
              <Card className="flex-fill shadow-sm border-success h-100" style={{ cursor: "pointer" }} onClick={(e) => choosePage(e, "flRwWorkflow")}>
                <Card.Header className="bg-success text-white d-flex align-items-center">
                  <FaGlobe className="me-2" />
                  <h5 className="mb-0">Real-World FL</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={myimage} alt="Real World" width={120} height={120} />
                  <Card.Text className="mt-3 text-center text-muted">
                    Connect to real devices or remote servers to orchestrate a production-grade federated learning workflow with secure communication and live data.
                  </Card.Text>
                  <Button variant="success" onClick={(e) => choosePage(e, "flRwWorkflow")}>
                    Go Live
                  </Button>
                </Card.Body>
              </Card>
            </Stack>
          </div>
          {/* <Button
            onClick={() => {
              changePage(false)
            }}
            className="  mx-3 fw-bold  mt-3"
            style={{ width: "30%", padding: "10px", fontSize: "1.1rem" }}
          >
            GET STARTED
          </Button> */}
        </Stack>
      </div>
    </div>
  )
}
