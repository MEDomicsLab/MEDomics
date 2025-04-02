import { Dropdown } from "primereact/dropdown";
import React, { useContext, useEffect, useState } from "react";
import FloatingLabel, { Button, Stack } from "react-bootstrap";
import * as Icon from "react-bootstrap-icons";
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext";
import Node from "../../flow/node";
import Input from "../input";
import ModalSettingsChooser from "../modalSettingsChooser";

const SplitNode = ({ id, data }) => {
  const [modalShow, setModalShow] = useState(false);
  const { updateNode } = useContext(FlowFunctionsContext);
  const [splitType, setSplitType] = useState({name: data.internal.settings.split_type || "random_sub_sampling"});

  // To track options specific to the selected split type
  const [splitOptions, setSplitOptions] = useState([]);

  // Update available options when split type changes
  useEffect(() => {
    updateSplitOptions();
  }, [data.internal.settings.split_type]);

  // Function to update options based on split type
  const updateSplitOptions = () => {
    const type = data.internal.settings.split_type;
    let options = [];

    // Add options specific to the split type
    if (type && type in data.setupParam.possibleSettings.options) {
      options.push(type);
    }

    // Add stratification for Random Sub-Sampling and Cross-Validation
    if (type === "random_sub_sampling" || type === "cross_validation") {
      options.push("stratification");
    }

    setSplitOptions(options);

    // Update checked options in node data
    data.internal.checkedOptions = options;
    updateNode({
      id: id,
      updatedData: data.internal,
    });
  };

  // Handler for input changes
  const onInputChange = (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value;
    updateNode({
      id: id,
      updatedData: data.internal,
    });
  };

  // Handler for warnings
  const handleWarning = (hasWarning) => {
    data.internal.hasWarning = hasWarning;
    updateNode({
      id: id,
      updatedData: data.internal,
    });
  };

  // Render Cross-Validation options (Inner and Outer)
  const renderCrossValidationOptions = () => {
    if (data.internal.settings.split_type !== "cross_validation") return null;

    return (
      <>
        <h6 className="mt-3 mb-2">Outer CV</h6>
        <Input
          setHasWarning={handleWarning}
          name="num_outer_folds"
          settingInfos={data.setupParam.possibleSettings.options.cross_validation.outer_cv.num_outer_folds}
          currentValue={data.internal.settings.num_outer_folds || data.setupParam.possibleSettings.options.cross_validation.outer_cv.num_outer_folds.default_val}
          onInputChange={onInputChange}
        />
        <Input
          setHasWarning={handleWarning}
          name="type_outer_cv"
          settingInfos={data.setupParam.possibleSettings.options.cross_validation.outer_cv.type_outer_cv}
          currentValue={data.internal.settings.type_outer_cv || data.setupParam.possibleSettings.options.cross_validation.outer_cv.type_outer_cv.default_val}
          onInputChange={onInputChange}
        />

        <h6 className="mt-3 mb-2">Inner CV</h6>
        <Input
          setHasWarning={handleWarning}
          name="num_inner_folds"
          settingInfos={data.setupParam.possibleSettings.options.cross_validation.inner_cv.num_inner_folds}
          currentValue={data.internal.settings.num_inner_folds || data.setupParam.possibleSettings.options.cross_validation.inner_cv.num_inner_folds.default_val}
          onInputChange={onInputChange}
        />
        <Input
          setHasWarning={handleWarning}
          name="type_inner_cv"
          settingInfos={data.setupParam.possibleSettings.options.cross_validation.inner_cv.type_inner_cv}
          currentValue={data.internal.settings.type_inner_cv || data.setupParam.possibleSettings.options.cross_validation.inner_cv.type_inner_cv.default_val}
          onInputChange={onInputChange}
        />
      </>
    );
  };

  return (
    <>
      <Node
  key={id}
  id={id}
  data={data}
  setupParam={data.setupParam}
  nodeLink="/documentation/split"

  // --- Couche 1 : Split Type + paramètres généraux ---
  defaultSettings={
    <>
      {data.setupParam?.possibleSettings && "default" in data.setupParam.possibleSettings && (
        <>
          <h6 className="mb-2">General parameters</h6>
          <Dropdown
            className="form-select"
            value={splitType}
            onChange={(e) => { 
              setSplitType(e.value);
              data.internal.settings.split_type = e.value.name;
              updateNode({
                id: id,
                updatedData: data.internal,
              });
              updateSplitOptions();
            }}
            options={Object.entries(data.setupParam?.possibleSettings.default.split_type.choices).map(([option]) => {
              return { name: option }
            })}
            optionLabel="name"
          />

          <Stack direction="vertical" gap={1} className="mt-2">
            {Object.entries(data.setupParam.possibleSettings.default).map(
              ([settingName, setting]) => {
                if (settingName === "split_type") return null; 
                const formattedSettingName = settingName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                return (
                  <Input
                    setHasWarning={handleWarning}
                    key={settingName}
                    name={formattedSettingName}
                    settingInfos={setting}
                    currentValue={data.internal.settings[settingName]}
                    onInputChange={onInputChange}
                  />
                );
              }
            )}
          </Stack>
        </>
      )}
    </>
  }

  // --- Couche 2 : Paramètres spécifiques à la méthode choisie ---
  nodeSpecific={
    <>
      <h6 className="mt-4 mb-2">Parameters for <i>{splitType.name}</i> method</h6>

      {/* Bouton modal */}
      <Button variant="light" className="width-100 btn-contour" onClick={() => setModalShow(true)}>
        <Icon.Plus width="30px" height="30px" className="img-fluid" />
      </Button>

      {data.setupParam?.possibleSettings?.options && (
        <ModalSettingsChooser
          show={modalShow}
          onHide={() => setModalShow(false)}
          options={data.setupParam.possibleSettings.options}
          data={data}
          id={id}
        />
      )}

      {/* Options spécifiques */}
      {splitOptions.map((optionType) => {
        if (optionType === "cross_validation") {
          return renderCrossValidationOptions();
        }

        return Object.entries(data.setupParam.possibleSettings.options[optionType]).map(
          ([settingName, setting]) => {
            if (typeof setting === "object" && !("type" in setting)) return null;
            const formattedSettingName = settingName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
            return (
              <Input
                key={`${optionType}-${settingName}`}
                name={formattedSettingName}
                settingInfos={setting}
                currentValue={data.internal.settings[settingName]}
                onInputChange={onInputChange}
              />
            );
          }
        );
      })}
    </>
  }
/>

    </>
  );
};

export default SplitNode;