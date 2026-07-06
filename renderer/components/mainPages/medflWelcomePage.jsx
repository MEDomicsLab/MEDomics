import Image from "next/image"
import { Message } from "primereact/message"
import { useContext } from "react"
import { Button, Card, Stack } from "react-bootstrap"
import { FaCogs, FaGlobe } from "react-icons/fa"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { LayoutModelContext } from "../layout/layoutContext"

export default function MedflWelcomePage() {
  const { dispatchLayout } = useContext(LayoutModelContext)

  function choosePage(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}Module`)
    dispatchLayout({ type: `open${name}Module`, payload: { pageId: name } })
  }

  return (
    <div className="h-100 w-100">
      <h1 className="text-center  fw-bold text-secondary mt-5" style={{ fontSize: "3rem", letterSpacing: "1px" }}>
        Federated Learning Module
      </h1>

      <div className="mx-auto text-center my-3" >
        <Image className="text-center" src={myimage} alt="" style={{ height: "30px", width: "30px" }} />
      </div>
      <div className="my-3" style={{ display: "flex", flexDirection: "vertical", flexGrow: "10", width: "100%", margin: "auto" }}>
        <Stack direction="vertical" gap={3} style={{ padding: "20px 0 0 0" }}>

          {/* Main Title and Subtitle */}
          <Stack direction="horizontal" gap={5} style={{ padding: "0" }}>
            <div className="text-center w-100 my-3">
              <h3 style={{ fontSize: "1.5rem", fontWeight: "400" }} className="text-center mb-3 w-75 mx-auto">
                <span style={{ fontWeight: "800" }} className="text-primary">
                  MEDfl
                </span>{" "}
                A Collaborative Framework for Federated Learning in Medicine
              </h3>
              <Message severity="success" text="This package will be available soon!"/>
            </div>
          </Stack>

          {/* <h5 className="px-3 w-75"> A comprehensive package for simulating the federated learning process in the medical field, featuring an intuitive user interface for seamless interaction.</h5> */}
          <div className="h-100 w-100 d-flex justify-content-center align-items-center my-3">
            <Stack direction="horizontal" gap={4} className="w-75">
              {/* Simulation Card */}
              <Card className="flex-fill shadow-sm border-primary h-100 hover-border-success" style={{ cursor: "pointer" }}>
                <Card.Header className="bg-primary text-white d-flex align-items-center">
                  <FaCogs className="me-2" color="white" />
                  <h5 className="text-white mb-0">Simulation FL</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={myimage} alt="Simulation" width={120} height={120} />
                  <Card.Text className="mt-3 text-center">
                    Run a full federated learning simulation locally. Perfect for testing pipelines, debugging strategies, and visualizing metrics in a controlled environment.
                  </Card.Text>
                  <Button disabled variant="primary" onClick={(e) => choosePage(e, "MEDfl")}>
                    Start Simulation
                  </Button>
                </Card.Body>
              </Card>

              {/* Real-World Card */}
              <Card className="flex-fill shadow-sm border-success h-100" style={{ cursor: "pointer" }}>
                <Card.Header className="bg-success text-white d-flex align-items-center">
                  <FaGlobe className="me-2" color="white" />
                  <h5 className="text-white mb-0">Real-World FL</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={myimage} alt="Real World" width={120} height={120} />
                  <Card.Text className="mt-3 text-center">
                    Connect to real devices or remote servers to orchestrate a production-grade federated learning workflow with secure communication and live data.
                  </Card.Text>
                  <Button disabled variant="success" onClick={(e) => choosePage(e, "flRwWorkflow")}>
                    Go Live
                  </Button>
                </Card.Body>
              </Card>
            </Stack>
          </div>
        </Stack>
      </div>
    </div>
  )
}
