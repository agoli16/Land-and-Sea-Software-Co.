import React, { useContext, useState } from "react"
import { ref, get, query, orderByChild, equalTo, update, set, startAt, endAt } from "firebase/database"
import { httpsCallable } from "firebase/functions"

import { useOrganization } from "./OrganizationContext"

const AppUsersContext = React.createContext()

export function useAppUsers() {
  return useContext(AppUsersContext)
}

export function AppUsersProvider({ children }) {
  const { orgDB, orgFunctions, makeid } = useOrganization()


  // USE THIS FUNCTION TO CALL THE ENDPOINT
  //modified by Gavin on 4/3 and 4/4 2025
  
  function getLogsForUser(uid, startTimestamp, endTimestamp, completion) {
    let getLogs = httpsCallable(orgFunctions, 'userGetLogsInDaterange')
    getLogs({
      // params
      uid: uid,
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
    })
    .then((result) => {
      let logs = result.data?.logs
      let error = result.data?.error
      if (error) {
        completion(null, error)
      } else {
        logs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
        completion(logs,null)
      }
      // return to the completion function, which should be called from the UserCards_Logs file
    })
    .catch((err) => {
      completion(null,err)
    })
  }

  function retreiveAppUsers(completion) {
    const usersRef = ref(orgDB, 'users')
    get(usersRef).then((snapshot) => {
      const data = snapshot.val()
      let users = {}
      if (data !== null) {
        let keys = Object.keys(data)
        keys.forEach(function(k) {
          users[k] = data[k]
        })
      }
      completion(users)
    })
  }

  function searchForAppUsers(searchValue, completion) {
    let cleansedSearchValue = searchValue.trim().toLowerCase()
    const refName = query(
      ref(orgDB, 'users'), 
      orderByChild("name_lower"),
      startAt(cleansedSearchValue),
      endAt(cleansedSearchValue + "\uf8ff")
    )
    get(refName).then((snapshot) => {
      let userResults = {}
      const dataFromName = snapshot.val()

      console.log(dataFromName)
      
      if (dataFromName !== null) {
        let keysFromName = Object.keys(dataFromName)
        keysFromName.forEach(function(k) {
          userResults[k] = dataFromName[k]
        })
      }

      const refEmail = query(
        ref(orgDB, 'users'), 
        orderByChild("email"),
        startAt(cleansedSearchValue),
        endAt(cleansedSearchValue + "\uf8ff")
      )
      get(refEmail).then((snapshot2) => {
        const dataFromEmail = snapshot2.val()
        if (dataFromEmail !== null) {
          let keysFromEmail = Object.keys(dataFromEmail)
          keysFromEmail.forEach(function(k) {
            let user = dataFromEmail[k]
            if (user.type !== "wganon") {
              userResults[k] = user
            }
          })
        }

        completion(userResults)
      })
    })
  }

  function searchForAppUserById(searchId, completion) {
    let cleansedSearchValue = searchId.trim()
    const userQuery = query(ref(orgDB, 'users'), orderByChild("uid"), equalTo(cleansedSearchValue))
    get(userQuery).then((snapshot) => {
      let userResults = {}

      const data = snapshot.val()
      if (data !== null) {
        let uids = Object.keys(data)
        uids.forEach(function(uid) {
          let user = data[uid]
          if (user.type !== "wganon") {
            userResults[uid] = user
          }
        })
      }

      completion(userResults)
    })
  }

  function updateAppUser(user, simpleId, completion) {
    const longKey = makeid(simpleId === false || simpleId === undefined ? 20 : 12)
    const userRef = ref(orgDB, `users/${user.uid || longKey}`)

    if (user.uid === undefined) {
      user.uid = longKey
    }

    let timestamp = (new Date()).getTime()
    user.lastUpdated = timestamp

    update(userRef, user).then(function() {
      completion(user)
    }).catch(function(error) {
      console.log(error)
      completion(undefined, "There was a problem updating the user")
    })
  }

  function checkUserExistance(email, completion) {
    const userQuery = query(ref(orgDB, 'users'), orderByChild('email'), equalTo(email))
    get(userQuery).then((snapshot) => {
      if (snapshot.exists()) {
        completion(undefined)
      } else {
        completion(snapshot)
      }
    }).catch((error) => {
      console.error(error)
    })
  }

  function retreiveAppUserSchema(completion) {
    const schemaRef = ref(orgDB, 'userSchema')
    get(schemaRef).then((snapshot) => {
      const data = snapshot.val()
      completion(data)
    })
  }

  function updateAppUserSchema(schema, completion) {
    let timestamp = (new Date()).getTime()
    schema.lastUpdated = timestamp

    const schemaRef = ref(orgDB, 'userSchema')
    update(schemaRef, schema).then(function() {
      set(ref(orgDB, "appConfigs/userSchema"), schema)
      completion(schema)
    }).catch(function(error) {
      console.log(error)
      completion(undefined, "There was a problem updating your user schema details")
    })
  }

  const value = {
    retreiveAppUsers,
    searchForAppUsers,
    searchForAppUserById,
    updateAppUser,
    checkUserExistance,
    retreiveAppUserSchema,
    updateAppUserSchema,
    getLogsForUser
  }

  return (
    <AppUsersContext.Provider value={value}>
      {children}
    </AppUsersContext.Provider>
  )
}