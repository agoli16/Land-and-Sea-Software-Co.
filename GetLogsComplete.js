const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const { getFirestore, doc, setDoc } = require('firebase-admin/firestore')
let firestore = getFirestore();

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']; // define month abbreviations

function getBucketId(timestamp) {
  const date = new Date(timestamp);
  return `${months[date.getMonth()]}${date.getFullYear()}`;
}

function getBucketsInRange(startTimestamp, endTimestamp) {
  let buckets = [];
  const startDate = new Date(parseInt(startTimestamp));
  const endDate = new Date(parseInt(endTimestamp));

  console.log("date range", startDate, endDate);

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (current <= endDate) {
    buckets.push(getBucketId(current.getTime()));
    current.setMonth(current.getMonth() + 1);
  }
  return buckets;
}

function getUserLogsRecursive(uid, buckets, logss, response, startTimestamp, endTimestamp) {
  let month = buckets.shift();

  firestore.collection(`tracking_month__${month}`)
    .where("uid", "==", uid)
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (
          docData.timestamp >= parseInt(startTimestamp) &&
          docData.timestamp <= parseInt(endTimestamp)
        ) {
          logss.push(docData); // manually filter by timestamp
        }
      });

      if (buckets.length > 0) {
        getUserLogsRecursive(uid, buckets, logss, response, startTimestamp, endTimestamp);
      } else {
        console.log(logss);
        //response.send(logss);
      }
    })
    .catch((error) => {
      console.log(error);
      response.send({});
    });
}

exports.getLogsForUserInDaterange = onRequest((request, response) => {
  console.log(request.body);
  const { uid, startTimestamp, endTimestamp } = request.body;

  if (!uid || !startTimestamp || !endTimestamp) {
    return response.status(400).json({ error: "missing required parameters: uid, startTimestamp, endTimestamp" });
  }

  const buckets = getBucketsInRange(startTimestamp, endTimestamp);
  console.log(buckets);

  let logss = [];
  getUserLogsRecursive(uid, buckets, logss, response, startTimestamp, endTimestamp);
});
