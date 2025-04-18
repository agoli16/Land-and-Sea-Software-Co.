const functions = require("firebase-functions");
const admin = require("firebase-admin");https://github.com/agoli16/Land-and-Sea-Software-Co./tree/main


admin.initializeApp();
const db = admin.firestore();

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");


const { getFirestore, doc, setDoc  } = require('firebase-admin/firestore')
let firestore = getFirestore()

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']; //define month abbreviations.



function getBucketId(timestamp) { //function to compute bucket id from a timestamp.
    const date = new Date(timestamp); //convert the timestamp to a date object.
    return `${months[date.getMonth()]}${date.getFullYear()}`; //format the bucket id using month abbreviation and full year.
}

function getBucketsInRange(startTimestamp, endTimestamp) { //function to get all bucket ids in the provided range.
    let buckets = []; //initialize an empty array to hold the bucket ids.
    const startDate = new Date(parseInt(startTimestamp)); //convert starttimestamp to a date object.
    const endDate = new Date(parseInt(endTimestamp)); //convert endtimestamp to a date object.

    console.log("date range", startDate, endDate)


    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1); //set current to the first day of the start month.
    while (current <= endDate) { //while the current month is within the range.
        buckets.push(getBucketId(current.getTime())); //add the bucket id for the current month to the buckets array.
        current.setMonth(current.getMonth() + 1); //increment current month by one.
    }
    return buckets; //return the array of bucket ids covering the range.
}

function getUserLogsRecursive(uid, buckets,logss, response, startTimestamp, endTimestamp) {
  let month = [];
  month = buckets.shift(); 
  firestore.collection(`tracking_month__${month}`)
    .where("uid", "==", uid) //filter logs to match the provided uid.
    .where("timestamp", ">=", parseInt(startTimestamp)) // filter logs to be within time zone
    .where("timestamp", "<=", parseInt(endTimestamp))
    .get().then((snapshot) =>{
      snapshot.forEach((doc)=>{
       logss.push(doc.data()); //adds each log to array of logs
      })
       if (buckets.length > 0) { 
         getUserLogsRecursive(uid, buckets, logss, response, startTimestamp, endTimestamp); 
       } else {
         console.log(logss);
         response.send(logss);
       }
       return
    })

    .catch((error)=>{
      console.log(error)
      response.send({})
      return
    })
  
}

exports.getLogsForUserInDaterange = onRequest((request, response) => {
  console.log(request.body)
  const { uid, startTimestamp, endTimestamp } = request.body; //extract uid, starttimestamp, and endtimestamp from the request body.
    if (!uid || !startTimestamp || !endTimestamp) { //check if any parameter is missing.
        return response.status(400).json({ error: "missing required parameters: uid, startTimestamp, endTimestamp" }); //return a 400 error if parameters are missing.
    }

    const buckets = getBucketsInRange(startTimestamp, endTimestamp); //calculate buckets based on timestamps.

    console.log(buckets)
    let logss = [];
    getUserLogsRecursive(uid, buckets, logss, response, startTimestamp, endTimestamp);
   
    
})
