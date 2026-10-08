/* eslint-disable */
import { embedDashboard } from "@superset-ui/embedded-sdk"
import axios from 'axios'
import { Button } from "primereact/button"
import { Card } from "primereact/card"
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import React, { useContext, useEffect, useState } from 'react'
import ModulePage from "../moduleBasics/modulePage"
import { toast } from "react-toastify"
import { SupersetRequestContext } from "./supersetRequestContext"

/**
 *
 * @returns the superset page
 */
const SupersetDashboard = () => {

  const [validated, setValidated] = useState(false)
  const { supersetPort, launched } = useContext(SupersetRequestContext)
  const [supersetUrl, setSupersetUrl] = useState(null)
  const [dashboardId, setDashboardId] = useState(null)
  const supersetApiUrl = supersetUrl + '/api/v1/security'

  async function getToken() {

    //calling login to get access token
    const login_body = {
        "password": "admin",
        "provider": "db",
        "refresh": true,
        "username": "admin"
    };

    const login_headers = {
        "headers": {
          "Content-Type": "application/json"
        }
    }

    console.log(supersetApiUrl + '/login')
    let data = null
    try{
      data = await axios.post(supersetApiUrl + '/login', login_body, login_headers)
    } catch (error) {
      toast.error("Error while connecting to the dashboard. Check console for more details.")
      console.error(error)
      setValidated(false)
      return
    }
    if (data.hasOwnProperty('data')) {
      data = data.data
    }
    const access_token = data['access_token']

    // Calling guest token
    const guest_token_body = JSON.stringify({
      "resources": [
        {
          "id": dashboardId,
          "type": "dashboard"
        }
      ],
      "rls": [
      ],
      "user": {
        "first_name": "admin",
        "last_name": "admin",
        "username": "admin"
      }
    });

    const guest_token_headers = {
        "headers": {
          "accept": "application/json",
          "Authorization": 'Bearer ' + access_token,
          "Content-Type": "application/json",
          "Allow-Control-Allow-Origin": "*"
        }
    }

    try{
      await axios.post(supersetApiUrl + '/guest_token/', guest_token_body, guest_token_headers).then(dt=>{
        embedDashboard({
            id: dashboardId,  // given by the Superset embedding UI
            supersetDomain: supersetUrl,
            mountPoint: document.getElementById("superset-container"), // html element in which iframe render
            fetchGuestToken: () => dt.data['token'],
            dashboardUiConfig: { hideTitle: true }
        });
      })
    } catch (error) {
      toast.error("Error while connecting to the dashboard. Check console for more details.")
      console.error(error)
      setValidated(false)
      return
    }

    var iframe = document.querySelector("iframe")

    if (iframe) {
        iframe.style.width = '100%'; // Set the width as needed
        iframe.style.height = '100vw'; // Set the height as needed
        iframe.src = iframe.src + '&embedded=true'
    }
  }

  useEffect(() => {
    if (validated) {
      getToken()
    }
  }, [validated])

  const renderLogin = () => {
    return (
      <div className="center-page config-page">
        <Card title="Dashboard configuration" subTitle="Please fill the following fields">
        <div className="card flex justify-content-center flex-column gap-3" style={{borderWidth: "0px"}}>
          <div className="p-inputgroup">
            <span className="p-inputgroup-addon">
              <i className="pi pi-id-card"></i>
            </span>
            <InputText placeholder="Dashboard ID"  onChange={(e) => setDashboardId(e.target.value)}/>
          </div>
          <div className="p-inputgroup">
              <span className="p-inputgroup-addon">
                <i className="pi pi-sitemap"></i>
              </span>
              <InputNumber placeholder="Port" useGrouping={false} onChange={(e) => setSupersetUrl("http://localhost:" + e.value)}/>
          </div>
          {(launched && supersetPort) && (
            <div className="border-0 rounded-bottom text-align center" style={{backgroundColor: "#9effaf", paddingInline: "1rem", height: "1.5rem"}}>
              <small className="text-muted">A Superset instance is already running on port {supersetPort}</small>
            </div>)}
          <Button 
            label="Connect" 
            severity="info" 
            disabled={supersetUrl === null || supersetUrl === "http://localhost:null" || dashboardId === null} 
            onClick={() => setValidated(true)}
          />
        </div>
        </Card>
      </div>
    )
  }

  var iframe = document.querySelector("iframe")
  if (iframe) {
    iframe.style.width = '100%'; // Set the width as needed
    iframe.style.height = '100vw'; // Set the height as needed
    iframe.src = iframe.src + '&embedded=true'
  }

  return (
    (validated) ? 
      <>
        <div className="superset">
          <div id='superset-container'></div>
        </div>
      </> : renderLogin()
  )
}

/**
 *
 * @param {String} pageId The page id
 * @returns the superset page with the module page
 */
const Superset = ({ pageId = "SupersetDashboard-id" }) => {
  return (
    <ModulePage pageId={pageId} shadow>
      <SupersetDashboard pageId={pageId} />
    </ModulePage>
  )
}

export default Superset
