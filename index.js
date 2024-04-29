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

app.post('/calculate-free-time', async (req, res) => {
  try {
      const { username } = req.body;

      // Read the JSON data from the file
      let userData = await fs.readFile(USERS_DATA_PATH, 'utf8');
      let usersData = JSON.parse(userData);

      // Find the user with the provided username
      const userIndex = usersData.findIndex(user => user.username === username);
      if (userIndex === -1) {
          return res.status(404).json({ error: `User with username '${username}' not found` });
      }

      // Flatten the events array
      const allEvents = usersData[userIndex].events.flat();

      // Find the start and end dates for the week
      const currentDate = new Date();
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      // Calculate free time between events within the week
      const freeTime = [];
      let previousEventEnd = startOfWeek;
      for (const event of allEvents) {
          const currentEventStart = new Date(event.start.dateTime);
          if (currentEventStart >= endOfWeek) {
              break; // Stop processing events if we're past the end of the week
          }
          const timeDifference = currentEventStart.getTime() - previousEventEnd.getTime();
          if (timeDifference > 0) {
              freeTime.push({
                  start: previousEventEnd.toISOString(),
                  end: currentEventStart.toISOString(),
                  duration: timeDifference / (1000 * 60) // Convert milliseconds to minutes
              });
          }
          previousEventEnd = new Date(event.end.dateTime);
      }

      // Update user's freeTime property
      usersData[userIndex].freeTime = freeTime;

      // Write updated user data back to the file
      await fs.writeFile(USERS_DATA_PATH, JSON.stringify(usersData, null, 2));

      res.json({ freeTime });
  } catch (error) {
      console.error('Error reading or parsing users data:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

let groups = []; // Initialize groups array

// Load groups data asynchronously when server starts
fs.readFile('groups.json')
    .then(data => {
        if (data.length > 0) {
            groups = JSON.parse(data); // Parse JSON data
        }
    })
    .catch(err => {
        console.error('Error reading groups.json:', err);
    });

// Route to create a group
app.post('/groups', async (req, res) => {
  const { groupName } = req.body;

  // Check if groupName is provided
  if (!groupName) {
      return res.status(400).json({ error: 'Group name is required' });
  }

  try {
      // Load groups array from file
      const groupsData = await fs.readFile('groups.json');
      const groups = JSON.parse(groupsData);

      // Check if groupName already exists
      const groupExistsIndex = groups.findIndex(group => group.name === groupName);
      if (groupExistsIndex !== -1) {
          return res.status(400).json({ error: 'Group name already taken, please try another name' });
      }

      // If groupName is unique, push the new group into groups array
      groups.push({ name: groupName, users: [] });
      await saveGroupsToFile(groups);
      res.status(201).json({ message: 'Group created successfully' });
  } catch (error) {
      console.error('Error creating group:', error);
      res.status(500).json({ error: 'Failed to create group' });
  }
});


// Route to add a user to a group
app.post('/groups/:groupName/users', (req, res) => {
    const { groupName } = req.params;
    const { email } = req.body;
    const group = groups.find(group => group.name === groupName);
    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }
    if (!email) {
        return res.status(400).json({ error: 'Username is required' });
    }
    group.users.push(email);
    saveGroupsToFile();
    res.status(201).json({ message: 'User added to group successfully' });
});

// Function to save groups data to groups.json
async function saveGroupsToFile(groups) {
  try {
      await fs.writeFile('groups.json', JSON.stringify(groups, null, 2));
      console.log('Groups data saved to groups.json');
  } catch (error) {
      console.error('Error saving groups data to groups.json:', error);
      throw error; // Re-throw the error to be caught by the caller
  }
}


  
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});