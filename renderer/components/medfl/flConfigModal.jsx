import React from "react"
import { Modal } from "react-bootstrap"
import AceEditor from "react-ace"

import "ace-builds/src-noconflict/mode-ini"
import "ace-builds/src-noconflict/theme-github"
import "ace-builds/src-noconflict/ext-language_tools"

const FlConfigModal = ({ show, onHide }) => {
  return (
    <div>
      <Modal show={show} onHide={onHide} size="lg" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter"> MEDfl Database config file </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="my-2">The MEDfl uses a database so you need to create a config file to connect to the sql database </div>
          <div className="my-2">Make sure to connect to sql for more details check this tutorial </div>
          <div className="my-2">
            Create <code>config.ini </code> inside the <code>DATA </code> directory and copy this content to the file and make sure to change the SQL_USERNAME and PASSWORD
          </div>

          <AceEditor
            mode="ini"
            theme="github"
            fontSize={16}
            onChange={() => {}}
            showPrintMargin={true}
            showGutter={true}
            highlightActiveLine={false}
            value={`
[mysql]
host = localhost
port = 3306
user = YOUR_SQL_USERNAME
password = YOUR_PASSWORD
database = MEDfl`}
            editorProps={{ $blockScrolling: true }}
            setOptions={{
              showLineNumbers: true
            }}
            readOnly={true}
            height="150px"
          />
        </Modal.Body>
        <Modal.Footer></Modal.Footer>
      </Modal>
    </div>
  )
}

export default FlConfigModal
