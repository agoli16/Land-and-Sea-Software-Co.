const express = require('express'); //import the express framework for building web applications.
const admin = require('firebase-admin'); //import the firebase admin sdk to interact with firestore.
const router = express.Router(); //create a new express router instance to define our endpoint.
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']; //define month abbreviations.

function getBucketId(timestamp) { //function to compute bucket id from a timestamp.
    const date = new Date(timestamp); //convert the timestamp to a date object.
    return `${months[date.getMonth()]}${date.getFullYear()}`; //format the bucket id using month abbreviation and full year.
}

function getBucketsInRange(startTimestamp, endTimestamp) { //function to get all bucket ids in the provided range.
    let buckets = []; //initialize an empty array to hold the bucket ids.
    const startDate = new Date(startTimestamp); //convert starttimestamp to a date object.
    const endDate = new Date(endTimestamp); //convert endtimestamp to a date object.
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1); //set current to the first day of the start month.
    while (current <= endDate) { //while the current month is within the range.
        buckets.push(getBucketId(current.getTime())); //add the bucket id for the current month to the buckets array.
        current.setMonth(current.getMonth() + 1); //increment current month by one.
    }
    return buckets; //return the array of bucket ids covering the range.
}

router.post('/logs', async (req, res) => { //create a post endpoint for '/logs'.
    const { uid, startTimestamp, endTimestamp } = req.body; //extract uid, starttimestamp, and endtimestamp from the request body.
    if (!uid || !startTimestamp || !endTimestamp) { //check if any parameter is missing.
        return res.status(400).json({ error: "missing required parameters: uid, startTimestamp, endTimestamp" }); //return a 400 error if parameters are missing.
    }
    const buckets = getBucketsInRange(startTimestamp, endTimestamp); //calculate buckets based on timestamps.
    const db = admin.firestore(); //initialize firestore reference.
    let logs = []; //prepare an array to store the logs.
    try { //begin try block to catch errors during database operations.
        for (let bucketId of buckets) { //loop through each calculated bucket id.
            const logsRef = db.collection("tracking_month").doc(bucketId).collection("logs"); //reference the logs subcollection in the current bucket.
            const snapshot = await logsRef //start building the query on the logs collection.
                .where("uid", "==", uid) //filter logs to match the provided uid.
                .where("timestamp", ">=", startTimestamp) //ensure log timestamp is on or after starttimestamp.
                .where("timestamp", "<=", endTimestamp) //ensure log timestamp is on or before endtimestamp.
                .get(); //execute the query and retrieve a snapshot of matching documents.
            snapshot.forEach(doc => { //iterate through each document in the snapshot.
                logs.push(doc.data()); //add the document's data to the logs array.
            });
        }
        logs.sort((a, b) => a.timestamp - b.timestamp); //sort the aggregated logs by timestamp in ascending order.
        return res.json({ logs }); //respond with the sorted list of logs in json format.
    } catch (error) { //catch any errors that occur during the querying process.
        console.error("error querying logs:", error); //log the error to the console for debugging.
        return res.status(500).json({ error: "internal server error" }); //return a 500 error response if something goes wrong.
    }
});

module.exports = router; //export the router module.


