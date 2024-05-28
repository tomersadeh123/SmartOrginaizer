const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authorize, listEvents } = require('./googleApiUtils.js');

const USERS_DATA_PATH = path.join(__dirname, '../jsonFiles/users.json');

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
    const existingUser = usersData.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Add new user with events
    const newUser = {
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

// Route handler for user login
router.post('/login', async (req, res) => {
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
      const fetchedEvents = await listEvents(auth);

      // Filter out events that are already stored for the user
      const newEvents = fetchedEvents.filter((event) => {
        return !usersData[userIndex].events.some((storedEvent) => {
          return storedEvent.id === event.id; // Assuming each event has a unique ID
        });
      });

      // Update the user's events data with the new events
      usersData[userIndex].events.push(...newEvents);
    } catch (error) {
      console.error('Error fetching or processing events:', error);
      return res.status(500).json({ error: 'Error fetching events' });
    }

    // Write updated user data back to the file
    await fs.writeFile(USERS_DATA_PATH, JSON.stringify(usersData, null, 2));

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;