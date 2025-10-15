import { MultiSelect } from "primereact/multiselect";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { getCollectionTags } from "../../mongoDB/mongoDBUtils";
import { DataContext } from "../../workspace/dataContext";

/**
 * @typedef {React.FunctionComponent} WsSelectMultiple
 * @description Select multiple data files from the workspace (DataContext).
 * @param {Array}  selectedPaths - selected items (array of {id|key,name,...}) — always pass an array
 * @param {Function} onChange    - callback (vals: any[]) => void
 * @param {Array}  rootDir       - e.g. ["learning","holdout"]; if omitted: scan all
 * @param {Boolean} acceptFolder - allow directories to appear
 * @param {Array}  acceptedExtensions - [] or ["all"] means no filter. Otherwise match by extension/type.
 * @param {RegExp|null} matchRegex - optional name filter
 * @param {Boolean} disabled
 * @param {String}  placeholder
 * @param {React.ReactNode} whenEmpty - optional non-blocking message (shown under the field)
 * @param {Function|null} setHasWarning - optional ({state,tooltip}) => void
 * @param {Object} customProps - forwarded style/props to MultiSelect
 */
const WsSelectMultiple = ({
  key,
  selectedPaths,
  onChange,
  rootDir,
  acceptFolder = false,
  acceptedExtensions = [],              // [] => no filter
  matchRegex = null,
  disabled,
  placeholder,
  whenEmpty = null,                     // non-blocking (we show it BELOW the field)
  setHasWarning = null,
  customProps = {}
}) => {
  const { globalData } = useContext(DataContext);
  const [datasetList, setDatasetList] = useState([]);

  // ---- Safe warning function (never crashes) ----
  const safeSetHasWarning = useMemo(
    () => (typeof setHasWarning === "function" ? setHasWarning : () => {}),
    [setHasWarning]
  );

  // ---- Helpers ----
  const hasNoExtFilter =
    !acceptedExtensions || acceptedExtensions.length === 0 || acceptedExtensions.includes("all");

  const isAcceptedByExtOrType = (node) => {
    if (hasNoExtFilter) return true;
    // some nodes may have "type", others an "extension"
    const ext = node.extension || node.type;
    return acceptedExtensions.includes(ext);
  };

  const isInRootDir = (id) => {
    if (!rootDir || rootDir.length === 0) return true; // scan all
    const parent = globalData?.[globalData?.[id]?.parentID];
    if (!parent) return false;
    const parentName = parent.name || parent.originalName;
    return rootDir.includes(parentName);
  };

  const nameMatches = (name) => (!matchRegex ? true : matchRegex.test(name));

  // ---- Build list from DataContext ----
  useEffect(() => {
    const processData = async () => {
      if (!globalData) return;

      const ids = Object.keys(globalData);
      const items = await Promise.all(
        ids.map(async (id) => {
          const node = globalData[id];
          if (!node) return null;

          // Filter by root
          if (!isInRootDir(id)) return null;

          // Exclude folders if not allowed
          if (!acceptFolder && node.type === "directory") return null;

          // Filter by extension/type
          if (!isAcceptedByExtOrType(node)) return null;

          // Filter by name regex
          if (!nameMatches(node.name)) return null;

          // Build tags info
          let columnsTags = {};
          let tags = [];
          try {
            let tagsCollections = await getCollectionTags(id);
            tagsCollections = await tagsCollections.toArray();
            tagsCollections.forEach((tagCollection) => {
              let col = tagCollection.column_name;
              if (col && col.includes("_|_")) col = col.split("_|_")[1];
              columnsTags[col] = tagCollection.tags;
              tags = tags.concat(tagCollection.tags || []);
            });
          } catch {
            // ignore tag errors; keep item without tags
          }
          tags = [...new Set(tags)];

          return {
            key: id,
            id,
            name: node.name,
            tags,
            columnsTags
          };
        })
      );

      const list = items.filter(Boolean);
      setDatasetList(list);

      // Non-blocking warning
      if (list.length === 0) {
        safeSetHasWarning({ state: true, tooltip: "No data file found in the workspace" });
      } else {
        safeSetHasWarning({ state: false });
      }
    };

    processData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalData, JSON.stringify(rootDir), acceptFolder, hasNoExtFilter, matchRegex?.toString()]);

  // ---- Controlled value: normalize selection structure ----
  const safeValue = Array.isArray(selectedPaths)
    ? selectedPaths.map((it) => ({
        ...it,
        key: it.key || it.id
      }))
    : [];

  // ---- Change handler ----
  const handleChange = (e) => {
    const vals = Array.isArray(e?.value) ? e.value : [];
    // soft warnings on empty selection
    safeSetHasWarning(
      vals.length === 0
        ? { state: true, tooltip: "No file(s) selected" }
        : { state: false }
    );
    onChange?.(vals);
  };

  return (
    <>
      {/* Always render the field, even when empty (non-blocking UI) */}
      
      <MultiSelect
        key={key}
        disabled={disabled}
        placeholder={placeholder}
        value={safeValue}
        onChange={handleChange}
        options={datasetList}
        optionLabel="name"
        display="chip"
        style={customProps}
        filter
      />

      {/* Optional non-blocking empty message */}
      {datasetList.length === 0 && whenEmpty}
    </>
  );
};

export default WsSelectMultiple;
