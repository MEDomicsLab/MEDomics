import React from "react"
import { Button, Stack } from "react-bootstrap"
import Image from "next/image"
import myimage from "../../../resources/medomics_transparent_bg.png"

export default function MedflWelcomePage({ changePage }) {
  return (
    <div className="h-100 w-100  d-flex">
      <div style={{ paddingTop: "1rem", display: "flex", flexDirection: "vertical", flexGrow: "10", width: "70%", margin: "auto 0" }}>
        <Stack direction="vertical" gap={3} style={{ padding: "0 0 0 0" }}>
          <h5 className="px-3 w-75"> Welcome to MEDfl</h5>

          <Stack direction="horizontal" gap={5} style={{ padding: "0 0 0 0", width: "85%" }}>
            <h1 style={{ fontSize: "4rem", lineHeight: "0.9", fontWeight: "400" }}>
              <span style={{ fontWeight: "800" }} className="text-primary">
                MEDfl
              </span>{" "}
              A Friendly Federated Learning Framework
            </h1>

            <Image src={myimage} alt="" style={{ height: "175px", width: "175px" }} />
          </Stack>

          <h5 className="px-3 w-75"> A comprehensive package for simulating the federated learning process in the medical field, featuring an intuitive user interface for seamless interaction.</h5>
          <Button
            onClick={() => {
              changePage(false)
            }}
            className="  mx-3 fw-bold  mt-3"
            style={{ width: "30%", padding: "10px", fontSize: "1.1rem" }}
          >
            GET STARTED
          </Button>
        </Stack>
      </div>
    </div>
  )
}
