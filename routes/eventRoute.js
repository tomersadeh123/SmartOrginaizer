const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const { authorize, listEvents } = require('./googleApiUtils');
const moment = require('moment-timezone');

const USERS_DATA_PATH = path.join(__dirname, '../jsonFiles/users.json');
// Array to store events
const eventsArray = [];


/* event route to fetch evetns */
router.get('/events', async (req, res) => {
    try {
      const auth = await authorize();
      const fetchedEvents = await listEvents(auth);
  
      // Get the current date and time in the Israel/Jerusalem time zone
      const israelTimezone = 'Asia/Jerusalem';
      const currentDate = moment().tz(israelTimezone);
      const startOfWeek = currentDate.clone().startOf('isoWeek');
      const endOfWeek = startOfWeek.clone().endOf('isoWeek');
  
      // Filter out events that occur within the current week
      const eventsThisWeek = fetchedEvents.filter(event => {
        const eventTime = moment(event.start.dateTime).tz(israelTimezone);
        return eventTime.isBetween(startOfWeek, endOfWeek, null, '[]');
      });
  
      res.json({ events: eventsThisWeek });
    } catch (err) {
      console.error('Error fetching events:', err);
      res.status(500).json({ error: 'Error fetching events', details: err.message });
    }
  });




router.post('/calculate-free-time', async (req, res) => {
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

    // Get the current date and time in the Israel/Jerusalem time zone
    const israelTimezone = 'Asia/Jerusalem';
    const currentDate = moment().tz(israelTimezone);
    const startOfWeek = currentDate.clone().startOf('day');
    const endOfWeek = startOfWeek.clone().add(1, 'week');

    // Filter out events that occur within the next week
    const eventsThisWeek = allEvents.filter(event => {
      const eventTime = moment(event.start.dateTime).tz(israelTimezone);
      return eventTime.isBetween(startOfWeek, endOfWeek, null, '[]');
    });

    // Calculate free time between future events
    const freeTime = [];
    let previousEventEnd = startOfWeek.hours(7);

    for (const event of eventsThisWeek) {
      const currentEventStart = moment(event.start.dateTime).tz(israelTimezone);
      const timeDifference = currentEventStart.diff(previousEventEnd, 'minutes');

      let adjustedPreviousEventEnd = previousEventEnd.clone();
      let adjustedCurrentEventStart = currentEventStart.clone();

      // Adjust times to fall within the 7 AM to 9 PM range
      adjustedPreviousEventEnd = adjustTimes(adjustedPreviousEventEnd, startOfWeek, endOfWeek);
      adjustedCurrentEventStart = adjustTimes(adjustedCurrentEventStart, startOfWeek, endOfWeek);

      if (timeDifference > 0 && adjustedCurrentEventStart.isAfter(adjustedPreviousEventEnd)) {
        freeTime.push({
          start: adjustedPreviousEventEnd.format('YYYY-MM-DDTHH:mm:ss'),
          end: adjustedCurrentEventStart.format('YYYY-MM-DDTHH:mm:ss'),
          duration: timeDifference
        });
      }

      previousEventEnd = moment(event.end.dateTime).tz(israelTimezone);
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

function adjustTimes(time, startOfWeek, endOfWeek) {
  if (time.isBefore(startOfWeek.hours(7))) {
    return startOfWeek.clone().hours(7);
  } else if (time.isAfter(endOfWeek.hours(7))) {
    return endOfWeek.clone().hours(21);
  } else if (time.isAfter(time.clone().startOf('day').hours(21))) {
    return time.clone().add(1, 'day').hours(7);
  } else {
    return time;
  }
}

module.exports = router;







