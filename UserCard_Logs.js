import React, { useState, useEffect } from "react"
import { Button, Form, Modal } from "react-bootstrap"
import DatePicker from "react-datepicker"
import Moment from 'moment'

import { Card } from "../ViewComponents/Card/Card"

import { useApps } from "../../contexts/AppsContext"
import { useAuth } from "../../contexts/AuthContext"
import { useOrganization } from "../../contexts/OrganizationContext"
import { useAppUsers } from "../../contexts/AppUsersContext"


export default function UserLogsViewer({
  selectedUser
}) {
  const { currentOrg, orgForms, orgSubscriptions, orgFilesMetadata, orgProjects, itemSchemas, orgAds } = useOrganization()
  const { allApps } = useApps()
  const { getLogsForUser } = useAppUsers();

  const [logStartDate, setLogStartDate] = useState(undefined)
  const [logsEndDate, setLogsEndDate] = useState(new Date())
  const [selectedLogs, setSelectedLogs] = useState(undefined)
  const [showSelectedLogs, setShowSelectedLogs] = useState(false)
  const [logsNew, setLogsNew] = useState([])

  function handleEndDateChange(date) {
     if (date < logStartDate) {
       const newStartDate = new Date(date)
       newStartDate.setDate(newStartDate.getDate() - 1)
       setLogStartDate(newStartDate)
     }
     setLogsEndDate(date)
   }
   //useEffect to fetch logs when selectedUser or date range changes
   useEffect(() => {
    if (selectedUser && logStartDate && logsEndDate) {
      const startTimestamp = logStartDate.getTime();
      const endTimestamp = logsEndDate.getTime();

      getLogsForUser(selectedUser.uid, startTimestamp, endTimestamp, (logs, error) => {
        if (error) {
          console.error("Error fetching logs: ", error);
        } else {
          setLogsNew(logs);
        }
      });
    }
  }, [selectedUser, logStartDate, logsEndDate, getLogsForUser]);

  

  function getLogsEventDescription(log) {
    const event = log.event
    let eventParts = event.match(/^(user|file|project|itemSchema|app|form|function|error|ad)\b/)
    let eventType = eventParts ? eventParts[0] : "unknown"

    switch (eventType) {
      case "user": {
        const regex = /^user\.?(registered|login|logout|updated|forgotPassword|(.*?))$/
        const [, action] = event.match(regex) || []

        const view = <h6>user {action}</h6>
        return view
      }
      case "file": {
        const regex = /^file\[(.*?)\](?:\.link\[(.*?)\])?\.?(viewed|clicked|(.*?))$/
        const [, fileId, link, action] = event.match(regex)

        let view = undefined

        const fileName = orgFilesMetadata[fileId]?.title ?? "Unknown File"

        if (link) {
          view = <div style={{ display: "flex", gap: "5px" }}>
            <h6>file {action}:</h6>
            <a href={`/${currentOrg.id}/files/${fileId}/`}>{fileName}</a>
            ,
            <a href={`${link}`}>Link</a>
          </div>
        } else {
          view = <div style={{ display: "flex", gap: "5px" }}>
            <h6>file {action}: </h6>
            <a href={`/${currentOrg.id}/files/${fileId}/`}>{fileName}</a>
          </div>
        }

        return view
      }
      case "project": {
        const regex = /^project\[(.*?)\](?:\.section\[(.*?)\])?(\.bookmarks)?(?:\.section\[(.*?)\])?(\.bookmark)?\.(viewed|clicked|removed|added|(.*?))$/

        const [, projectId, sectionId1, bookmarks1, sectionId2, bookmark2, action] = event.match(regex)
        let view = undefined

        const projectName = orgProjects[projectId]?.title

        if (sectionId1 || sectionId2) {
          view = <div style={{ display: "flex", gap: "5px" }}>
            <h6>project section {bookmarks1 || bookmark2} {action}:</h6>
            <a href={`/${currentOrg.id}/projects/${projectId}/`}>{projectName}</a>
            ,
            <a href={`/${currentOrg.id}/projects/${projectId}?sectionId=${sectionId1 || sectionId2}`}>Section</a>
          </div>
        } else {
          view = <div style={{ display: "flex", gap: "5px" }}>
            <h6>project {bookmarks1 || bookmark2} {action}: </h6>
            <a href={`/${currentOrg.id}/projects/${projectId}/`}>{projectName}</a>
          </div>
        }
        return view
      }

      case "itemSchema": {
        const regex = /itemSchema\[(.*?)\](?:\.record\[(.*?)\](?:\.(comments))?(?:\.link\[(.*?)\])?)?(?:\.(suggestedRecord|viewed|added|clicked|(.*?)))/

        const [, schemaId, recordId, comments, link, action] = event.match(regex)
        const schemaName = itemSchemas.find(item => item.id === schemaId)
        let view = undefined

        if (recordId && link === undefined) {
          view = <div style={{ display: "flex", gap: "5px" }}>
            <h6>item record {comments} {action}:</h6>
            <a href={`/${currentOrg.id}/items/${schemaId}/`}>{schemaName.name}</a>
            ,
            <a href={`/${currentOrg.id}/items/${schemaId}/${recordId}`}>Record</a>
          </div>
        }
        else if (recordId && link !== undefined) {
          view = <div style={{ display: "flex", gap: "5px" }}>
            <h6>file link {comments} {action}:</h6>
            <a href={`/${currentOrg.id}/items/${schemaId}/`}>{schemaName.name}</a>
            ,
            <a href={`/${currentOrg.id}/items/${schemaId}/${recordId}`}>Record</a>
            ,
            <a href={link}>Link</a>
          </div>
        }
        else {
          view = <div style={{ display: "flex", gap: "5px" }}>
            <h6>item record suggested: </h6>
            <a href={`/${currentOrg.id}/items/${schemaId}/`}>Schema</a>
          </div>
        }

        return view
      }
      case "app": {
        if (log.viewId) {
          const action = event.match(/[^.]+$/)[0]

          const appId = log.appDetails.appId

          const appTab = allApps[appId].tabs.find(t => t.id === log.viewId)

          const eventDataObject = {
            library_viewed: "app library viewed",
            library_category_viewed: `App Library category viewed: ${log.categoryId}`,
            subscribe_viewed: "subscription view viewed",
            subscribe_subscriptionId: `subscription ${action} to buy:`,
            subscribe_restoredSubscriptions: "user restored subscriptions from subscribe view",
            login_viewed: "Viewed app view: Login",
            account_viewed: "Viewed app view: Account",
            account_restoredSubscriptions: "user restored subscriptions from account view",
            accountEdit_viewed: "Viewed app view: Account Edit"
          }

          const eventDescription = eventDataObject[`${log.viewId}${log.categoryId ? "_category" : ""}_${log.subscribeId ? "subscriptionId" : action}`]

          return <div style={{ display: "flex", gap: "5px" }}>
            <h6>{eventDescription || `Viewed app view: ${appTab?.type || log.viewId}`}</h6>
            <a hidden={log.subscribeId === undefined} href={`/${currentOrg.id}/subscriptions/${log.subscribeId}/`}>{orgSubscriptions[log.subscribeId]?.name}</a>
          </div>

        } else {
          let e = event.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\./g, ' ').toLowerCase()
          return <h6>{e}</h6>
        }
      }
      case "form": {
        const regex = /^form\[(.*?)\]\.?(viewed|submit|(.*?))$/

        const [, formId, action] = event.match(regex)

        if (orgForms[formId]) {
          const formName = orgForms[formId].name
          const view = <div style={{ display: "flex", gap: "5px" }}>
            <h6>form {action === "submit" ? "submitted" : action}:</h6>
            <a href={`/${currentOrg.id}/forms/${formId}`}>{formName}</a>
          </div>
          return view
        } else {
          return (<div style={{ display: "flex", gap: "5px" }}>Unknown Form</div>)
        }
      }
      case "function": {
        const view = <h6>{event}</h6>
        return view
      }
      case "ad": {
        const regex = /^ad\[(.*?)\]\.?(viewed|clicked|(.*?))$/
        const [, adId, action] = event.match(regex)
        let adObj = orgAds[adId]
        if (adObj) {
          return (
            <div style={{ display: "flex", gap: "5px" }}>
              <h6>ad {action}:</h6>
              <a href={`/${currentOrg.id}/ad/${adId}/`}>{adObj.title}</a>
            </div>
          )
        } else {
          return (
            <div style={{ display: "flex", gap: "5px" }}>
              <h6>ad {action}: {adId}</h6>
            </div>
          )
        }
      }
      case "unknown":
      default: {
        console.log("unknown log:", event)
      }
    }

    return <h6>{event}</h6>
  }

  return (
    <div className="UserCard_LogsBox">
      <div style={{background:"#eee", display: "flex",alignItems:"center",justifyItems:"center",padding:"5px"}}>
        <h5 style={{flex:"1"}}>Logs</h5>
        <div style={{gap:"0",display: "flex",alignItems:"center",textAlign:"center"}}>
          <DatePicker
            showTimeInput
            dateFormat={"MMM d, yyyy hh:mm aa"}
            selected={logStartDate}
            className="datePickerFieldStyle"
            onChange={(date) => setLogStartDate(date)}
            maxDate={logsEndDate}
            placeholderText=""
          />
          <h5> - </h5>
          <DatePicker
            showTimeInput
            dateFormat={"MMM d, yyyy hh:mm aa"}
            selected={logsEndDate}
            className="datePickerFieldStyle"
            onChange={handleEndDateChange}
            maxDate={new Date()}
          />
        </div>
      </div>

      <div className="logsBox" style={{border: "1px solid #ccc", height: "500px", overflowY: "scroll"}}>
        {
          logsNew.filter(item => {
            const timestamp = item.timestamp
            return logStartDate ? timestamp >= logStartDate && timestamp <= logsEndDate : timestamp <= logsEndDate
          }).map((log)=>{
            return (
              <div style={{padding: "5px", borderBottom: "1px solid #eee",display:"flex"}} key={log.key}>
                <div style={{width: "220px", paddingRight: "20px", display:"table-cell"}}>
                  <b>{Moment(parseInt(log.timestamp)).format('MMM D YYYY H:mm:ss')}</b><br />
                  <span style={{fontSize: ".8em"}}>{log.appDetails ? `${allApps[log.appDetails.appId].name}, ${log.appDetails.platform.toUpperCase()}, ${log.appDetails.appVersion}` : ""}</span>
                </div>
                <div style={{display:"table-cell"}}>
                  {getLogsEventDescription(log)}
                  <span style={{fontSize: ".8em"}}>{log.key}</span>
                </div>

                <div style={{display:"table-cell",flex:"1",textAlign:"end",marginRight:"10px"}}>
                  <Button
                    variant="text"
                    style={{color:"blue",fontWeight:"bold"}}
                    size="sm"
                    onClick={() => {
                      setSelectedLogs(log)
                      setShowSelectedLogs(true)
                    }}
                  >View Log</Button>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

