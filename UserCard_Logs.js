import React, { useState, useEffect } from "react"
import { Button, Modal } from "react-bootstrap"
import DatePicker from "react-datepicker"
import Moment from 'moment'

import { useApps } from "../../contexts/AppsContext"
import { useOrganization } from "../../contexts/OrganizationContext"
import { useAppUsers } from "../../contexts/AppUsersContext"

// Function to get human-readable label for any event
function getEventLabel(rawEvent) {
  // App events
  if (rawEvent === 'app.opened') return 'App - Opened';
  if (rawEvent === 'app.broughtToForeground') return 'App - Brought to foreground';
  if (rawEvent === 'app.sentToBackground') return 'App - Sent to background';
  if (rawEvent === 'app.askedToReview') return 'App - Review prompt shown';
  if (rawEvent.match(/^app\.view\[.*?\]\.viewed$/)) return 'App - View tab viewed';
  
  // App view specific events
  if (rawEvent.match(/^app\.view\["?library"?\]\.viewed$/)) return 'App - Library viewed';
  if (rawEvent.match(/^app\.view\["?library"?\]\.category\[.*?\]\.viewed$/)) return 'App - Library category viewed';
  if (rawEvent.match(/^app\.view\["?subscribe"?\]\.viewed$/)) return 'App - Subscribe view shown';
  if (rawEvent.match(/^app\.view\["?subscribe"?\]\.subscribe\[.*?\]\.attempted$/)) return 'Subscribe - Attempt started';
  if (rawEvent.match(/^app\.view\["?subscribe"?\]\.subscribe\[.*?\]\.success$/)) return 'Subscribe - Success';
  if (rawEvent.match(/^app\.view\["?subscribe"?\]\.subscribe\[.*?\]\.failed$/)) return 'Subscribe - Failed';
  if (rawEvent.match(/^app\.view\["?subscribe"?\]\.subscribe\[.*?\]\.canceled$/)) return 'Subscribe - Canceled';
  if (rawEvent.match(/^app\.view\["?subscribe"?\]\.restoredSubscriptions$/)) return 'Subscribe - Restored subscriptions';
  if (rawEvent.match(/^app\.view\["?login"?\]\.viewed$/)) return 'App - Login view shown';
  if (rawEvent.match(/^app\.view\["?account"?\]\.viewed$/)) return 'App - Account view shown';
  if (rawEvent.match(/^app\.view\["?account"?\]\.restoredSubscriptions$/)) return 'Account - Restored subscriptions';
  if (rawEvent.match(/^app\.view\["?accountEdit"?\]\.viewed$/)) return 'App - Account edit view shown';
  
  // Project events
  if (rawEvent.match(/^project\[.*?\]\.viewed$/)) return 'Project - Opened';
  if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.clicked$/)) return 'Project - Section clicked';
  if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.viewed$/)) return 'Project - Section viewed';
  if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.bookmark\.added$/)) return 'Project - Bookmark added';
  if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.bookmark\.removed$/)) return 'Project - Bookmark removed';
  if (rawEvent.match(/^project\[.*?\]\.bookmarks\.viewed$/)) return 'Project - Bookmarks viewed';
  if (rawEvent.match(/^project\[.*?\]\.bookmarks\.section\[.*?\]\.clicked$/)) return 'Project - Bookmark section clicked';
  if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.downloaded$/)) return 'Project - Section downloaded';
  
  // File events  
  if (rawEvent.match(/^file\[.*?\]\.viewed$/)) return 'File - Viewed';
  if (rawEvent.match(/^file\[.*?\]\.link\[.*?\]\.clicked$/)) return 'File - Link clicked';
  
  // Item schema events
  if (rawEvent.match(/^itemSchema\[.*?\]\.suggestedRecord$/)) return 'Item - Record suggested';
  if (rawEvent.match(/^itemSchema\[.*?\]\.record\[.*?\]\.viewed$/)) return 'Item - Record viewed';
  if (rawEvent.match(/^itemSchema\[.*?\]\.record\[.*?\]\.comments\.viewed$/)) return 'Item - Comments viewed';
  if (rawEvent.match(/^itemSchema\[.*?\]\.record\[.*?\]\.comments\.added$/)) return 'Item - Comment added';
  if (rawEvent.match(/^itemSchema\[.*?\]\.record\[.*?\]\.link\[.*?\]\.clicked$/)) return 'Item - Link clicked';
  
  // Form events
  if (rawEvent.match(/^form\[.*?\]\.viewed$/)) return 'Form - Viewed';
  if (rawEvent.match(/^form\[.*?\]\.submit$/)) return 'Form - Submitted';
  
  // User events
  if (rawEvent === 'user.registered') return 'User - Registered';
  if (rawEvent === 'user.login') return 'User - Login';
  if (rawEvent === 'user.logout') return 'User - Logout';
  if (rawEvent === 'user.updated') return 'User - Profile updated';
  if (rawEvent === 'user.forgotPassword') return 'User - Forgot password';
  
  // Error events
  if (rawEvent === 'error.general') return 'Error - General';
  
  // Ad events
  if (rawEvent.match(/^ad\[.*?\]\.viewed$/)) return 'Ad - Viewed';
  if (rawEvent.match(/^ad\[.*?\]\.clicked$/)) return 'Ad - Clicked';
  if (rawEvent.match(/^ad\[.*?\]\.opened$/)) return 'Ad - Opened';
  
  // Notification events
  if (rawEvent.match(/^notification\[.*?\]\.opened$/)) return 'Notification - Opened';
  if (rawEvent.match(/^notification\[.*?\]\.recievedWhileInForground$/)) return 'Notification - Received while in foreground';
  
  // Return the raw event if no match found
  return rawEvent;
}
export default function UserLogsViewer({
  selectedUser
}) {
  const { currentOrg, orgForms, orgSubscriptions, orgFilesMetadata, orgProjects, itemSchemas, orgAds } = useOrganization()
  const { allApps } = useApps()
  const { getLogsForUser } = useAppUsers();

  const [logStartDate, setLogStartDate] = useState(undefined)
  const [logsEndDate, setLogsEndDate] = useState(new Date())
  const [expandedLogs, setExpandedLogs] = useState(new Set())
  const [logsNew, setLogsNew] = useState([])

  const [eventTypes, setEventTypes] = useState(["all"])
  const [selectedEventTypes, setSelectedEventTypes] = useState(["all"])
  const [searchQuery, setSearchQuery] = useState("")
  const labelFor = key => getEventLabel(key);

  // Function to get searchable content from a log entry
  function getSearchableContent(log) {
    const searchableFields = [];
    
    // Add the raw event string
    searchableFields.push(log.event);
    
    // Add any other log fields that might be searchable
    if (log.key) searchableFields.push(log.key);
    if (log.appDetails) {
      if (log.appDetails.appId) searchableFields.push(log.appDetails.appId);
      if (log.appDetails.appVersion) searchableFields.push(log.appDetails.appVersion);
      if (log.appDetails.platform) searchableFields.push(log.appDetails.platform);
    }
    
    // Extract and add ancillary info based on event type
    const event = log.event;
    const eventParts = event.match(/^(user|file|project|itemSchema|app|form|function|error|ad|notification)\b/);
    const eventType = eventParts ? eventParts[0] : "unknown";
    
    switch (eventType) {
      case "file": {
        const fileMatch = event.match(/^file\[(.*?)\]/);
        if (fileMatch) {
          const fileId = fileMatch[1];
          searchableFields.push(fileId);
          const fileName = orgFilesMetadata[fileId]?.title;
          if (fileName) searchableFields.push(fileName);
        }
        break;
      }
      case "project": {
        const projectMatch = event.match(/^project\[(.*?)\]/);
        if (projectMatch) {
          const projectId = projectMatch[1];
          searchableFields.push(projectId);
          const projectName = orgProjects[projectId]?.title;
          if (projectName) searchableFields.push(projectName);
        }
        break;
      }
      case "itemSchema": {
        const schemaMatch = event.match(/^itemSchema\[(.*?)\]/);
        if (schemaMatch) {
          const schemaId = schemaMatch[1];
          searchableFields.push(schemaId);
        }
        break;
      }
      case "app": {
        if (event.includes("view[") && allApps) {
          const viewMatch = event.match(/view\[(.*?)\]/);
          if (viewMatch) {
            const viewId = viewMatch[1];
            searchableFields.push(viewId);
            // Find app that contains this view
            for (const [appId, app] of Object.entries(allApps)) {
              const appTab = app?.tabs?.find(t => t.id === viewId);
              if (appTab) {
                searchableFields.push(appId);
                searchableFields.push(app.name);
                searchableFields.push(appTab.title);
                break;
              }
            }
          }
        }
        break;
      }
    }
    
    // Add any subscription, notification, or other IDs from the event string
    const idMatches = event.match(/\[(.*?)\]/g);
    if (idMatches) {
      idMatches.forEach(match => {
        const id = match.replace(/[[\]]/g, '');
        if (id && !searchableFields.includes(id)) {
          searchableFields.push(id);
        }
      });
    }
    
    return searchableFields.join(' ').toLowerCase();
  }

  // Function to normalize raw events to your approved event types
  function normalizeEventType(rawEvent) {
    // App events
    if (rawEvent === 'app.opened') return 'app.opened';
    if (rawEvent === 'app.broughtToForeground') return 'app.broughtToForeground';  
    if (rawEvent === 'app.sentToBackground') return 'app.sentToBackground';
    if (rawEvent === 'app.askedToReview') return 'app.askedToReview';
    if (rawEvent.match(/^app\.view\[.*?\]\.viewed$/)) return 'app.view.viewed';
    
    // App view specific events
    if (rawEvent.match(/^app\.view\["?library"?\]\.viewed$/)) return 'app.view.library.viewed';
    if (rawEvent.match(/^app\.view\["?library"?\]\.category\[.*?\]\.viewed$/)) return 'app.view.library.category.viewed';
    if (rawEvent.match(/^app\.view\["?subscribe"?\]\.viewed$/)) return 'app.view.subscribe.viewed';
    if (rawEvent.match(/^app\.view\["?subscribe"?\]\.subscribe\[.*?\]\.attempted$/)) return 'app.view.subscribe.subscribe.attempted';
    if (rawEvent.match(/^app\.view\["?subscribe"?\]\.subscribe\[.*?\]\.success$/)) return 'app.view.subscribe.subscribe.success';
    if (rawEvent.match(/^app\.view\["?subscribe"?\]\.subscribe\[.*?\]\.failed$/)) return 'app.view.subscribe.subscribe.failed';
    if (rawEvent.match(/^app\.view\["?subscribe"?\]\.subscribe\[.*?\]\.canceled$/)) return 'app.view.subscribe.subscribe.canceled';
    if (rawEvent.match(/^app\.view\["?subscribe"?\]\.restoredSubscriptions$/)) return 'app.view.subscribe.restoredSubscriptions';
    if (rawEvent.match(/^app\.view\["?login"?\]\.viewed$/)) return 'app.view.login.viewed';
    if (rawEvent.match(/^app\.view\["?account"?\]\.viewed$/)) return 'app.view.account.viewed';
    if (rawEvent.match(/^app\.view\["?account"?\]\.restoredSubscriptions$/)) return 'app.view.account.restoredSubscriptions';
    if (rawEvent.match(/^app\.view\["?accountEdit"?\]\.viewed$/)) return 'app.view.accountEdit.viewed';
    
    // Project events
    if (rawEvent.match(/^project\[.*?\]\.viewed$/)) return 'project.viewed';
    if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.clicked$/)) return 'project.section.clicked';
    if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.viewed$/)) return 'project.section.viewed';
    if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.bookmark\.added$/)) return 'project.section.bookmark.added';
    if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.bookmark\.removed$/)) return 'project.section.bookmark.removed';
    if (rawEvent.match(/^project\[.*?\]\.bookmarks\.viewed$/)) return 'project.bookmarks.viewed';
    if (rawEvent.match(/^project\[.*?\]\.bookmarks\.section\[.*?\]\.clicked$/)) return 'project.bookmarks.section.clicked';
    if (rawEvent.match(/^project\[.*?\]\.section\[.*?\]\.downloaded$/)) return 'project.section.downloaded';
    
    // File events  
    if (rawEvent.match(/^file\[.*?\]\.viewed$/)) return 'file.viewed';
    if (rawEvent.match(/^file\[.*?\]\.link\[.*?\]\.clicked$/)) return 'file.link.clicked';
    
    // Item schema events
    if (rawEvent.match(/^itemSchema\[.*?\]\.suggestedRecord$/)) return 'itemSchema.suggestedRecord';
    if (rawEvent.match(/^itemSchema\[.*?\]\.record\[.*?\]\.viewed$/)) return 'itemSchema.record.viewed';
    if (rawEvent.match(/^itemSchema\[.*?\]\.record\[.*?\]\.comments\.viewed$/)) return 'itemSchema.record.comments.viewed';
    if (rawEvent.match(/^itemSchema\[.*?\]\.record\[.*?\]\.comments\.added$/)) return 'itemSchema.record.comments.added';
    if (rawEvent.match(/^itemSchema\[.*?\]\.record\[.*?\]\.link\[.*?\]\.clicked$/)) return 'itemSchema.record.link.clicked';
    
    // Form events
    if (rawEvent.match(/^form\[.*?\]\.viewed$/)) return 'form.viewed';
    if (rawEvent.match(/^form\[.*?\]\.submit$/)) return 'form.submit';
    
    // User events
    if (rawEvent === 'user.registered') return 'user.registered';
    if (rawEvent === 'user.login') return 'user.login';
    if (rawEvent === 'user.logout') return 'user.logout';
    if (rawEvent === 'user.updated') return 'user.updated';
    if (rawEvent === 'user.forgotPassword') return 'user.forgotPassword';
    
    // Error events
    if (rawEvent === 'error.general') return 'error.general';
    
    // Ad events
    if (rawEvent.match(/^ad\[.*?\]\.viewed$/)) return 'ad.viewed';
    if (rawEvent.match(/^ad\[.*?\]\.clicked$/)) return 'ad.clicked';
    if (rawEvent.match(/^ad\[.*?\]\.opened$/)) return 'ad.opened';
    
    // Notification events
    if (rawEvent.match(/^notification\[.*?\]\.opened$/)) return 'notification.opened';
    if (rawEvent.match(/^notification\[.*?\]\.recievedWhileInForground$/)) return 'notification.recievedWhileInForground';
    
    // If no match found, return null to filter it out
    return null;
  }

  //combine date‐range + eventType + search filtering
