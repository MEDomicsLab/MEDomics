import React, { useContext, useEffect, useState } from "react";
import Image from "next/image";
import myimage from "../../../resources/medomics_transparent_bg.png";
import { Button, Stack } from "react-bootstrap";
import { WorkspaceContext } from "../workspace/workspaceContext";
import { ipcRenderer } from "electron";
import FirstSetupModal from "../generalPurpose/installation/firstSetupModal";

/**
 * @returns the home page component
 */
const HomePage = () => {
  const { workspace, setWorkspace, recentWorkspaces } = useContext(WorkspaceContext);
  const [hasBeenSet, setHasBeenSet] = useState(workspace.hasBeenSet);
  const [requirementsMet, setRequirementsMet] = useState(true);

  async function handleWorkspaceChange() {
    ipcRenderer.send("messageFromNext", "requestDialogFolder");
  }

  useEffect(() => {
    ipcRenderer.invoke("checkRequirements").then((data) => {
      setRequirementsMet(data.pythonInstalled && data.mongoDBInstalled);
    });
  }, []);

  useEffect(() => {
    setHasBeenSet(!workspace.hasBeenSet);
  }, [workspace]);

  useEffect(() => {
    ipcRenderer.send("messageFromNext", "getRecentWorkspaces");
  }, []);

  return (
    <div 
      className="container"
      style={{
        paddingTop: "1rem",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        overflowY: "auto",
        scrollbarColor: "#b0b0b0 #f5f5f5"
      }}
    >
      <Stack direction="vertical" gap={1} style={{ alignContent: "center", flexGrow: 1 }}>
        <h2>Home Page</h2>
        <Stack direction="horizontal" gap={0} style={{ alignContent: "center" }}>
          <h1 style={{ fontSize: "5rem" }}>MEDomicsLab</h1>
          <Image src={myimage} alt="" style={{ height: "175px", width: "175px" }} />
        </Stack>
        
        <h5>Set up your workspace to get started</h5>
        <Button onClick={handleWorkspaceChange} style={{ margin: "1rem" }}>
          Set Workspace
        </Button>

        <h5>Or open a recent workspace:</h5>
        <Stack direction="vertical" gap={0} style={{ alignContent: "center" }}>
          {recentWorkspaces.map((workspace, index) => {
            if (index > 4) return;
            return (
              <a
                key={index}
                onClick={() => {
                  ipcRenderer.invoke("setWorkingDirectory", workspace.path).then((data) => {
                    if (workspace !== data) {
                      let workspaceToSet = { ...data };
                      setWorkspace(workspaceToSet);
                    }
                  });
                }}
                style={{ margin: "0rem", color: "#0056b3", textDecoration: "none", cursor: "pointer" }}
              >
                <h6>{workspace.path}</h6>
              </a>
            );
          })}
        </Stack>

        {/* Getting Started Section (Full Width) */}
        <div
          style={{
            marginTop: "2rem",
            padding: "2rem",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            boxShadow: "0px 2px 5px rgba(0,0,0,0.1)",
            textAlign: "left",
            width: "100%",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#0056b3" }}>
            Getting Started 🚀
          </h3>
          
          <p>
          To effectively navigate MEDomicsLab and its functionalities, we recommend consulting the official documentation and tutorial resources.
          These materials will help you understand how to manage datasets, perform analyses, and evaluate machine learning models within the platform.
          </p>

          <p>We provide dedicated tutorials and documentation to guide you step by step:</p>

          <ul style={{ paddingLeft: "1.5rem", listStyleType: "none" }}>
            <li>📖 Documentation:  
              <a href="https://medomics-udes.gitbook.io/medomicslab-docs/medomicslab-docs-v0/tutorials" 
                 target="_blank" rel="noopener noreferrer" style={{ color: "#0056b3", textDecoration: "none", marginLeft: "5px" }}>
                MEDomicsLab Documentation
              </a>
            </li>

            <li>🎥 Module Tutorials:  
              <a href="https://www.youtube.com/playlist?list=PLEPy2VhC4-D6B7o0MuNNEz2DeHDR8NICj" 
                 target="_blank" rel="noopener noreferrer" style={{ color: "#0056b3", textDecoration: "none", marginLeft: "5px" }}>
                YouTube Module Guides
              </a>
            </li>

            <li>🎥 Testing Phase Tutorials:  
              <a href="https://www.youtube.com/playlist?list=PLEPy2VhC4-D4vuJO3X7fHboLv1k_HbGsW" 
                 target="_blank" rel="noopener noreferrer" style={{ color: "#0056b3", textDecoration: "none", marginLeft: "5px" }}>
                YouTube Playlist
              </a>
            </li>

            </ul>

          {/* Warning section */}
          <div 
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#ffeeba",
            borderLeft: "4px solid #ffc107",
            borderRadius: "5px"
          }}
        >
          ⚠️ <strong>Note:</strong> The Testing Phase offers the first official tutorials of MEDomicsLab, based on the pre-released version launched in January 2024. Despite subsequent improvements, these tutorials are still a valuable starting point for new users.
        </div>

        </div>
      </Stack>

      {!requirementsMet && process.platform !== "darwin" && (
        <FirstSetupModal visible={!requirementsMet} closable={false} setRequirementsMet={setRequirementsMet} />
      )}
    </div>
  );
};

export default HomePage;
