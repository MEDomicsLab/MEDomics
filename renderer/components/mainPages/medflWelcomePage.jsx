import Image from "next/image"
import { Message } from "primereact/message"
import { useContext } from "react"
import { Button, Card, Stack } from "react-bootstrap"
import { FaCogs, FaGlobe } from "react-icons/fa"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { LayoutModelContext } from "../layout/layoutContext"
import ModuleLandingShell, { ModuleGuideText } from "./moduleBasics/ModuleLandingShell"

export default function MedflWelcomePage() {
  const { dispatchLayout } = useContext(LayoutModelContext)

  function choosePage(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}Module`)
    dispatchLayout({ type: `open${name}Module`, payload: { pageId: name } })
  }

  return (
    <ModuleLandingShell
      title="Federated Learning Module"
      description="Collaborative federated learning framework for medicine with MEDfl."
      infoContent={
        <ModuleGuideText>
          <p>
            <strong className="text-primary">MEDfl</strong> is a collaborative framework for federated learning in medicine.
          </p>
          <p className="mb-0">
            A comprehensive package for simulating the federated learning process in the medical field,
            featuring an intuitive user interface for seamless interaction.
          </p>
        </ModuleGuideText>
      }
      documentation={{
        url: "https://medfl.app",
        label: "MEDfl's Official Website",
      }}
    >
      <Message severity="success" text="This package will be available soon!" className="gap-3 m-4 w-50" />
      <Stack direction="horizontal" gap={4} className="flex-wrap align-items-stretch justify-content-center module-landing-tool-grid w-100">
        <Card className="flex-fill shadow-sm border-primary h-100 hover-border-success module-landing-tool-card" style={{ cursor: "pointer" }}>
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

        <Card className="flex-fill shadow-sm border-success h-100 module-landing-tool-card" style={{ cursor: "pointer" }}>
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
    </ModuleLandingShell>
  )
}
