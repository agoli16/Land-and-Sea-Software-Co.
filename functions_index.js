const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
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
        console.log("Sending logs:", logss.length);
        response.json({ logs: logss });
      }
    })
    .catch((error) => {
      console.log("Error fetching logs:", error);
      response.status(500).json({ error: "Failed to fetch logs", logs: [] });
    });
}

// Callable function for frontend
exports.userGetLogsInDaterange = onCall({
  cors: true,
  timeoutSeconds: 300,
  memory: "512MiB"
}, async (request) => {
  const { uid, startTimestamp, endTimestamp } = request.data;
  
  console.log("Callable function called with:", { uid, startTimestamp, endTimestamp });

  if (!uid || startTimestamp === undefined || startTimestamp === null || endTimestamp === undefined || endTimestamp === null) {
    throw new HttpsError('invalid-argument', 'missing required parameters: uid, startTimestamp, endTimestamp');
  }

  try {
    const buckets = getBucketsInRange(startTimestamp, endTimestamp);
    console.log("Buckets to query:", buckets);

    let allLogs = [];

    // Query all buckets in parallel for faster results
    const queries = buckets.map(month => {
      console.log(`Querying collection: tracking_month__${month}`);
      return firestore.collection(`tracking_month__${month}`)
        .where("uid", "==", uid)
        .get()
        .then(snapshot => {
          const monthLogs = [];
          snapshot.forEach((doc) => {
            const docData = doc.data();
            if (
              docData.timestamp >= parseInt(startTimestamp) &&
              docData.timestamp <= parseInt(endTimestamp)
            ) {
              monthLogs.push(docData);
            }
          });
          return monthLogs;
        })
        .catch(err => {
          console.log(`Collection tracking_month__${month} might not exist or error:`, err.message);
          return [];
        });
    });

    // Wait for all queries to complete
    const results = await Promise.all(queries);
    allLogs = results.flat();

    console.log(`Found ${allLogs.length} logs for user ${uid}`);
    return { logs: allLogs };
    
  } catch (error) {
    console.error("Error fetching logs:", error);
    throw new HttpsError('internal', 'Failed to fetch logs');
  }
});

// Helper function to fetch 30-day analytics data
async function fetch30DayAnalytics(eventFilters = ['app.opened', 'app.broughtToForeground']) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);

  const startTimestamp = start.getTime();
  const endTimestamp = end.getTime();

  console.log("Fetching 30-day analytics from", start.toISOString(), "to", end.toISOString());

  let logss = [];

  // Query tracking_category__session_events collection
  let search = firestore.collection(`tracking_category__session_events`)
    .where('timestamp', '>=', parseInt(startTimestamp))
    .where('timestamp', '<=', parseInt(endTimestamp));

  const snapshot = await search.get();

  snapshot.forEach((doc) => {
    const docData = doc.data();
    // Filter by event types (app.opened, app.broughtToForeground)
    if (eventFilters.length === 0 || eventFilters.includes(docData.event)) {
      logss.push(docData);
    }
  });

  console.log(`Found ${logss.length} session events in last 30 days`);

  // Calculate unique users
  const uniqueUsers = new Set(logss.map((log) => log.uid));

  // Calculate platform distribution
  const usersByPlatform = {};
  logss.forEach(log => {
    const platform = log.appDetails?.platform;
    if (platform) {
      if (!usersByPlatform[platform]) {
        usersByPlatform[platform] = new Set();
      }
      usersByPlatform[platform].add(log.uid);
    }
  });

  const platformUserCounts = Object.fromEntries(
    Object.entries(usersByPlatform).map(([platform, usersSet]) => [platform, usersSet.size])
  );

  // Calculate daily unique users (total and by platform)
  const usersByDate = {};
  const usersByDateAndPlatform = {};

  logss.forEach(log => {
    const date = new Date(log.timestamp);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    const platform = log.appDetails?.platform;

    // Total daily users
    if (!usersByDate[dateKey]) {
      usersByDate[dateKey] = new Set();
    }
    usersByDate[dateKey].add(log.uid);

    // Daily users by platform
    if (platform) {
      if (!usersByDateAndPlatform[dateKey]) {
        usersByDateAndPlatform[dateKey] = {};
      }
      if (!usersByDateAndPlatform[dateKey][platform]) {
        usersByDateAndPlatform[dateKey][platform] = new Set();
      }
      usersByDateAndPlatform[dateKey][platform].add(log.uid);
    }
  });

  const dailyUniqueCounts = Object.fromEntries(
    Object.entries(usersByDate).map(([date, userSet]) => [date, userSet.size])
  );

  // Convert platform data to counts
  const dailyPlatformCounts = {};
  Object.entries(usersByDateAndPlatform).forEach(([date, platforms]) => {
    dailyPlatformCounts[date] = {};
    Object.entries(platforms).forEach(([platform, userSet]) => {
      dailyPlatformCounts[date][platform] = userSet.size;
    });
  });

  // Calculate version distribution (latest version per user)
  const userLatestVersions = {};
  logss.forEach(log => {
    const uid = log.uid;
    const versionRaw = log.appDetails?.appVersion || '';
    // Remove "build X" from version string
    const version = versionRaw.split(' ')[0].trim();
    const timestamp = log.timestamp;

    if (!userLatestVersions[uid] || userLatestVersions[uid].timestamp < timestamp) {
      userLatestVersions[uid] = { version, timestamp };
    }
  });

  // Count users per version
  const versionCounts = {};
  Object.values(userLatestVersions).forEach(({ version }) => {
    if (version) {
      versionCounts[version] = (versionCounts[version] || 0) + 1;
    }
  });

  // Now fetch app.view[viewId].viewed events from monthly collections
  console.log("Fetching view events from monthly tracking collections...");

  let viewLogs = [];

  // Get monthly buckets for the same 30-day period
  const viewBuckets = getBucketsInRange(startTimestamp, endTimestamp);
  console.log("View query buckets:", viewBuckets);

  // Query all monthly buckets in parallel for view events
  const viewQueries = viewBuckets.map(month => {
    console.log(`Querying collection tracking_month__${month} for view events`);
    return firestore.collection(`tracking_month__${month}`)
      .where('timestamp', '>=', parseInt(startTimestamp))
      .where('timestamp', '<=', parseInt(endTimestamp))
      .get()
      .then(snapshot => {
        const monthViewLogs = [];
        snapshot.forEach((doc) => {
          const docData = doc.data();
          // Check if event matches pattern app.view[viewId].viewed
          if (docData.event && docData.event.includes('app.view[') && docData.event.includes('].viewed')) {
            monthViewLogs.push(docData);
          }
        });
        return monthViewLogs;
      })
      .catch(err => {
        console.log(`Collection tracking_month__${month} might not exist or error:`, err.message);
        return [];
      });
  });

  // Wait for all view queries to complete
  const viewResults = await Promise.all(viewQueries);
  viewLogs = viewResults.flat();

  console.log(`Found ${viewLogs.length} matching view events in last 30 days`);

  // Extract viewIds and count occurrences
  const viewCounts = {};
  viewLogs.forEach(log => {
    // Extract viewId from event string like "app.view[viewId123].viewed"
    const match = log.event.match(/app\.view\[([^\]]+)\]\.viewed/);
    if (match && match[1]) {
      const viewId = match[1];
      viewCounts[viewId] = (viewCounts[viewId] || 0) + 1;
    }
  });

  const analyticsData = {
    dateRange: {
      start: new Date(startTimestamp).toISOString(),
      end: new Date(endTimestamp).toISOString()
    },
    totalUniqueUsers: uniqueUsers.size,
    dailyUniqueUsers: dailyUniqueCounts,
    dailyPlatformUsers: dailyPlatformCounts,
    platformDistribution: platformUserCounts,
    versionDistribution: versionCounts,
    viewDistribution: viewCounts,
    lastUpdated: new Date().toISOString()
  };

  return analyticsData;
}

