const admin = require('firebase-admin');
const fs = require('fs');

//Initialize the admin SDK (pointing to the local emulator via FIRESTORE_EMULATOR_HOST)
//For instance:
//process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
//admin.initializeApp();

//Use a function to load the JSON
async function loadLocalJson() {
  const db = admin.firestore();

  //read your JSON file (wherever it’s located)
  const rawData = fs.readFileSync('test-data.json', 'utf-8');
  const logs = JSON.parse(rawData);

  //Suppose logs is an array of objects that each has
  //For each log, figure out the correct monthly bucket docId
  for (const log of logs) {
    const date = new Date(log.timestamp);
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const bucketId = `${months[date.getMonth()]}${date.getFullYear()}`;


    await db
      .collection('tracking_month')
      .doc(bucketId)
      .collection('logs')
      .doc(log.id)
      .set(log);
  }

  console.log('Finished loading data!');
}

loadLocalJson().then(() => process.exit(0));