const filteredLogs = logsNew.filter(item => {
  const ts = item.timestamp;
  //date check
  const inRange = logStartDate
    ? ts >= logStartDate && ts <= logsEndDate
    : ts <= logsEndDate;
  
  // Only show approved events and match by normalized type
  const normalizedEvent = normalizeEventType(item.event);
  const matchesType = selectedEventTypes.length === 0
    ? false  // Show nothing if no types selected
    : selectedEventTypes.includes("all") 
    ? normalizedEvent !== null  // Only show approved events when "all" is selected
    : selectedEventTypes.includes(normalizedEvent); // Match normalized type when specific types selected
  
  // Search functionality
  const matchesSearch = !searchQuery.trim() || 
    getSearchableContent(item).includes(searchQuery.toLowerCase().trim());
  
  return inRange && matchesType && matchesSearch;
});


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
    if (selectedUser && logsEndDate) {
      const startTimestamp = logStartDate ? logStartDate.getTime() : 0; // If no start date, use epoch
      const endTimestamp = logsEndDate.getTime();

      getLogsForUser(selectedUser.uid, startTimestamp, endTimestamp, (logs, error) => {
        if (error) {
          console.error("Error fetching logs: ", error);
          setLogsNew([]); // Set empty array on error
        } else {
          setLogsNew(logs || []); // Ensure logs is always an array
        }
      });
    }
  }, [selectedUser, logStartDate, logsEndDate, getLogsForUser]);

  useEffect(() => { //use effect to extract event keys 
    // Group by normalized type but show human-readable labels
    const eventTypeMap = new Map();
    
    logsNew.forEach(log => {
      const normalizedType = normalizeEventType(log.event);
      if (normalizedType !== null) {
        const label = getEventLabel(log.event);
        // Use normalized type as key to group similar events together
        if (!eventTypeMap.has(normalizedType)) {
          eventTypeMap.set(normalizedType, {
            label: label,
            rawEvents: new Set()
          });
        }
        eventTypeMap.get(normalizedType).rawEvents.add(log.event);
      }
    });
    
    // Convert to array and sort by label
    const eventOptions = Array.from(eventTypeMap.entries())
      .map(([normalizedType, data]) => ({
        value: normalizedType,
        label: data.label,
        rawEvents: Array.from(data.rawEvents)
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    
    setEventTypes(["all", ...eventOptions.map(opt => opt.value)]);
  }, [logsNew]);

  

  function getLogsEventDescription(log) {
    const event = log.event
    let eventParts = event.match(/^(user|file|project|itemSchema|app|form|function|error|ad|notification)\b/)
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

          const appTab = allApps?.[appId]?.tabs?.find(t => t.id === log.viewId)

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
      case "notification": {
        const regex = /^notification\[(.*?)\]\.?(opened|recievedWhileInForground|(.*?))$/
        const [, notificationId, action] = event.match(regex)
        
        return (
          <div style={{ display: "flex", gap: "5px" }}>
            <h6>notification {action}: {notificationId}</h6>
          </div>
        )
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
    
      <div style={{ padding: "8px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }} htmlFor="search-logs">
            Search logs:
          </label>
          <input
            id="search-logs"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name, file name, ID, event type, etc..."
            style={{ 
              width: "100%", 
              padding: "8px", 
              borderRadius: "4px", 
              border: "1px solid #ccc",
              fontSize: "14px"
            }}
          />
          {searchQuery && (
            <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
              {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontWeight: "bold" }}>Filter by event types:</span>
          <div>
            <button 
              type="button" 
              onClick={() => setSelectedEventTypes(["all"])}
              style={{ marginRight: "8px", padding: "2px 8px", fontSize: "12px", cursor: "pointer" }}
            >
              Select All
            </button>
            <button 
              type="button" 
              onClick={() => setSelectedEventTypes([])}
              style={{ padding: "2px 8px", fontSize: "12px", cursor: "pointer" }}
            >
              Clear All
            </button>
          </div>
        </div>
        <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #ccc", padding: "8px", borderRadius: "4px" }}>
          {eventTypes.map(t => (
            <div key={t} style={{ marginBottom: "4px" }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedEventTypes.includes(t)}
                  onChange={(e) => {
                    if (t === "all") {
                      // If "all" is clicked, either select all or deselect all
                      if (e.target.checked) {
                        setSelectedEventTypes(["all"]);
                      } else {
                        setSelectedEventTypes([]);
                      }
                    } else {
                      // If a specific type is clicked
                      const newSelected = [...selectedEventTypes];
                      if (e.target.checked) {
                        // Remove "all" if present and add this type
                        const filtered = newSelected.filter(type => type !== "all");
                        setSelectedEventTypes([...filtered, t]);
                      } else {
                        // Remove this type
                        setSelectedEventTypes(newSelected.filter(type => type !== t));
                      }
                    }
                  }}
                  style={{ marginRight: "8px" }}
                />
                <span style={{ fontSize: "14px" }}>{labelFor(t)}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="logsBox" style={{border: "1px solid #ccc", height: "500px", overflowY: "scroll"}}>
        {
          filteredLogs.map((log, idx)=>{
            const isExpanded = expandedLogs.has(idx);
            const toggleExpand = () => {
              const newExpanded = new Set(expandedLogs);
              if (isExpanded) {
                newExpanded.delete(idx);
              } else {
                newExpanded.add(idx);
              }
              setExpandedLogs(newExpanded);
            };

            return (
              <div style={{borderBottom: "1px solid #eee"}} key={idx}>
                <div style={{padding: "5px", display:"flex", cursor: "pointer", backgroundColor: isExpanded ? "#f0f8ff" : "transparent"}} onClick={toggleExpand}>
                  <div style={{width: "220px", paddingRight: "20px", display:"table-cell"}}>
                    <b>{Moment(parseInt(log.timestamp)).format('MMM D YYYY H:mm:ss')}</b><br />
                    <span style={{fontSize: ".8em"}}>{log.appDetails && allApps ? `${allApps[log.appDetails.appId]?.name}, ${log.appDetails.platform.toUpperCase()}, ${log.appDetails.appVersion}` : ""}</span>
                  </div>
                  <div style={{display:"table-cell", flex: 1}}>
                    {getLogsEventDescription(log)}
                    <span style={{fontSize: ".8em"}}>{log.key}</span>
                  </div>

                  <div style={{display:"table-cell", textAlign:"end", marginRight:"10px", width: "100px"}}>
                    <span style={{color:"blue", fontWeight:"bold", fontSize: "14px"}}>
                      {isExpanded ? "▼ Hide" : "▶ View Log"}
                    </span>
                  </div>
                </div>

                <div style={{
                  maxHeight: isExpanded ? "500px" : "0px",
                  overflow: "hidden",
                  transition: "max-height 0.3s ease-in-out",
                  backgroundColor: "#f9f9f9",
                  borderTop: isExpanded ? "1px solid #ddd" : "none"
                }}>
                  <div style={{padding: "10px"}}>
                    <pre style={{fontSize: "12px", whiteSpace: "pre-wrap", maxHeight: "400px", overflow: "auto", margin: 0, backgroundColor: "white", padding: "10px", border: "1px solid #ccc", borderRadius: "4px"}}>
                      {JSON.stringify(log, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
