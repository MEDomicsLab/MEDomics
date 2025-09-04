import { Card } from "primereact/card"
import { Carousel } from "primereact/carousel"
import { Dropdown } from "primereact/dropdown"
import { InputNumber } from "primereact/inputnumber"
import { InputSwitch } from "primereact/inputswitch"
import { InputText } from "primereact/inputtext"
import { RadioButton } from "primereact/radiobutton"
import { ipcRenderer } from "electron"
import { Button } from "primereact/button"
import React, { useEffect, useState } from "react"

/**
 *
 * @param {Json} columnsTypes types associated to the dataframe
 * @param {Function} setExtractionJsonData function setting data to send to the extraction_ts server
 * @param {Function} setMayProceed function setting the boolean variable mayProceed, telling if the process can be executed
 * @returns {JSX.Element} sub-component of the ExtractionTabularData component
 *
 * @description
 * This component is displayed in the ExtractionTabularData component when the user choose "BioBERT"
 * extraction type. It is used to prepare text notes extraction using BioBERT pre-trained model.
 *
 */
const ExtractionBioBERT = ({ columnsTypes, setExtractionJsonData, setMayProceed }) => {
  const [biobertPath, setBiobertPath] = useState("") // path to the BioBERT pretrained model
  const [columnPrefix, setColumnPrefix] = useState("notes") // column prefix to set in the generated dataframe from extracted features
  const [frequency, setFrequency] = useState("Note") // frequency choosen for the features generation
  const [hourRange, setHourRange] = useState(24) // hour range in which to generated the features if the frequency is "Hour"
  const [masterTableCompatible, setMasterTableCompatible] = useState(true) // boolean set to true if the extracted features dataset must respect the submaster table format
  const [selectedColumns, setSelectedColumns] = useState({
    // columns names for feature extraction matching a required type
    patientIdentifier: "",
    admissionIdentifier: "",
    admissionTime: "",
    notes: "",
    time: ""
  })

  // display options for the carousel
  const responsiveOptions = [
    {
      breakpoint: "1024px",
      numVisible: 1,
      numScroll: 1
    },
    {
      breakpoint: "768px",
      numVisible: 1,
      numScroll: 1
    },
    {
      breakpoint: "560px",
      numVisible: 1,
      numScroll: 1
    }
  ]

  /**
   *
   * @param {Carousel Item} item
   * @returns html content
   *
   * @description
   * Function used to format the carousel data
   */
  const carouselTemplate = (item) => {
    return <div className="centered-carousel-item">{item.content}</div>
  }

  /**
   *
   * @param {String} name
   *
   * @description
   * Called when the user change the column prefix.
   *
   */
  const handleColumnPrefixChange = (name) => {
    if (name.match("^[a-zA-Z0-9_]+$") != null) {
      setColumnPrefix(name)
    }
  }

  /**
   *
   * @param {string} column
   * @param {event} event
   *
   * @description
   * Function used to attribute column values from selectors
   *
   */
  const handleColumnSelect = (column, event) => {
    const { value } = event.target
    setSelectedColumns({
      ...selectedColumns,
      [column]: value
    })
  }

  /**
   * @description
   * Function used to set the BioBERT path
   */
  const handleSelectBiobertPath = () => {
    ipcRenderer
      .invoke("select-folder-path")
      .then((result) => {
        if (result.canceled) return
        const selectedFolderPath = result.filePaths[0]
        setBiobertPath(selectedFolderPath)
      })
      .catch((err) => console.error(err))
  }

  /**
   *
   * @description
   * This function checks if all the necessary attributes from
   * selected columns have a value and update allColumnsSelected.
   *
   */
  useEffect(() => {
    if (frequency == "Patient" && masterTableCompatible) {
      setMayProceed(biobertPath !== "" && selectedColumns.patientIdentifier !== "" && selectedColumns.notes !== "" && selectedColumns.time !== "")
      setExtractionJsonData({ biobertPath: biobertPath, selectedColumns: selectedColumns, columnPrefix: columnPrefix, frequency: frequency, masterTableCompatible: masterTableCompatible })
    } else if (frequency == "Patient") {
      setMayProceed(biobertPath !== "" && selectedColumns.patientIdentifier !== "" && selectedColumns.notes !== "")
      setExtractionJsonData({ biobertPath: biobertPath, selectedColumns: selectedColumns, columnPrefix: columnPrefix, frequency: frequency, masterTableCompatible: masterTableCompatible })
    } else if (frequency == "Admission") {
      setMayProceed(
        biobertPath !== "" && selectedColumns.patientIdentifier !== "" && selectedColumns.notes !== "" && selectedColumns.admissionIdentifier !== "" && selectedColumns.admissionTime !== ""
      )
      setExtractionJsonData({ biobertPath: biobertPath, selectedColumns: selectedColumns, columnPrefix: columnPrefix, frequency: frequency, masterTableCompatible: masterTableCompatible })
    } else if (frequency == "HourRange") {
      setMayProceed(biobertPath !== "" && selectedColumns.patientIdentifier !== "" && selectedColumns.notes !== "" && selectedColumns.time !== "")
      setExtractionJsonData({
        biobertPath: biobertPath,
        selectedColumns: selectedColumns,
        columnPrefix: columnPrefix,
        frequency: frequency,
        hourRange: hourRange,
        masterTableCompatible: masterTableCompatible
      })
    } else if (frequency == "Note" && masterTableCompatible) {
      setMayProceed(biobertPath !== "" && selectedColumns.patientIdentifier !== "" && selectedColumns.notes !== "" && selectedColumns.time !== "")
      setExtractionJsonData({ biobertPath: biobertPath, selectedColumns: selectedColumns, columnPrefix: columnPrefix, frequency: frequency, masterTableCompatible: masterTableCompatible })
    } else if (frequency == "Note") {
      setMayProceed(biobertPath !== "" && selectedColumns.patientIdentifier !== "" && selectedColumns.notes !== "")
      setExtractionJsonData({ biobertPath: biobertPath, selectedColumns: selectedColumns, columnPrefix: columnPrefix, frequency: frequency, masterTableCompatible: masterTableCompatible })
    }
  }, [selectedColumns, frequency, hourRange, masterTableCompatible, columnPrefix, biobertPath])

  // The options for extraction are displayed in a Carousel component
  const carouselItems = [
    {
      key: "1",
      content: (
        <div>
          {/* Time interval for generation of extracted features */}
          <b>Compute Features by : &nbsp;</b>
          <hr></hr>
          <div className="margin-top-15">
            <RadioButton
              inputId="note"
              name="frequency"
              value="Note"
              onChange={(e) => {
                setFrequency(e.value)
                setMasterTableCompatible(true)
              }}
              checked={frequency === "Note"}
            />
            <label htmlFor="note">&nbsp; Notes</label>
          </div>
          <div className="margin-top-15">
            <Card subTitle="MIMIC-HAIM specific">
              <div>
                <RadioButton inputId="patient" name="frequency" value="Patient" onChange={(e) => setFrequency(e.value)} checked={frequency === "Patient"} />
                <label htmlFor="patient">&nbsp; Patient</label>
              </div>
              <div className="margin-top-15">
                <RadioButton inputId="admission" name="frequency" value="Admission" onChange={(e) => setFrequency(e.value)} checked={frequency === "Admission"} />
                <label htmlFor="admission">&nbsp; Admission</label>
              </div>
              <div className="margin-top-15">
                <RadioButton inputId="hourRange" name="frequency" value="HourRange" onChange={(e) => setFrequency(e.value)} checked={frequency === "HourRange"} />
                <label htmlFor="hourRange">&nbsp; Hour Range &nbsp;</label>
                {frequency == "HourRange" && <InputNumber value={hourRange} onValueChange={(e) => setHourRange(e.value)} size={1} showButtons min={1} />}
              </div>
            </Card>
          </div>
          <div className="margin-top-30">
            <InputSwitch
              inputId="masterTableCompatible"
              checked={masterTableCompatible}
              onChange={(e) => setMasterTableCompatible(e.value)}
              tooltip="The master table format may contain less columns in order to enter the MEDprofiles' process."
            />
            <label htmlFor="masterTableCompatible">&nbsp; Master Table Compatible &nbsp;</label>
          </div>
        </div>
      )
    },
    {
      key: "2",
      content: (
        <div>
          {/* Dropdowns for column selection */}
          <b>Select columns corresponding to :</b>
          <hr></hr>
          <div className="margin-top-15">
            Patient Identifier : &nbsp;
            {columnsTypes && Object.keys(columnsTypes).length > 0 ? (
              <Dropdown
                value={selectedColumns.patientIdentifier}
                onChange={(event) => handleColumnSelect("patientIdentifier", event)}
                options={Object.entries(columnsTypes)
                  .filter(([, value]) => value.includes("integer") || value.includes("string"))
                  .map(([key]) => ({ label: key, value: key }))}
                placeholder="Patient Identifier"
              />
            ) : (
              <Dropdown placeholder="Patient Identifier" disabled />
            )}
          </div>
          {frequency == "Admission" && (
            <div>
              <div className="margin-top-15">
                Admission Identifier : &nbsp;
                {columnsTypes && Object.keys(columnsTypes).length > 0 ? (
                  <Dropdown
                    value={selectedColumns.admissionIdentifier}
                    onChange={(event) => handleColumnSelect("admissionIdentifier", event)}
                    options={Object.entries(columnsTypes)
                      .filter(([, value]) => value.includes("integer") || value.includes("string"))
                      .map(([key]) => ({ label: key, value: key }))}
                    placeholder="Admission Identifier"
                  />
                ) : (
                  <Dropdown placeholder="Admission Identifier" disabled />
                )}
              </div>
              <div className="margin-top-15">
                Admission Time : &nbsp;
                {columnsTypes && Object.keys(columnsTypes).length > 0 ? (
                  <Dropdown
                    value={selectedColumns.admissionTime}
                    onChange={(event) => handleColumnSelect("admissionTime", event)}
                    options={Object.entries(columnsTypes)
                      .filter(([, value]) => value.includes("date"))
                      .map(([key]) => ({ label: key, value: key }))}
                    placeholder="Admission Time"
                  />
                ) : (
                  <Dropdown placeholder="Admission Time" disabled />
                )}
              </div>
            </div>
          )}
          {(frequency == "HourRange" || (frequency == "Note" && masterTableCompatible) || (frequency == "Patient" && masterTableCompatible)) && (
            <div className="margin-top-15">
              Time : &nbsp;
              {columnsTypes && Object.keys(columnsTypes).length > 0 ? (
                <Dropdown
                  value={selectedColumns.time}
                  onChange={(event) => handleColumnSelect("time", event)}
                  options={Object.entries(columnsTypes)
                    .filter(([, value]) => value.includes("date"))
                    .map(([key]) => ({ label: key, value: key }))}
                  placeholder="Time"
                />
              ) : (
                <Dropdown placeholder="Time" disabled />
              )}
            </div>
          )}
          <div className="margin-top-15">
            Notes : &nbsp;
            {columnsTypes && Object.keys(columnsTypes).length > 0 ? (
              <Dropdown
                value={selectedColumns.notes}
                onChange={(event) => handleColumnSelect("notes", event)}
                options={Object.entries(columnsTypes)
                  .filter(([, value]) => value.includes("string"))
                  .map(([key]) => ({ label: key, value: key }))}
                placeholder="Notes"
              />
            ) : (
              <Dropdown placeholder="Notes" disabled />
            )}
          </div>
        </div>
      )
    },
    {
      key: "3",
      content: (
        <div>
          <b>Advanced options</b>
          <hr></hr>
          <div className="margin-top-15 margin-bottom-15">
            {/* Text input for column names */}
            Column name prefix : &nbsp;
            <InputText value={columnPrefix} onChange={(e) => handleColumnPrefixChange(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Button label="" icon="pi pi-folder-open" onClick={handleSelectBiobertPath} />
            &nbsp;BioBERT path : &nbsp; {biobertPath && <p style={{ maxWidth: "300px", wordBreak: "break-all" }}>{biobertPath}</p>}
          </div>
        </div>
      )
    }
  ]

  return (
    <>
      <Carousel value={carouselItems} numVisible={1} numScroll={1} responsiveOptions={responsiveOptions} itemTemplate={carouselTemplate} />
    </>
  )
}

export default ExtractionBioBERT
