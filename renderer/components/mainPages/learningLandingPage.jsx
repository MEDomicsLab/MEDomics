import { randomUUID } from "crypto";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useContext, useEffect, useState } from "react";
import { Card, Stack } from "react-bootstrap";
import { AiOutlineExperiment } from "react-icons/ai";
import { LuBrainCircuit } from "react-icons/lu";
import { toast } from "react-toastify";
import { sceneDescription as learningSceneDescription } from "../../public/setupVariables/learningNodesParams";
import { LayoutModelContext } from "../layout/layoutContext";
import { getCollectionData } from "../dbComponents/utils";
import { insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils";
import { DataContext } from "../workspace/dataContext";
import { MEDDataObject } from "../workspace/NewMedDataObject";
import { FaPlay } from "react-icons/fa";
import ModuleLandingShell, { ModuleGuideSteps, ModuleGuideText } from "./moduleBasics/ModuleLandingShell";


const buildOpenItem = (id, medObject) => ({
  index: id,
  canMove: true,
  isFolder: false,
  children: medObject.childrenIDs || [],
  data: medObject.name,
  canRename: true,
  type: medObject.type || "medml",
  inWorkspace: medObject.inWorkspace ?? false,
  path: medObject.path ?? null,
  isLocked: medObject.isLocked ?? null,
  usedIn: medObject.usedIn ?? null,
});

const BRAND_NAVY = "rgb(88, 131, 196)";
const BRAND_BLUE = "rgb(171, 223, 147)";

const JOURNEY_STEPS = [
  { id: 1, label: "Readiness check", detail: "Ensure your data is ready for training using other modules" },
  { id: 2, label: "Name your experiment", detail: "Pick a clear, unique scene name" },
  { id: 3, label: "Build visually", detail: "Drag, drop, and connect nodes, no coding required" },
];

export default function LearningLandingPage() {
  const [nameExt, setNameExp] = useState("");
  const [nameML, setNameML] = useState("");
  const [nameExpError, setNameExpError] = useState("");
  const [nameMlError, setNameMLError] = useState("");
  const [isExtDisabled, setIsExtDisabled] = useState(true);
  const [isMLDisabled, setIsMLDisabled] = useState(true);
  const [experimentList, setExperimentList] = useState([]);
  const [loadingExt, setLoadingExp] = useState(false);
  const [loadingML, setLoadingML] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState(null);
  const [scenesExpanded, setScenesExpanded] = useState(false);
  const { dispatchLayout, setLayoutRequestQueue } = useContext(LayoutModelContext);
  const { globalData } = useContext(DataContext);

  useEffect(() => {
    let cancelled = false;

    const loadExperiments = async () => {
      const scenes = [];

      for (const id of Object.keys(globalData)) {
        const medObject = globalData[id];
        if (medObject.type !== "medml") continue;

        let isExperiment = false;
        const metadataId = MEDDataObject.getChildIDWithName(globalData, id, "metadata.json");
        if (metadataId) {
          try {
            const jsonContent = await getCollectionData(metadataId);
            if (jsonContent?.[0]?.isExperiment !== undefined) {
              isExperiment = !!jsonContent[0].isExperiment;
            }
          } catch {
            // Default to main scene when metadata cannot be read.
          }
        }

        scenes.push({
          id,
          name: medObject.name.replace(/\.medml$/i, ""),
          displayName: medObject.name,
          isExperiment,
          openItem: buildOpenItem(id, medObject),
        });
      }

      scenes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

      if (!cancelled) {
        setExperimentList(scenes);
      }
    };

    loadExperiments();
    return () => {
      cancelled = true;
    };
  }, [globalData]);

  useEffect(() => {
    if (!pendingOpenId || !globalData[pendingOpenId]) return;

    setLoadingExp(false);
    setLoadingML(false);

    const medObject = globalData[pendingOpenId];
    const openItem = buildOpenItem(pendingOpenId, medObject);
    const type = openItem.type === "medml" ? "openInLearningModule" : null;
    if (type === null) {
      toast.error("We couldn't open this file type. Please contact support if this persists.");
      return;
    }
    dispatchLayout({ type: type, payload: openItem });
    if (setLayoutRequestQueue) {
      setLayoutRequestQueue((prev) => [...prev, { type: "DELETE_TAB", payload: { id: "learningLandingPage" } }]);
    } else {
      dispatchLayout({ type: "remove", payload: { name: "Learning Module" } });
    }

    setPendingOpenId(null);
  }, [dispatchLayout, globalData, pendingOpenId, setLayoutRequestQueue]);

  const createSceneContent = async (sceneName, isExperiment) => {
    const setLoading = isExperiment ? setLoadingExp : setLoadingML;
    setLoading(true);
    const trimmedSceneName = sceneName.trim();

    const sceneId = randomUUID();

    let sceneFolder = new MEDDataObject({
      id: randomUUID(),
      name: trimmedSceneName,
      type: "directory",
      parentID: "EXPERIMENTS",
      childrenIDs: [],
      inWorkspace: false
    })
    let sceneFolderId = await insertMEDDataObjectIfNotExists(sceneFolder)

    if (!isExperiment) {
      for (const folder of learningSceneDescription.externalFolders) {
        let medObject = new MEDDataObject({
          id: randomUUID(),
          name: folder,
          type: "directory",
          parentID: sceneFolderId,
          childrenIDs: [],
          inWorkspace: false
        })
        await insertMEDDataObjectIfNotExists(medObject)
      }
    }

    let sceneObject = new MEDDataObject({
      id: randomUUID(),
      name: trimmedSceneName + ".medml",
      type: "medml",
      parentID: sceneFolderId,
      childrenIDs: [],
      inWorkspace: false
    })
    let sceneObjectId = await insertMEDDataObjectIfNotExists(sceneObject)

    const emptyScene = [
      {
        nodes: [],
        edges: [],
        viewport: {
          x: 235.01823373389306,
          y: 186.91830088750686,
          zoom: 1.0,
        },
        MLType: "classification",
        intersections: [],
        isExperiment: isExperiment,
      },
    ];
    let metadataObject = new MEDDataObject({
      id: randomUUID(),
      name: "metadata.json",
      type: "json",
      parentID: sceneObjectId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(metadataObject, null, emptyScene)

    let backendMetadataObject = new MEDDataObject({
      id: randomUUID(),
      name: "backend_metadata.json",
      type: "json",
      parentID: sceneObjectId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(backendMetadataObject, null, emptyScene)

    for (const folder of learningSceneDescription.internalFolders) {
      let medObject = new MEDDataObject({
        id: randomUUID(),
        name: folder,
        type: "directory",
        parentID: sceneObjectId,
        childrenIDs: [],
        inWorkspace: false
      })
      await insertMEDDataObjectIfNotExists(medObject)
    }

    MEDDataObject.updateWorkspaceDataObject();
    setPendingOpenId(sceneObjectId || sceneId);
  };

  const validateName = (value, existingList, extension) => {
    const trimmedName = value.trim();
    const isValidName = /^[A-Za-z0-9_-]+$/.test(trimmedName);
    const existingNames = new Set(existingList);
    const hasConflict =
      trimmedName !== "" && (existingNames.has(trimmedName) || existingNames.has(`${trimmedName}.${extension}`));

    if (trimmedName === "") return { error: "", disabled: true };
    if (!isValidName) {
      return { error: "Use only letters, numbers, hyphens, or underscores.", disabled: true };
    }
    if (hasConflict) {
      return { error: "An experiment with this name already exists. Try a different name.", disabled: true };
    }
    return { error: "", disabled: false };
  };

  const experimentNames = experimentList.map((scene) => scene.displayName);

  const handleOpenScene = (item) => {
    dispatchLayout({ type: "openInLearningModule", payload: item });
    if (setLayoutRequestQueue) {
      setLayoutRequestQueue((prev) => [...prev, { type: "DELETE_TAB", payload: { id: "learningLandingPage" } }]);
    } else {
      dispatchLayout({ type: "remove", payload: { name: "Learning Module" } });
    }
  };

  const onNameExpChange = (e) => {
    setNameExp(e);
    const { error, disabled } = validateName(e, experimentNames, "medml");
    setNameExpError(error);
    setIsExtDisabled(loadingExt || disabled);
  };

  const onNameMLChange = (e) => {
    setNameML(e);
    const { error, disabled } = validateName(e, experimentNames, "medml");
    setNameMLError(error);
    setIsMLDisabled(loadingML || disabled);
  };

  const totalExperiments =  experimentList.length;
  const isCreating = loadingExt || loadingML;

  const workspaceFooter = totalExperiments === 0 ? (
    <div className="module-landing-empty-state">
      <p className="mb-1 fw-semibold">No experiments yet</p>
      <p className="mb-0">
        Name your first scene above and click <strong>Create & open</strong> to launch the visual builder.
      </p>
    </div>
  ) : (
    <section aria-label="Workspace ML scenes">
      <button
        type="button"
        className="module-landing-scenes-toggle"
        onClick={() => setScenesExpanded((prev) => !prev)}
        aria-expanded={scenesExpanded}
        aria-controls="workspace-scenes-grid"
      >
        <span>
          {totalExperiments} scene{totalExperiments !== 1 ? "s" : ""} in workspace
        </span>
        <i className={`pi ${scenesExpanded ? "pi-chevron-up" : "pi-chevron-down"}`} aria-hidden="true" />
      </button>

      {scenesExpanded && (
        <div id="workspace-scenes-grid" className="module-landing-scenes-grid">
          {experimentList.map((scene) => {
            const accentColor = scene.isExperiment ? "#8db8ec" : "#54ebeb";

            return (
              <button
                key={scene.id}
                type="button"
                className="module-landing-scene-card"
                onClick={() => handleOpenScene(scene.openItem)}
                title={`${scene.name} (${scene.isExperiment ? "Experimental" : "Main"})`}
                aria-label={`Open ${scene.name} ${scene.isExperiment ? "experimental" : "main"} scene`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "";
                }}
              >
                {scene.isExperiment ? (
                  <LuBrainCircuit size={25} color="#0D6EFD" aria-hidden="true" />
                ) : (
                  <AiOutlineExperiment size={25} color={BRAND_NAVY} aria-hidden="true" />
                )}
                <span className="module-landing-scene-name">{scene.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <ModuleLandingShell
      title="Learning Module"
      description="Design, train, and compare clinical ML models with visual PyCaret-powered workflows."
      contentMaxWidth="960px"
      documentation={{
        url: "https://medomicslab.gitbook.io/medomics-docs/tutorials/development/learning-module",
        label: "Learning Module documentation",
      }}
      infoContent={
        <>
          <ModuleGuideSteps steps={JOURNEY_STEPS} />
          <ModuleGuideText>
            <p className="mt-3 mb-0 d-flex align-items-start justify-content-center gap-2 text-start">
              <FaPlay className="flex-shrink-0 mt-1" size={14} color={BRAND_BLUE} aria-hidden="true" />
              <span>
                Start with an <strong>Experimental Scene</strong> to compare models quickly. When you&apos;re ready,
                open a <strong>Main Scene</strong> for your full training pipeline.
              </span>
            </p>
          </ModuleGuideText>
        </>
      }
      footer={workspaceFooter}
    >
          <Stack
            direction="horizontal"
            gap={4}
            className="flex-wrap align-items-stretch justify-content-center module-landing-tool-grid w-100"
          >
            {/* Experimental Scene */}
            <Card
              className="shadow-sm flex-fill module-landing-tool-card"
              style={{
                flex: "1 1 340px",
                minWidth: "300px",
                maxWidth: "440px",
                border: `2px solid ${BRAND_NAVY}`,
                borderRadius: "12px",
                overflow: "hidden",
              }}
              aria-labelledby="experimental-scene-title"
            >
              <Card.Header
                className="text-white d-flex align-items-center justify-content-between py-3"
                style={{ backgroundColor: BRAND_NAVY }}
              >
                <div className="d-flex align-items-center gap-2">
                  <AiOutlineExperiment size={22} aria-hidden="true" color="white" />
                  <h2 id="experimental-scene-title" className="text-white mb-0 h5">
                    Experimental Scene
                  </h2>
                </div>
              </Card.Header>
              <Card.Body className="d-flex flex-column p-4">
                <p className="text-muted text-center mb-1" style={{ fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.04em" }}>
                  STEP 1 · MODEL EXPLORATION
                </p>
                <Card.Text className="text-center mb-4" style={{ lineHeight: 1.55 }}>
                  Compare algorithms side-by-side on your dataset before running a full experiment.
                </Card.Text>

                <div className="text-center mb-3">
                  <AiOutlineExperiment size={56} color={BRAND_NAVY} aria-hidden="true" />
                </div>

                <label htmlFor="experimental-scene-name" className="form-label fw-semibold mb-1" style={{ fontSize: "0.9rem" }}>
                  Experiment name
                </label>
                <div className="p-inputgroup mb-1">
                  <InputText
                    id="experimental-scene-name"
                    placeholder="e.g. lung_cancer_screening_v1"
                    value={nameExt}
                    onChange={(e) => onNameExpChange(e.target.value)}
                    aria-invalid={!!nameExpError}
                    aria-describedby={nameExpError ? "experimental-scene-error" : "experimental-scene-hint"}
                    disabled={isCreating}
                  />
                  <span className="p-inputgroup-addon">.medml</span>
                </div>
                {!nameExpError && (
                  <small id="experimental-scene-hint" className="text-italic mb-3">
                    Letters, numbers, hyphens, and underscores only.
                  </small>
                )}
                {nameExpError && (
                  <div id="experimental-scene-error" className="text-danger small mb-3" role="alert">
                    {nameExpError}
                  </div>
                )}

                <div className="mt-auto pt-2">
                  <Button
                    className="w-100"
                    style={{ backgroundColor: BRAND_NAVY, borderColor: BRAND_NAVY }}
                    loading={loadingExt}
                    onClick={() => createSceneContent(nameExt, "medext")}
                    disabled={isExtDisabled || loadingML}
                    label={loadingExt ? "Creating scene..." : "Create & open scene"}
                    aria-label="Create and open experimental scene"
                  />
                </div>
              </Card.Body>
            </Card>

            {/* Main Scene */}
            <Card
              className="shadow-sm flex-fill module-landing-tool-card"
              style={{
                flex: "1 1 340px",
                minWidth: "300px",
                maxWidth: "440px",
                border: "1px solid #dee2e6",
                borderRadius: "12px",
                overflow: "hidden",
              }}
              aria-labelledby="main-scene-title"
            >
              <Card.Header className="bg-primary text-white d-flex align-items-center justify-content-between py-3">
                <div className="d-flex align-items-center gap-2">
                  <LuBrainCircuit size={22} aria-hidden="true" color="white" />
                  <h2 id="main-scene-title" className="text-white mb-0 h5">
                    Main Scene
                  </h2>
                </div>
              </Card.Header>
              <Card.Body className="d-flex flex-column p-4">
                <p className="text-muted text-center mb-1" style={{ fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.04em" }}>
                  STEP 2 · TRAIN & FINALIZE
                </p>
                <Card.Text className="text-center mb-4" style={{ lineHeight: 1.55 }}>
                  Set up your definitive ML workflow, then train, test, tune hyperparameters, and visualize results in one
                  visual canvas.
                </Card.Text>

                <div className="text-center mb-3">
                  <LuBrainCircuit size={56} color="#0D6EFD" aria-hidden="true" />
                </div>

                <label htmlFor="main-scene-name" className="form-label fw-semibold mb-1" style={{ fontSize: "0.9rem" }}>
                  Experiment name
                </label>
                <div className="p-inputgroup mb-1">
                  <InputText
                    id="main-scene-name"
                    placeholder="e.g. stroke_risk_final_model"
                    value={nameML}
                    onChange={(e) => onNameMLChange(e.target.value)}
                    aria-invalid={!!nameMlError}
                    aria-describedby={nameMlError ? "main-scene-error" : "main-scene-hint"}
                    disabled={isCreating}
                  />
                  <span className="p-inputgroup-addon">.medml</span>
                </div>
                {!nameMlError && (
                  <small id="main-scene-hint" className="text-italic mb-3">
                    Letters, numbers, hyphens, and underscores only.
                  </small>
                )}
                {nameMlError && (
                  <div id="main-scene-error" className="text-danger small mb-3" role="alert">
                    {nameMlError}
                  </div>
                )}

                <div className="mt-auto pt-2">
                  <Button
                    className="w-100"
                    loading={loadingML}
                    severity="info"
                    onClick={() => createSceneContent(nameML, "medml")}
                    disabled={isMLDisabled || loadingExt}
                    label={loadingML ? "Creating scene..." : "Create & open scene"}
                    aria-label="Create and open main learning scene"
                  />
                </div>
              </Card.Body>
            </Card>
          </Stack>
    </ModuleLandingShell>
  );
}
