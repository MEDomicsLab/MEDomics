import { useContext } from "react"
import { Button, Card, Stack } from "react-bootstrap"
import Image from "next/image"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { FaAlignJustify, FaChartLine, FaCogs, FaFileCsv, FaGlobe } from "react-icons/fa"
import { LayoutModelContext } from "../layout/layoutContext"
import { LuBrain } from "react-icons/lu"
import { FaImage } from "react-icons/fa6"

export default function ExtractionLandingPage({}) {
  const { dispatchLayout } = useContext(LayoutModelContext)

  function choosePage(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}Module`)
    dispatchLayout({ type: `open${name}Module`, payload: { pageId: name } })
  }

  return (
    <div className="h-100 w-100">
      <h1 className="text-center  fw-bold text-secondary my-5" style={{ fontSize: "3rem", letterSpacing: "1px" }}>
        Extraction Module
      </h1>
      <div style={{ display: "flex", flexDirection: "vertical", flexGrow: "10", width: "100%", margin: "auto" }}>
        <Stack direction="vertical" gap={3} >
          {/* Extraction Module heading */}

          {/* Welcome Line */}
          <h4 className="px-3 text-center">
            Welcome to the Extraction Module <Image src={myimage} alt="" style={{ height: "25px", width: "25px" }} />
          </h4>

          {/* Main Title and Subtitle */}
          <div className="h-100 w-100 d-flex justify-content-center align-items-center">
            <Stack direction="horizontal" gap={4} className="w-100">
              {/* MEDimage Card */}
              <Card className="flex-fill shadow-sm border-primary h-100 w-50 hover-border-success" onClick={(e) => choosePage(e, "ExtractionMEDimage")} style={{ cursor: "pointer" }}>
                <Card.Header className="bg-primary text-white d-flex align-items-center">
                  <LuBrain className="me-2" />
                  <h5 className="mb-0">MEDimage</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={myimage} alt="MEDimage" width={120} height={120} />
                  <Card.Text className="mt-3 text-center text-muted">
                    Extract radiomic features from medical images and analyze your radiomics data using machine learning models.
                  </Card.Text>
                  <Button variant="primary" onClick={(e) => choosePage(e, "ExtractionMEDimage")}>
                    Start Extraction
                  </Button>
                </Card.Body>
              </Card>

              {/* Text Card */}
              <Card className="flex-fill shadow-sm border-success h-100 w-50" style={{ cursor: "pointer" }} onClick={(e) => choosePage(e, "ExtractionText")}>
                <Card.Header className="bg-success text-white d-flex align-items-center">
                  <FaAlignJustify className="me-2" />
                  <h5 className="mb-0">Text</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={myimage} alt="Text" width={120} height={120} />
                  <Card.Text className="mt-3 text-center text-muted">
                    Extract Embeddings from Text Notes using a variety of models.
                  </Card.Text>
                  <Button variant="success" onClick={(e) => choosePage(e, "ExtractionText")}>
                    Start Extraction
                  </Button>
                </Card.Body>
              </Card>
            </Stack>
          </div>
        </Stack>
      </div>

      <div style={{ paddingTop: "1rem", display: "flex", flexDirection: "vertical", flexGrow: "10", width: "100%", margin: "auto" }}>
        <Stack direction="vertical" gap={3} style={{ padding: "20px 0 0 0" }}>
          <div className="h-100 w-100 d-flex justify-content-center align-items-center">
            <Stack direction="horizontal" gap={4} className="w-100">
              {/* Time Series Card */}
              <Card className="flex-fill shadow-sm border-secondary h-100 w-50 hover-border-success" onClick={(e) => choosePage(e, "ExtractionTS")} style={{ cursor: "pointer" }}>
                <Card.Header className="bg-secondary text-white d-flex align-items-center">
                  <FaChartLine className="me-2" />
                  <h5 className="mb-0">Time Series</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={myimage} alt="Time Series" width={120} height={120} />
                  <Card.Text className="mt-3 text-center text-muted">
                    Extract time series characteristics from physiological signals using TSFRESH and other models.
                  </Card.Text>
                  <Button variant="secondary" onClick={(e) => choosePage(e, "ExtractionTS")}>
                    Start Extraction
                  </Button>
                </Card.Body>
              </Card>

              {/* Image Card */}
              <Card className="flex-fill shadow-sm border-warning h-100 w-50" style={{ cursor: "pointer" }} onClick={(e) => choosePage(e, "ExtractionImage")}>
                <Card.Header className="bg-warning text-white d-flex align-items-center">
                  <FaImage className="me-2" />
                  <h5 className="mb-0">Image</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={myimage} alt="Image" width={120} height={120} />
                  <Card.Text className="mt-3 text-center text-muted">
                    Extract Embeddings from JPG images using a variety of models from TorchXRayVision python library.
                  </Card.Text>
                  <Button variant="warning" onClick={(e) => choosePage(e, "ExtractionImage")}>
                    Start Extraction
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
