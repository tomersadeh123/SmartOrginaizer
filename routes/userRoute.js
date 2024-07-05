const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { authorize, listEvents, loadSavedCredentialsIfExist, saveCredentials, insertEvent, getUsers } = require('./googleApiUtils.js');
const USERS_DATA_PATH = path.join(__dirname, '../jsonFiles/users.json');

//Function to read the users.json file
async function readUsersFile() {
  try {
    const data = await fs.readFile(USERS_DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    throw error;
  }
}

// Function to calculate the duration of a time slot in minutes
function calculateDuration(start, end) {
  const startTime = new Date(start);
  const endTime = new Date(end);
  const durationInMilliseconds = endTime.getTime() - startTime.getTime();
  return Math.floor(durationInMilliseconds / (1000 * 60));
}

router.post('/Suggestions', async (req, res) => {
  try {
    const { username } = req.body;

    // Read users file
    const users = await readUsersFile();

    // Find user's free time slots
    const user = users.find(user => user.username === username);
    const freeTimeSlots = user ? user.freeTime : [];

    // Create an array to store the activity suggestions
    let suggestions = [];

    // Iterate over the free time slots
    for (const slot of freeTimeSlots) {
      const duration = calculateDuration(slot.start, slot.end);
      const suggestionsForSlot = [];

      // Suggest activities based on the duration
      if (duration <= 15) { // For 15 minutes
        suggestionsForSlot.push('Take a short break');
        suggestionsForSlot.push('Do some quick breathing exercises');
      } else if (duration <= 30) { // For 30 minutes
        suggestionsForSlot.push('Take a short walk');
        suggestionsForSlot.push('Do some stretching exercises');
        suggestionsForSlot.push('Read a few pages of a book');
      } else if (duration <= 45) { // For 45 minutes
        suggestionsForSlot.push('Listen to a podcast episode');
        suggestionsForSlot.push('Meditate or practice mindfulness');
        suggestionsForSlot.push('Do a quick workout');
      } else if (duration <= 60) { // For 1 hours
        suggestionsForSlot.push('Go for a jog or a bike ride');
        suggestionsForSlot.push('Practice a hobby or skill');
        suggestionsForSlot.push('Cook a healthy meal');
      } else if (duration <= 90) { // For 1.5 hours
        suggestionsForSlot.push('Watch an episode of a TV show');
        suggestionsForSlot.push('Visit a nearby park');
        suggestionsForSlot.push('Do a creative project');
      } else if (duration <= 120) { // For 2 hours
        suggestionsForSlot.push('Watch a movie or a TV show');
        suggestionsForSlot.push('Visit a nearby attraction');
        suggestionsForSlot.push('Do a thorough workout');
      } else if (duration <= 240) { // For 4 hours
        suggestionsForSlot.push('Go on a hike');
        suggestionsForSlot.push('Take a time to study and learn something new');
        suggestionsForSlot.push('Attend a cultural event or exhibition');
      } else { // For whole day
        suggestionsForSlot.push('Plan a day trip or an outdoor activity');
        suggestionsForSlot.push('Start a long-term project');
        suggestionsForSlot.push('Take a day off for self-care and relaxation');
      }

      // Push the suggestions along with the start and end times to the array
      suggestions.push(...suggestionsForSlot.map(suggestion => ({
        start: slot.start,
        end: slot.end,
        suggestion: suggestion
      })));
    }

    // Respond with the activity suggestions
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Read existing user data
    let usersData = [];
    try {
      const data = await fs.readFile(USERS_DATA_PATH, 'utf8');
      usersData = JSON.parse(data);
    } catch (error) {
      // Ignore if the file doesn't exist or is empty
    }

    // Check for existing user
    const existingUserEmail = usersData.find(user => user.email === email);
    if (existingUserEmail) {
      return res.status(400).json({ error: 'Email is already registered' });
    }
    // Check for existing user by username
    const existingUser = usersData.find(user => user.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already registered' });
    }

     // Add new user with user ID and events
     const newUser = {
      id: uuidv4(),  // Generate a unique ID for the user
      username,
      email,
      password,
      events: [],
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

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Read user data from the file
    let usersData = JSON.parse(await fs.readFile(USERS_DATA_PATH, 'utf8'));

    // Find the user with the provided username and password
    const user = usersData.find(
      (user) => user.username === username && user.password === password
    );
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // User is authenticated
    let eventsFetched = false;
    try {
      const auth = await authorize(username);
      if (auth) {
        const fetchedEvents = await listEvents(auth);

        // Filter out events that are already stored for the user
        const newEvents = fetchedEvents.filter((event) => {
          return !user.events.some((storedEvent) => {
            return storedEvent.id === event.id; // Assuming each event has a unique ID
          });
        });

        // Update the user's events data with the new events
        user.events.push(...newEvents);
        eventsFetched = true;
      }
    } catch (error) {
      console.error('Error fetching or processing events:', error);
    }

    // Write updated user data back to the file
    await fs.writeFile(USERS_DATA_PATH, JSON.stringify(usersData, null, 2));

    if (eventsFetched) {
      res.status(200).json({ message: 'Login successful', username: user.username });
    } else {
      res.status(200).json({ message: 'Login successful but events not fetched', username: user.username });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/AddEvent', async (req, res) => {
  const { username, event } = req.body;
  if (!username || !event) {
      return res.status(400).send('Username and event are required');
  }

  try {
      let auth = await authorize(username);
      if (!auth) {
          // Prompt user to authorize
          auth = await authenticate({
              scopes: SCOPES,
              keyfilePath: CREDENTIALS_PATH,
          });
          if (auth.credentials) {
              await saveCredentials(username, auth);
          }
      }

      // Add event to Google Calendar
      await insertEvent(auth, event);

      // Add event to user's events array in users.json
      await updateUserEvents(username, event);

      res.status(200).send({ message: 'Event added successfully' });
  } catch (error) {
      console.error(`Error adding event for user ${username}:`, error.message);
      res.status(500).send('Failed to add event');
  }
});

async function updateUserEvents(username, event) {
  try {
      const userData = await fs.readFile(USERS_DATA_PATH, 'utf8');
      const users = JSON.parse(userData);

      // Find the user by username and update events array
      const user = users.find(user => user.username === username);
      if (user) {
          user.events.push(event);
          await fs.writeFile(USERS_DATA_PATH, JSON.stringify(users, null, 2));
          console.log(`Event added to user ${username}'s events.`);
      } else {
          console.error(`User ${username} not found.`);
      }
  } catch (error) {
      console.error('Error updating user events:', error);
      throw error;
  }
}
// users.js

router.post('/updateEvents', async (req, res) => {
  const { username } = req.query;
  try {
    // Fetch user events from Google Calendar
    const auth = await authorize(username);
    const fetchedEvents = await listEvents(auth);

    // Update user's events data with the new events
    let usersData = JSON.parse(await fs.readFile(USERS_DATA_PATH, 'utf8'));
    const user = usersData.find(user => user.username === username);
    user.events = fetchedEvents;

    // Write updated user data back to the file
    await fs.writeFile(USERS_DATA_PATH, JSON.stringify(usersData, null, 2));

    res.status(200).json({ message: 'Events updated successfully' });
  } catch (error) {
    console.error('Error updating events:', error);
    res.status(500).json({ error: 'Failed to update events' });
  }
});



module.exports = router;