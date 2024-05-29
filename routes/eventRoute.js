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

    // Filter out events that start from the current date and have not ended
    const futureEvents = allEvents.filter(event => {
      const eventStartDate = moment(event.start.dateTime).tz(israelTimezone).startOf('day');
      const currentDateStart = currentDate.clone().startOf('day');
      const eventEndTime = moment(event.end.dateTime).tz(israelTimezone);
      return eventStartDate.isSameOrAfter(currentDateStart) && eventEndTime.isAfter(currentDate);
    });

    // Calculate free time between future events for each day
    const freeTime = [];
    let currentDayStart = currentDate.clone().startOf('day').hours(7);
    let currentDayEnd = currentDayStart.clone().add(1, 'day').hours(21);
    let previousEventEnd = currentDate.isAfter(currentDayStart) ? currentDate : currentDayStart;

    for (const event of futureEvents) {
      const currentEventStart = moment(event.start.dateTime).tz(israelTimezone);
    
      // Adjust currentDayStart and currentDayEnd based on current event's start time
      if (currentEventStart.isAfter(currentDayEnd)) {
        currentDayStart = currentEventStart.clone().startOf('day').hours(7);
        currentDayEnd = currentDayStart.clone().add(1, 'day').hours(21);
      }
    
      const timeDifference = currentEventStart.diff(previousEventEnd, 'minutes');
    
      if (currentEventStart.isBefore(currentDayEnd)) {
        if (timeDifference > 0 && currentEventStart.isAfter(previousEventEnd)) {
          freeTime.push({
            start: previousEventEnd.format('YYYY-MM-DDTHH:mm:ss'),
            end: currentEventStart.format('YYYY-MM-DDTHH:mm:ss'),
            duration: timeDifference
          });
        }
    
        previousEventEnd = moment(event.end.dateTime).tz(israelTimezone);
      } else {
        if (previousEventEnd.isBefore(currentDayEnd)) {
          freeTime.push({
            start: previousEventEnd.format('YYYY-MM-DDTHH:mm:ss'),
            end: currentDayEnd.format('YYYY-MM-DDTHH:mm:ss'),
            duration: currentDayEnd.diff(previousEventEnd, 'minutes')
          });
        }
    
        currentDayStart = currentDayEnd;
        currentDayEnd = currentDayStart.clone().add(1, 'day').hours(21);
        previousEventEnd = currentEventStart;
      }
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

module.exports = router;






