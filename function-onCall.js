exports.userGetLogsInDaterange = onCall(async (request, context) => {
  const { uid, startTimestamp, endTimestamp } = request.data

  console.log(uid, startTimestamp, endTimestamp)

  // Validate required parameters
  if (!startTimestamp || !endTimestamp) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: startTimestamp, endTimestamp')
  }

  try {
    // Convert callback-based function to Promise
    const logs = await new Promise((resolve, reject) => {
      Tracking.getLogsForUserInDaterange(uid, startTimestamp, endTimestamp, (logs, error) => {
        if (error) {
          reject(error)
        } else {
          resolve(logs)
        }
      });
    });

    return { logs }
  } catch (error) {
    console.error(error)
    throw new functions.https.HttpsError('internal', 'An error occurred while fetching logs')
  }
})