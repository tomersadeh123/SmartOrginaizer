const fs = require('fs').promises;

async function calculateFreeTime(username) {
  try {
    // Read the JSON data from the file
    const userData = await fs.readFile('users.json', 'utf8');
    // Parse the JSON data to an object
    const usersData = JSON.parse(userData);

    // Find the user with the provided username
    const user = usersData.find(user => user.username === username);
    if (!user || !Array.isArray(user.events)) {
      console.log(`No events found for user with username '${username}' or events data is not in the expected format.`);
      return;
    }

    // Flatten the events array
    const allEvents = user.events.flat();

    // Sort events by start time
    allEvents.sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

    // Find the start and end dates for the week
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); // Set to first day of the week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0); // Set time to midnight
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7); // Set to end of the week (Sunday of next week)

    // Calculate free time between events within the week
    const freeTime = [];
    let previousEventEnd = startOfWeek; // Initialize previous event end time to start of the week
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

    console.log('Free Time Between Events for the Week:');
    freeTime.forEach((slot, index) => {
      console.log(`Slot ${index + 1}:`);
      console.log('Start Time:', slot.start);
      console.log('End Time:', slot.end);
      console.log('Duration (minutes):', slot.duration);
    });
  } catch (error) {
    console.error('Error reading or parsing users data:', error);
  }
}

// Call the function with the desired username to calculate free time
const username = 'tomersad'; // Replace 'tomersad' with the desired username
calculateFreeTime(username);
