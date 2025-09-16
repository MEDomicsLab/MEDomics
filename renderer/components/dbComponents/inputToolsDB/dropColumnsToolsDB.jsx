/* eslint-disable no-unused-vars */
import React, { useContext, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { MultiSelect } from "primereact/multiselect";
import { InputText } from "primereact/inputtext";
import { toast } from "react-toastify";
import { confirmDialog } from "primereact/confirmdialog";

import { v4 as uuidv4 } from "uuid";
import { requestBackend } from "../../../utilities/requests";
import { getCollectionColumns, getCollectionTags } from "../../mongoDB/mongoDBUtils";
import { insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils";
import { ServerConnectionContext } from "../../serverConnection/connectionContext";
import { DataContext } from "../../workspace/dataContext";
import { MEDDataObject } from "../../workspace/NewMedDataObject";

/**
 * Delete Columns or Tags Tools
 *
 * - Fetches columns of the selected dataset.
 * - Fetches existing tags directly via getCollectionTags(collectionId).
 * - Lets user select columns and/or tags to delete.
 * - Can overwrite current dataset or create a new one (no overlay).
 */
const DropColumnsAndTagsToolsDB = ({ currentCollection }) => {
  const { port } = useContext(ServerConnectionContext);
  const { globalData } = useContext(DataContext);

  // UI state
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Data
  const [allColumns, setAllColumns] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [taggedColumnsMap, setTaggedColumnsMap] = useState({}); // { tag: [cols...] }

  // Selections
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  // New dataset name (for "Create new dataset")
  const [newDatasetName, setNewDatasetName] = useState("");

  // Basics
  const collectionId = globalData[currentCollection]?.id;
  const collectionName = globalData[currentCollection]?.name;
  const parentID = globalData[currentCollection]?.parentID;

  // Helper to check if a dataset name already exists
  const checkExistsByName = (fullNameWithExt) => {
    for (const key of Object.keys(globalData)) {
      if (globalData[key]?.name === fullNameWithExt) return true;
    }
    return false;
  };

  // Build a flat list of columns that will be removed due to selected tags
  const columnsFromSelectedTags = [
    ...new Set(selectedTags.flatMap((t) => taggedColumnsMap[t] || [])),
  ];
  const totalColsViaTags = columnsFromSelectedTags.length;

  // Fetch columns + tags
  useEffect(() => {
    const fetchMeta = async () => {
      if (!currentCollection) return;
      try {
        setLoadingFetch(true);

        // 1) Columns
        const cols = await getCollectionColumns(currentCollection);
        setAllColumns(Array.isArray(cols) ? cols : []);

        // 2) Tags (via utils)
        if (!collectionId) {
          setAllTags([]);
          setTaggedColumnsMap({});
          setLoadingFetch(false);
          return;
        }

        const cursorOrArray = await getCollectionTags(collectionId);
        const docs = Array.isArray(cursorOrArray)
          ? cursorOrArray
          : (await cursorOrArray?.toArray?.()) || [];

        const tagMap = {};
        for (const d of docs) {
          const col = d?.column_name;
          const tlist = Array.isArray(d?.tags) ? d.tags : [];
          for (const t of tlist) {
            if (!tagMap[t]) tagMap[t] = new Set();
            if (col) tagMap[t].add(col);
          }
        }
        const tags = Object.keys(tagMap).sort();
        const taggedColumns = Object.fromEntries(
          Object.entries(tagMap).map(([t, set]) => [t, Array.from(set).sort()])
        );

        setAllTags(tags);
        setTaggedColumnsMap(taggedColumns);
        setLoadingFetch(false);
      } catch (e) {
        console.error(e);
        toast.error("Error fetching columns or tags.");
        setAllColumns([]);
        setAllTags([]);
        setTaggedColumnsMap({});
        setLoadingFetch(false);
      }
    };

    fetchMeta();
  }, [currentCollection, collectionId, port, globalData]);

  // Overwrite or create-new action
  const runDeletion = async (overwrite) => {
    if (!collectionId) {
      toast.error("No collection selected.");
      return;
    }
    if (selectedColumns.length === 0 && selectedTags.length === 0) {
      toast.warn("Select at least one column or one tag to delete.");
      return;
    }

    let outId = collectionId;
    let outName = collectionName;

    if (!overwrite) {
      if (!newDatasetName) {
        toast.warn("Please provide a name for the new dataset.");
        return;
      }
      const newNameWithExt = `${newDatasetName}.csv`;
      const exists = checkExistsByName(newNameWithExt);
      if (exists) {
        const ok = await new Promise((resolve) => {
          confirmDialog({
            closable: false,
            message: `A dataset named "${newNameWithExt}" already exists. Overwrite that name?`,
            header: "Confirmation",
            icon: "pi pi-exclamation-triangle",
            accept: () => resolve(true),
            reject: () => resolve(false),
          });
        });
        if (!ok) return;
      }
      outId = uuidv4();
      outName = `${newDatasetName}.csv`;
    }

    const payload = {
      collectionName: collectionId,
      newDatasetName: outId,
      overwrite,
      dropColumns: selectedColumns,
      dropTags: selectedTags,
    };

    setLoadingAction(true);
    requestBackend(
      port,
      "/input/drop_columns_tags/",
      payload,
      async (jsonResponse) => {
        setLoadingAction(false);

        if (jsonResponse?.error) {
          const msg = jsonResponse.error?.message || jsonResponse.error;
          console.error(msg);
          toast.error(msg || "Error while applying changes.");
          return;
        }

        // Register new dataset if we created one
        if (!overwrite) {
          const obj = new MEDDataObject({
            id: outId,
            name: outName,
            type: "csv",
            parentID,
            childrenIDs: [],
            inWorkspace: false,
          });
          await insertMEDDataObjectIfNotExists(obj);
          MEDDataObject.updateWorkspaceDataObject();
        }

        toast.success("Columns/Tags updated successfully.");
        setSelectedColumns([]);
        setSelectedTags([]);
        // If overwritten, refresh columns/tags to reflect changes
        if (overwrite) {
          try {
            setLoadingFetch(true);
            const cols = await getCollectionColumns(currentCollection);
            setAllColumns(Array.isArray(cols) ? cols : []);
          } finally {
            setLoadingFetch(false);
          }
        }
      },
      (error) => {
        setLoadingAction(false);
        console.error(error);
        toast.error("Server error while applying changes.");
      }
    );
  };

  // Button disabled states
  const nothingSelected = selectedColumns.length === 0 && selectedTags.length === 0;
  const disableOverwriteBtn = nothingSelected || loadingAction;
  const disableCreateNewBtn = nothingSelected || !newDatasetName || loadingAction;

  // Styles (lighter gray panels)
  const panelStyle = {
    display: "flex",
    flexDirection: "column",
    border: "1px solid #d5d7db",
    borderRadius: 6,
    backgroundColor: "#f3f4f6", // lighter gray
    padding: 12,
    gap: 10,
    marginTop: 16,
  };

  return (
    <div>
      <Message
        text="Select multiple columns and/or tags, then apply deletion by overwriting the dataset or by creating a cleaned copy."
        severity="info"
        className="mb-3"
      />
      <Message
        style={{ marginTop: 10 }}
        severity="success"
        text={`Current Collection: ${collectionName || ""}`}
      />

      {/* Columns */}
      <div style={panelStyle}>
        <b>Columns</b>
        <MultiSelect
          value={selectedColumns}
          options={allColumns.map((c) => ({ label: c, value: c }))}
          onChange={(e) => setSelectedColumns(e.value)}
          placeholder={loadingFetch ? "Loading columns..." : "Select columns"}
          display="chip"
          filter
          style={{ width: "100%" }}
        />
        <Message
          severity={selectedColumns.length === 0 ? "warn" : "success"}
          text={
            selectedColumns.length === 0
              ? "No columns selected."
              : `Selected columns: ${selectedColumns.join(", ")}`
          }
        />
      </div>

      {/* Tags */}
      <div style={panelStyle}>
        <b>Tags</b>
        <MultiSelect
          value={selectedTags}
          options={allTags.map((t) => ({ label: t, value: t }))}
          onChange={(e) => setSelectedTags(e.value)}
          placeholder={loadingFetch ? "Loading tags..." : "Select tags"}
          display="chip"
          filter
          style={{ width: "100%" }}
        />

        {/* Warning if no tag selected */}
        {selectedTags.length === 0 && (
          <Message severity="warn" style={{ marginTop: 10 }} text="No tag selected." />
        )}

        {/* For each selected tag, show its columns */}
        {selectedTags.map((t) => (
          <Message
            key={t}
            severity="info"
            text={`Tag "${t}" on columns: ${(taggedColumnsMap[t] || []).join(", ") || "—"}`}
            style={{ marginTop: 6 }}
          />
        ))}

        {/* Global warning: deleting tags removes ALL their columns */}
        {selectedTags.length > 0 && (
          <Message
            severity="warn"
            style={{ marginTop: 10 }}
            text={`Deleting selected tags will also delete all their columns (${totalColsViaTags} in total).`}
          />
        )}
      </div>

      {/* Actions */}
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Message
          severity="info"
          text="Apply changes to the current dataset or create a new cleaned copy."
        />
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
        {/* New dataset name (required only for create-new) */}
        <div
          className="p-inputgroup w-full md:w-30rem"
          style={{ margin: 5, fontSize: "1rem", width: 260, marginTop: 12 }}
        >
          <InputText
            value={newDatasetName}
            onChange={(e) => setNewDatasetName(e.target.value)}
            placeholder="New dataset name"
          />
          <span className="p-inputgroup-addon">.csv</span>
        </div>

        {/* Overwrite dataset */}
        <Button
          icon="pi pi-trash"
          label="Overwrite dataset"
          className="p-button-danger"
          style={{ margin: 5, fontSize: "1rem", padding: "6px 10px", height: 48, marginTop: 12 }}
          loading={loadingAction}
          disabled={disableOverwriteBtn}
          onClick={() => runDeletion(true)}
          tooltip="Apply changes on the current dataset"
          tooltipOptions={{ position: "top" }}
        />

        {/* Create new dataset (no overlay) */}
        <Button
          icon="pi pi-plus"
          label="Create new dataset"
          style={{ margin: 5, fontSize: "1rem", padding: "6px 10px", height: 48, marginTop: 12 }}
          loading={loadingAction}
          disabled={disableCreateNewBtn}
          onClick={() => runDeletion(false)}
          tooltip="Create a new dataset with the selected changes"
          tooltipOptions={{ position: "top" }}
        />
      </div>
    </div>
  );
};

export default DropColumnsAndTagsToolsDB;
