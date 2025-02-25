//define an array containing abbreviated month names to map month index to string.
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']; //define month abbreviations
//define a helper function that takes a timestamp and returns a bucket ID
function getBucketId(timestamp) { //function to compute bucket ID from a timestamp
  const date = new Date(timestamp); //convert the timestamp to a Date object
  return `${months[date.getMonth()]}${date.getFullYear()}`; //format the bucket ID using month abbreviation and full year
}
//define a helper function to calculate all bucket IDs between startTimestamp and endTimestamp.
function getBucketsInRange(startTimestamp, endTimestamp) { //function to get all bucket IDs in the provided range
  let buckets = []; //initialize an empty array to hold the bucket IDs
  const startDate = new Date(startTimestamp); //convert startTimestamp to a Date object
  const endDate = new Date(endTimestamp); //convert endTimestamp to a Date object
  //normalize the start date to the first day of its month.
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1); //set current to the first day of the start month
   //loop until the current date exceeds the end date.
  while (current <= endDate) { //while the current month is within the range
    buckets.push(getBucketId(current.getTime())); //add the bucket ID for the current month to the buckets array
    //move to the next month.
    current.setMonth(current.getMonth() + 1); //increment current month by one
  }
  return buckets; //return the array of bucket IDs covering the range
}