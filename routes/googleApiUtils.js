const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

// Path to your service account JSON key file
const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'credentials.json');

// Scopes for accessing the Google Calendar API
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

/**
 * Authorize using service account credentials.
 * @returns {google.auth.JWT} The authenticated JWT client.
 */
async function authorize() {
    try {
        // Load service account credentials
        const content = await fs.readFile(SERVICE_ACCOUNT_PATH);
        const credentials = JSON.parse(content);

        // Create JWT client using service account credentials
        const jwtClient = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            SCOPES
        );

        // Return the authenticated JWT client
        await jwtClient.authorize();
        console.log('Successfully authenticated using service account.');
        return jwtClient;
    } catch (err) {
        console.error('Authorization error:', err.message);
        throw err;
    }
}


/**
 * List events from the Google Calendar API.
 * @param {google.auth.JWT} auth The authenticated JWT client.
 * @returns {Array} The list of events.
 */
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

module.exports = {
    authorize,
    listEvents,
};
