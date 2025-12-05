import fs from 'fs'
import { Button } from "primereact/button"
import { Dropdown } from "primereact/dropdown"
import { useCallback, useContext, useEffect, useState } from "react"
import AceEditor from "react-ace"
import { Col, Row } from "react-bootstrap"
import { toast } from "react-toastify"
import { requestBackend } from "../../utilities/requests"
import { ServerConnectionContext } from "../serverConnection/connectionContext"
import { DataContext } from "../workspace/dataContext"

import "ace-builds/src-noconflict/ext-language_tools"
import "ace-builds/src-noconflict/mode-javascript"
import "ace-builds/src-noconflict/mode-json"
import "ace-builds/src-noconflict/mode-markdown"
import "ace-builds/src-noconflict/mode-python"
import "ace-builds/src-noconflict/mode-text"
import "ace-builds/src-noconflict/theme-ambiance"
import "ace-builds/src-noconflict/theme-chaos"
import "ace-builds/src-noconflict/theme-chrome"
import "ace-builds/src-noconflict/theme-cloud9_day"
import "ace-builds/src-noconflict/theme-cloud9_night"
import "ace-builds/src-noconflict/theme-cloud9_night_low_color"
import "ace-builds/src-noconflict/theme-cloud_editor"
import "ace-builds/src-noconflict/theme-cloud_editor_dark"
import "ace-builds/src-noconflict/theme-clouds"
import "ace-builds/src-noconflict/theme-clouds_midnight"
import "ace-builds/src-noconflict/theme-cobalt"
import "ace-builds/src-noconflict/theme-crimson_editor"
import "ace-builds/src-noconflict/theme-dawn"
import "ace-builds/src-noconflict/theme-dracula"
import "ace-builds/src-noconflict/theme-dreamweaver"
import "ace-builds/src-noconflict/theme-eclipse"
import "ace-builds/src-noconflict/theme-github"
import "ace-builds/src-noconflict/theme-github_dark"
import "ace-builds/src-noconflict/theme-github_light_default"
import "ace-builds/src-noconflict/theme-gob"
import "ace-builds/src-noconflict/theme-gruvbox"
import "ace-builds/src-noconflict/theme-gruvbox_dark_hard"
import "ace-builds/src-noconflict/theme-gruvbox_light_hard"
import "ace-builds/src-noconflict/theme-idle_fingers"
import "ace-builds/src-noconflict/theme-iplastic"
import "ace-builds/src-noconflict/theme-katzenmilch"
import "ace-builds/src-noconflict/theme-kr_theme"
import "ace-builds/src-noconflict/theme-kuroir"
import "ace-builds/src-noconflict/theme-merbivore"
import "ace-builds/src-noconflict/theme-merbivore_soft"
import "ace-builds/src-noconflict/theme-mono_industrial"
import "ace-builds/src-noconflict/theme-monokai"
import "ace-builds/src-noconflict/theme-nord_dark"
import "ace-builds/src-noconflict/theme-one_dark"
import "ace-builds/src-noconflict/theme-pastel_on_dark"
import "ace-builds/src-noconflict/theme-solarized_dark"
import "ace-builds/src-noconflict/theme-solarized_light"
import "ace-builds/src-noconflict/theme-sqlserver"
import "ace-builds/src-noconflict/theme-terminal"
import "ace-builds/src-noconflict/theme-textmate"
import "ace-builds/src-noconflict/theme-tomorrow"
import "ace-builds/src-noconflict/theme-tomorrow_night"
import "ace-builds/src-noconflict/theme-tomorrow_night_blue"
import "ace-builds/src-noconflict/theme-tomorrow_night_bright"
import "ace-builds/src-noconflict/theme-tomorrow_night_eighties"
import "ace-builds/src-noconflict/theme-twilight"
import "ace-builds/src-noconflict/theme-vibrant_ink"
import "ace-builds/src-noconflict/theme-xcode"


/**
 *  A code editor component
 * @param {string} id - The id of the code editor
 * @param {string} path - The path of the file to edit
 * @param {function} updateSavedCode - A function to update the saved code
 * @returns {JSX.Element} A code editor
 */
