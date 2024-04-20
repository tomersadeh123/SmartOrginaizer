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


app.post('/register', async (req, res) => {
  try {
    const { username, email, password} = req.body;

    // Read existing user data
    let usersData = [];
    try {
      const data = await fs.readFile(USERS_DATA_PATH, 'utf8');
      usersData = JSON.parse(data);
    } catch (error) {
      // Ignore if the file doesn't exist or is empty
    }

    // Check for existing user
    const existingUser = usersData.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Add new user with events
    const newUser = {
      username,
      email,
      password,
      events:[]
    };
    usersData.push(newUser);

    // Write updated user data to the file
    await fs.writeFile(USERS_DATA_PATH, JSON.stringify(usersData, null, 2));

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route handler for retrieving events
// Route handler for retrieving events
app.get('/events', async (req, res) => {
  try {
    const auth = await authorize();
    const events = await listEvents(auth);

    // Convert events data to JSON string
    const eventsJSON = JSON.stringify(events);

    res.json({ events: eventsJSON }); // Send events data as a JSON string
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Error fetching events' });
  }
});



// Route handler for user login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Read user data from the file
    let usersData = JSON.parse(await fs.readFile(USERS_DATA_PATH, 'utf8'));

    // Find the user with the provided username and password
    const userIndex = usersData.findIndex(
      (user) => user.username === username && user.password === password
    );
    if (userIndex === -1) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // User is authenticated
    // Fetch events from API (assuming listEvents returns events data)
    try {
      const auth = await authorize();
      events = await listEvents(auth);
    } catch (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ error: 'Error fetching events' });
    }

    // Update the user's events data with the fetched events
    usersData[userIndex].events.push(events)

    // Write updated user data back to the file
    await fs.writeFile(USERS_DATA_PATH, JSON.stringify(usersData, null, 2));

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});