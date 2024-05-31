const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Path to the users JSON file
const USERS_JSON_PATH = path.join(process.cwd(), 'jsonFiles', 'users.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// Load saved credentials if they exist
async function loadSavedCredentialsIfExist(username) {
  const tokenPath = path.join(process.cwd(), `token-${username}.json`);
  try {
    const content = await fs.readFile(tokenPath);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.error(`Error loading saved credentials for user ${username}:`, err.message);
    return null;
  }
}

// Save credentials for future use
async function saveCredentials(username, client) {
  const tokenPath = path.join(process.cwd(), `token-${username}.json`);
  try {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(tokenPath, payload);
    console.log(`Credentials saved successfully for user ${username}.`);
  } catch (err) {
    console.error(`Error saving credentials for user ${username}:`, err.message);
  }
}

// Authorize a user
async function authorize(username) {
  try {
    let client = await loadSavedCredentialsIfExist(username);
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(username, client);
    }
    return client;
  } catch (err) {
    console.error(`Authorization error for user ${username}:`, err.message);
    throw err;
  }
}

// Insert an event into the user's calendar
async function insertEvent(auth, event) {
  const calendar = google.calendar({ version: 'v3', auth });
  return new Promise((resolve, reject) => {
    // Check if start and end times are provided and are strings
    if (
      typeof event.start !== 'string' ||
      typeof event.end !== 'string' ||
      !event.end.trim()
    ) {
      reject(new Error('Invalid start or end time'));
      return;
    }

    const eventStartTime = new Date(event.start);
    const eventEndTime = new Date(event.end);

    const calendarEvent = {
      summary: event.suggestion,
      start: {
        dateTime: eventStartTime,
        timeZone: 'Asia/Jerusalem', // Time zone set to Israel
      },
      end: {
        dateTime: eventEndTime,
        timeZone: 'Asia/Jerusalem', // Time zone set to Israel
      },
    };

    calendar.events.insert(
      {
        auth,
        calendarId: 'primary',
        resource: calendarEvent,
      },
      (err, event) => {
        if (err) {
          console.log('There was an error contacting the Calendar service: ' + err);
          reject(err);
        } else {
          console.log('Event created: %s', event.data.htmlLink);
          resolve(event.data.htmlLink);
        }
      }
    );
  });
}

// List events from the user's calendar
async function listEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = response.data.items;
  return events;
}

// Get users from the JSON file
async function getUsers() {
  try {
    const content = await fs.readFile(USERS_JSON_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading users JSON file:', err.message);
    throw err;
  }
}

// Export the functions
module.exports = {
  loadSavedCredentialsIfExist,
  saveCredentials,
  authorize,
  insertEvent,
  listEvents,
  getUsers,
};