// HTTP endpoint for analytics
exports.get30DayAnalytics = onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  console.log("Fetching 30-day analytics data...");

  try {
    const analyticsData = await fetch30DayAnalytics(['app.opened', 'app.broughtToForeground']);

    console.log("Analytics data fetched successfully");
    response.json(analyticsData);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    response.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// HTTP endpoint for testing with curl
exports.getLogsForUserInDaterange = onRequest(async (request, response) => {
  // Enable CORS
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  const { uid, startTimestamp, endTimestamp } = request.method === 'POST' ? request.body : request.query;
  
  console.log("HTTP endpoint called with:", { uid, startTimestamp, endTimestamp });

  if (!uid || !startTimestamp || !endTimestamp) {
    return response.status(400).json({ error: "missing required parameters: uid, startTimestamp, endTimestamp" });
  }

  try {
    const buckets = getBucketsInRange(startTimestamp, endTimestamp);
    console.log("Buckets to query:", buckets);

    let allLogs = [];
    let debugInfo = {
      bucketsQueried: [],
      collectionsFound: [],
      collectionsNotFound: [],
      totalDocumentsFound: 0,
      totalDocumentsInRange: 0
    };
    
    // Query all buckets sequentially
    for (const month of buckets) {
      debugInfo.bucketsQueried.push(month);
      console.log(`Querying collection: tracking_month__${month}`);
      
      try {
        const snapshot = await firestore.collection(`tracking_month__${month}`)
          .where("uid", "==", uid)
          .get();
        
        debugInfo.collectionsFound.push(month);
        debugInfo.totalDocumentsFound += snapshot.size;
        
        console.log(`Collection tracking_month__${month} has ${snapshot.size} documents for uid ${uid}`);
        
        snapshot.forEach((doc) => {
          const docData = doc.data();
          console.log(`Document timestamp: ${docData.timestamp}, Range: ${startTimestamp} - ${endTimestamp}`);
          
          if (
            docData.timestamp >= parseInt(startTimestamp) &&
            docData.timestamp <= parseInt(endTimestamp)
          ) {
            allLogs.push(docData);
            debugInfo.totalDocumentsInRange++;
          }
        });
      } catch (collectionError) {
        debugInfo.collectionsNotFound.push(month);
        console.log(`Collection tracking_month__${month} might not exist:`, collectionError.message);
        // Continue to next collection
      }
    }

    console.log(`Found ${allLogs.length} logs for user ${uid}`);
    response.json({ 
      logs: allLogs,
      debug: debugInfo,
      summary: {
        totalLogsFound: allLogs.length,
        requestParams: { uid, startTimestamp, endTimestamp },
        dateRange: {
          startDate: new Date(parseInt(startTimestamp)).toISOString(),
          endDate: new Date(parseInt(endTimestamp)).toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error("Error fetching logs:", error);
    response.status(500).json({ error: "Failed to fetch logs", details: error.message });
  }
});