const CodeEditor = ({id, path, updateSavedCode}) => {
  const themes = [
    { label: "Ambiance", value: "ambiance" },
    { label: "Chaos", value: "chaos" },
    { label: "Chrome", value: "chrome" },
    { label: "Cloud9 Day", value: "cloud9_day" },
    { label: "Cloud9 Night", value: "cloud9_night" },
    { label: "Cloud9 Night Low Color", value: "cloud9_night_low_color" },
    { label: "Cloud Editor", value: "cloud_editor" },
    { label: "Cloud Editor Dark", value: "cloud_editor_dark" },
    { label: "Clouds", value: "clouds" },
    { label: "Clouds Midnight", value: "clouds_midnight" },
    { label: "Cobalt", value: "cobalt" },
    { label: "Crimson Editor", value: "crimson_editor" },
    { label: "Dawn", value: "dawn" },
    { label: "Dracula", value: "dracula" },
    { label: "Dreamweaver", value: "dreamweaver" },
    { label: "Eclipse", value: "eclipse" },
    { label: "GitHub", value: "github" },
    { label: "GitHub Dark", value: "github_dark" },
    { label: "GitHub Light Default", value: "github_light_default" },
    { label: "Gob", value: "gob" },
    { label: "Gruvbox", value: "gruvbox" },
    { label: "Gruvbox Dark Hard", value: "gruvbox_dark_hard" },
    { label: "Gruvbox Light Hard", value: "gruvbox_light_hard" },
    { label: "Idle Fingers", value: "idle_fingers" },
    { label: "IPlastic", value: "iplastic" },
    { label: "Katzenmilch", value: "katzenmilch" },
    { label: "Kr Theme", value: "kr_theme" },
    { label: "Kuroir", value: "kuroir" },
    { label: "Merbivore", value: "merbivore" },
    { label: "Merbivore Soft", value: "merbivore_soft" },
    { label: "Mono Industrial", value: "mono_industrial" },
    { label: "Tomorrow", value: "tomorrow" },
    { label: "Tomorrow Night", value: "tomorrow_night" },
    { label: "Tomorrow Night Blue", value: "tomorrow_night_blue" },
    { label: "Tomorrow Night Bright", value: "tomorrow_night_bright" },
    { label: "Tomorrow Night Eighties", value: "tomorrow_night_eighties" },
    { label: "Twilight", value: "twilight" },
    { label: "Vibrant Ink", value: "vibrant_ink" },
    { label: "Xcode", value: "xcode" },
  ]
  const [theme, setTheme] = useState("tomorrow")
  const [saved, setSaved] = useState(true)
  const [content, setContent] = useState("Loading...")
  const [mode, setMode] = useState("text")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingSave, setLoadingSave] = useState(false)
  const { globalData } = useContext(DataContext)
  const { port } = useContext(ServerConnectionContext)
  
  // handle content change
  function onChange(value) {
    setSaved(false)
    if (value === "") {
      setContent(" ")
    } else {
      setContent(value)
    }
    updateSavedCode(false, id)
  }

  const writeFileContent = async (filePath, newContent) => {
    fs.writeFileSync(filePath, newContent, "utf-8"); // Overwrites the file
  };

  // Add the handleSave function
  const saveChanges = useCallback(async () => {
    try{
      setLoadingSave(true)
      await writeFileContent(path, content)
      setSaved(true)
      updateSavedCode(true, id)
      setLoadingSave(false)
      toast.success("Saved file successfully")
    } catch (error) {
      console.error("Error saving file:", error)
      setLoadingSave(false)
      toast.error("Error saving file")
    }
    setLoadingSave(true)
    requestBackend(
      port,
      "/learning/save_file_content/",
      requestBody,
      (response) => {
        setLoadingSave(false)
        console.log("Response from backend:", response)
        if (response.error){
          throw new Error("Error in backend while saving file.")
        }
        else {
          setSaved(true)
          updateSavedCode(true, id)
          toast.success("Saved " + globalData[id].name + " file successfully")
        }
      },
      (error) => {
        setLoadingSave(false)
        console.error("Error from backend:", error)
        toast.error("Error saving file: " + globalData[id].name)
      }
    )
    return
  })

  /**
   * Load file content from MongoDB or a local path.
   * @param {string} source - The source of the file (MongoDB ID or local path).
   * @returns {Promise<string>} - The content of the file.
   */
  const loadFileContent = async (id, path) => {
    // Simulate loading from MongoDB or local path
    if (!path && id){
      // Retrieve path
      path = globalData[id].path
    }
    if (!path) {
      setContent("Error: missing path or file not found locally")
      return
    }

    // Fetch from file content
    let requestBody = {
      filePath: path
    }
    requestBackend(
      port,
      "/learning/get_file_content/",
      requestBody,
      (response) => {
        setLoading(false)
        console.log("Response from backend:", response)
        if (response.error){
          setError(response.error)
          toast.error("Error opening file: " + response.error)
        }
        else {
          setContent(response.content)
          setMode(response.language)
          toast.success("Opened file successfully")
        }
      },
      (error) => {
        console.error("Error from backend:", error)
        setError(String(error))
      }
    )
  }

  // Load file content
  useEffect(() => {
    const fetchFile = async (id, path) => {
      await loadFileContent(id, path)
    }
    fetchFile(id, path)
  }, [id, path])

  // Add CTRL+S event listener (fired in main container) to save changes
  useEffect(() => {
      const handleSaveEvent = (event) => {
        if (id === event.detail?.tabId ) {
          saveChanges()
        }
      }
      document.body.addEventListener('saveFileEvent', handleSaveEvent)
      
      // Cleanup function to remove event listener when component unmounts
      return () => {
        document.body.removeEventListener('saveFileEvent', handleSaveEvent)
      }
    }, [saveChanges])

  return (
    <>
    {error ? (
      <Row className="error-dialog-header">
        <Col md="auto">
          <h5>{error}</h5>
        </Col>
      </Row>
    ) : (
      <>
    {(loading || !content) ? (
      <div>Loading...</div> ) : (
        <>
          <div className="flex-container justify-between items-center w-full mb-3 mt-2 p-2">
            <div className="flex-container items-center gap-3 p-2">
              <h6 className="mt-2">Theme:</h6>
              <Dropdown 
                value={theme} 
                options={themes} 
                onChange={(e) => setTheme(e.value)} 
                placeholder={theme ? theme : "Select a theme"} 
              />
            </div>
            <Button 
              style={{height:"40px", marginTop:"10px"}} 
              label="Save Changes" 
              icon="pi pi-save" 
              className="p-button-success" 
              size="small" 
              onClick={saveChanges}
              loading={loadingSave}
              disabled={saved}
            />
          </div>
          <AceEditor
            style={{ width: "100%", height: "100%" }}
            mode={mode}
            theme={theme}
            fontSize={16}
            onChange={onChange}
            name="UNIQUE_ID_OF_DIV"
            showPrintMargin={true}
            showGutter={true}
            highlightActiveLine={true}
            value={content}
            editorProps={{ $blockScrolling: true }}
            setOptions={{
              useWorker: false,
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              enableSnippets: true,
              showLineNumbers: true,
            }}
          />
        </>
      )}
      </>
    )}
    </>
  )
}

export default CodeEditor
