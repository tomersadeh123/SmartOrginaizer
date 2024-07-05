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

router.get('/events', async (req, res) => {
  try {
    const auth = await authorize();
    const fetchedEvents = await listEvents(auth);

    // Get the current date and time in the Israel/Jerusalem time zone
    const israelTimezone = 'Asia/Jerusalem';
    const currentDate = moment().tz(israelTimezone);
    const startOfNextWeek = currentDate.clone().startOf('isoWeek').add(1, 'week').startOf('day');
    const endOfNextWeek = startOfNextWeek.clone().endOf('isoWeek').endOf('day');

    // Filter out events that occur within the next week
    const eventsNextWeek = fetchedEvents.filter(event => {
      const eventStartTime = moment(event.start.dateTime).tz(israelTimezone);
      const eventEndTime = moment(event.end.dateTime).tz(israelTimezone);
      return (
        (eventStartTime.isBetween(startOfNextWeek, endOfNextWeek, null, '[]') ||
          eventEndTime.isBetween(startOfNextWeek, endOfNextWeek, null, '[]')) &&
        eventEndTime.isAfter(currentDate)
      );
    });

    res.json(eventsNextWeek);
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
    const currentDateTime = moment().tz(israelTimezone);

    // Filter out events that start from the current date and time and have not ended
    const futureEvents = allEvents.filter(event => {
      if (isWholeDayEvent(event)) {
        return true; // Include whole-day events
      }
      const eventEndDateTime = moment(event.end.dateTime).tz(israelTimezone);
      return eventEndDateTime.isAfter(currentDateTime);
    }).sort((a, b) => moment(a.start.dateTime).tz(israelTimezone) - moment(b.start.dateTime).tz(israelTimezone));

    // Calculate free time for each day
    const freeTime = [];

    // Calculate free time for the current day
    const currentDayFreeTime = calculateFreeTimeForCurrentDay(currentDateTime, futureEvents);
    freeTime.push(...currentDayFreeTime);

    // Calculate free time for the next 6 days
    const nextSixDaysFreeTime = calculateFreeTimeForNextSixDays(currentDateTime, futureEvents);
    freeTime.push(...nextSixDaysFreeTime);

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

// Helper Functions to Identify Whole-Day Events
function isWholeDayEvent(event) {
  return event.start.date && event.end.date;
}

function getWholeDayEvents(events) {
  return events.filter(isWholeDayEvent);
}

// Modified calculateFreeTimeForCurrentDay Function
function calculateFreeTimeForCurrentDay(currentDateTime, futureEvents) {
  const freeTimeForCurrentDay = [];
  const israelTimezone = 'Asia/Jerusalem';

  // Define the start and end of the working hours
  const workDayStart = currentDateTime.clone().hours(7).minutes(0).seconds(0);
  const workDayEnd = currentDateTime.clone().hours(21).minutes(0).seconds(0);

  // If the current time is before 07:00, set the currentDayStart to 07:00
  let currentDayStart = currentDateTime.isBefore(workDayStart) ? workDayStart : currentDateTime;
  let currentDayEnd = workDayEnd;

  let previousEventEnd = currentDayStart;

  // Get whole day events for the current day
  const wholeDayEvents = getWholeDayEvents(futureEvents).filter(event => {
    const eventStartDate = moment(event.start.date).tz(israelTimezone);
    const eventEndDate = moment(event.end.date).tz(israelTimezone);
    return eventStartDate.isSame(currentDateTime, 'day') || (eventStartDate.isBefore(currentDateTime, 'day') && eventEndDate.isAfter(currentDateTime, 'day'));
  });

  // If there's a whole day event, set free time to 0 for the current day
  if (wholeDayEvents.length > 0) {
    return freeTimeForCurrentDay; // No free time slots since the whole day is occupied
  }

  const dayEvents = futureEvents.filter(event => {
    const eventStart = moment(event.start.dateTime).tz(israelTimezone);
    const eventEnd = moment(event.end.dateTime).tz(israelTimezone);
    return eventStart.isBetween(currentDayStart, currentDayEnd, null, '[)') || eventEnd.isBetween(currentDayStart, currentDayEnd, null, ']');
  });

  if (dayEvents.length === 0) {
    const duration = currentDayEnd.diff(currentDayStart, 'minutes');
    if (duration > 0) {
      freeTimeForCurrentDay.push({
        start: currentDayStart.format('YYYY-MM-DDTHH:mm:ss'),
        end: currentDayEnd.format('YYYY-MM-DDTHH:mm:ss'),
        duration: duration
      });
    }
  } else {
    dayEvents.forEach(event => {
      const currentEventStart = moment(event.start.dateTime).tz(israelTimezone);
      const currentEventEnd = moment(event.end.dateTime).tz(israelTimezone).isBefore(currentDayEnd) ? moment(event.end.dateTime).tz(israelTimezone) : currentDayEnd;

      if (previousEventEnd.isBefore(currentEventStart)) {
        const duration = currentEventStart.diff(previousEventEnd, 'minutes');
        if (duration > 0) {
          freeTimeForCurrentDay.push({
            start: previousEventEnd.format('YYYY-MM-DDTHH:mm:ss'),
            end: currentEventStart.format('YYYY-MM-DDTHH:mm:ss'),
            duration: duration
          });
        }
      }
      previousEventEnd = currentEventEnd;
    });

    if (previousEventEnd.isBefore(currentDayEnd)) {
      const duration = currentDayEnd.diff(previousEventEnd, 'minutes');
      if (duration > 0) {
        freeTimeForCurrentDay.push({
          start: previousEventEnd.format('YYYY-MM-DDTHH:mm:ss'),
          end: currentDayEnd.format('YYYY-MM-DDTHH:mm:ss'),
          duration: duration
        });
      }
    }
  }

  return freeTimeForCurrentDay;
}

// Modified calculateFreeTimeForNextSixDays Function
function calculateFreeTimeForNextSixDays(currentDateTime, futureEvents) {
  const freeTimeForNextSixDays = [];
  const israelTimezone = 'Asia/Jerusalem';

  let currentDayStart = currentDateTime.clone().add(1, 'day').startOf('day').hours(7);
  let currentDayEnd = currentDayStart.clone().hours(21); // Ensure end time is 21:00:00
  const oneWeekAhead = currentDateTime.clone().add(6, 'days');

  while (currentDayStart.isBefore(oneWeekAhead)) {
    // Get whole day events for the current day
    const wholeDayEvents = getWholeDayEvents(futureEvents).filter(event => {
      const eventStartDate = moment(event.start.date).tz(israelTimezone);
      const eventEndDate = moment(event.end.date).tz(israelTimezone);
      return eventStartDate.isSame(currentDayStart, 'day') || (eventStartDate.isBefore(currentDayStart, 'day') && eventEndDate.isAfter(currentDayStart, 'day'));
    });

    // If there's a whole day event, set free time to 0 for the current day
    if (wholeDayEvents.length > 0) {
      currentDayStart.add(1, 'day').startOf('day').hours(7);
      currentDayEnd = currentDayStart.clone().hours(21); // Ensure end time is 21:00:00
      continue;
    }

    const dayEvents = futureEvents.filter(event => {
      const eventStart = moment(event.start.dateTime).tz(israelTimezone);
      const eventEnd = moment(event.end.dateTime).tz(israelTimezone);
      return eventStart.isBetween(currentDayStart, currentDayEnd, null, '[)') || eventEnd.isBetween(currentDayStart, currentDayEnd, null, ']');
    });

    if (dayEvents.length === 0) {
      const duration = currentDayEnd.diff(currentDayStart, 'minutes');
      if (duration > 0) {
        freeTimeForNextSixDays.push({
          start: currentDayStart.format('YYYY-MM-DDTHH:mm:ss'),
          end: currentDayEnd.format('YYYY-MM-DDTHH:mm:ss'),
          duration: duration
        });
      }
    } else {
      let previousEventEnd = currentDayStart;
      dayEvents.forEach(event => {
        const currentEventStart = moment(event.start.dateTime).tz(israelTimezone);
        const currentEventEnd = moment(event.end.dateTime).tz(israelTimezone).isBefore(currentDayEnd) ? moment(event.end.dateTime).tz(israelTimezone) : currentDayEnd;

        if (previousEventEnd.isBefore(currentEventStart)) {
          const duration = currentEventStart.diff(previousEventEnd, 'minutes');
          if (duration > 0) {
            freeTimeForNextSixDays.push({
              start: previousEventEnd.format('YYYY-MM-DDTHH:mm:ss'),
              end: currentEventStart.format('YYYY-MM-DDTHH:mm:ss'),
              duration: duration
            });
          }
        }
        previousEventEnd = currentEventEnd;
      });

      if (previousEventEnd.isBefore(currentDayEnd)) {
        const duration = currentDayEnd.diff(previousEventEnd, 'minutes');
        if (duration > 0) {
          freeTimeForNextSixDays.push({
            start: previousEventEnd.format('YYYY-MM-DDTHH:mm:ss'),
            end: currentDayEnd.format('YYYY-MM-DDTHH:mm:ss'),
            duration: duration
          });
        }
      }
    }

    currentDayStart.add(1, 'day').startOf('day').hours(7);
    currentDayEnd = currentDayStart.clone().hours(21); // Ensure end time is 21:00:00
  }

  return freeTimeForNextSixDays;
}

module.exports = router;
