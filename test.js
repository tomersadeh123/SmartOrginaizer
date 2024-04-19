const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const cors = require('cors'); // Import cors

const app = express();
const PORT = process.env.PORT || 3000;

// CORS options
const corsOptions = {
  origin: '*', // Allow requests from any origin
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

// Apply the CORS middleware
app.use(cors(corsOptions));

// ... (the rest of your code remains the same) ...
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const USERS_DATA_PATH = path.join(__dirname, 'users.json'); // Path to store user data
// Array to store events
const eventsArray = [];

// Middleware to parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.error('Error loading saved credentials:', err.message);
    return null;
  }
}

async function saveCredentials(client) {
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
    await fs.writeFile(TOKEN_PATH, payload);
    console.log('Credentials saved successfully.');
  } catch (err) {
    console.error('Error saving credentials:', err.message);
  }
}

async function authorize() {
  try {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
    }
    return client;
  } catch (err) {
    console.error('Authorization error:', err.message);
    throw err;
  }
}


// Route handler for user registration
app.post('/register', async (req, res) => {
  try {
    // Extract user data from request body
    const {username, email, password} = req.body;

    // Read existing user data
    let usersData = [];
    try {
      const data = await fs.readFile(USERS_DATA_PATH, 'utf8');
      usersData = JSON.parse(data);
    } catch (error) {
      // Ignore if the file doesn't exist or is empty
    }

    // Check if the email is already registered
    const existingUser = usersData.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Add new user to the array
    const newUser = {username, email, password};
    usersData.push(newUser);

    // Write updated user data to the file
    await fs.writeFile(USERS_DATA_PATH, JSON.stringify(usersData, null, 2));

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
async function listEvents(auth) {
  try {
    console.log('y'); // Corrected typo
    const calendar = google.calendar({ version: 'v3', auth });
    console.log('y');
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = res.data.items;
    if (!events || events.length === 0) {
      return 'No upcoming events found.';
    }

    const eventDetails = events.map((event, i) => {
      const start = event.start.dateTime || event.start.date;
      return `${start} - ${event.summary}`;
    });
    return eventDetails.join('\n');
  } catch (err) {
    console.error('Error listing events:', err.message);
    throw err;
  }
}

// Route handler for retrieving events
app.get('/events', async (req, res) => {
  try {
    const auth = await authorize();
    const eventsText = await listEvents(auth);
    res.send(eventsText);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).send('Error fetching events');
  }
});


// Route handler for user login
app.post('/login', async (req, res) => {
  try {
    const { username, password, calendarToken } = req.body;

    // Read user data from the file
    const usersData = JSON.parse(await fs.readFile(USERS_DATA_PATH, 'utf8'));

    // Find the user with the provided username and password
    const user = usersData.find(user => user.username === username && user.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify the provided calendarToken
    if (user.calendarToken !== calendarToken) {
      return res.status(401).json({ error: 'Invalid Google Calendar token' });
    }

    // User is authenticated
    // You can generate a session or token and send it back in the response
    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route handler for initiating the Google OAuth flow
app.get('/auth/google', async (req, res) => {
  try {
    const authUrl = await generateAuthUrl();
    res.redirect(authUrl);
  } catch (err) {
    console.error('Error generating auth URL:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route handler for handling the callback from Google after the user grants permission
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await getAccessTokenFromCode(code);

    // Store the tokens (access token and refresh token) securely for the user
    // You can store them in a database or a file, associated with the user

    res.redirect('/'); // Redirect to your application's main page
  } catch (err) {
    console.error('Error obtaining access token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function generateAuthUrl() {
  const oauth2Client = new google.auth.OAuth2(
    'YOUR_CLIENT_ID',
    'YOUR_CLIENT_SECRET',
    'http://localhost:3000/auth/google/callback'
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  return authUrl;
}

async function getAccessTokenFromCode(code) {
  const oauth2Client = new google.auth.OAuth2(
    'YOUR_CLIENT_ID',
    'YOUR_CLIENT_SECRET',
    'http://localhost:3000/auth/google/callback'
  );

  const { tokens } = await oauth2Client.getToken(code);
  return { tokens };
}

// ... (existing routes and functions remain the same) ...

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});