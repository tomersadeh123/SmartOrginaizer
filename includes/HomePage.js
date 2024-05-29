async function getFreeSpaces() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const username = urlParams.get('username');
      if (!username) {
        console.error('Username not found in URL query parameter.');
        return;
      }

      const loadingIndicator = document.querySelector('.loading-indicator');
      loadingIndicator.style.display = 'block';

      const response = await fetch('http://localhost:3000/events/calculate-free-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      loadingIndicator.style.display = 'none';

      const data = await response.json();
      if (response.ok) {
        console.log('Free spaces calculated successfully.');
        displayFreeSpaces(data);
      } else {
        console.error('Error:', data.error);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    freeSpacesCalculated = true;
  }

  function displayFreeSpaces(freeSpaces) {
    const freeSpacesContainer = document.getElementById('free-spaces-container');
    freeSpacesContainer.innerHTML = '';

    if (freeSpaces.length === 0) {
      freeSpacesContainer.textContent = 'No free spaces available.';
    } else {
      const freeSpacesList = document.createElement('ul');
      freeSpaces.forEach(freeSpace => {
        const listItem = document.createElement('li');
        listItem.textContent = `${freeSpace.start} - ${freeSpace.end}`;
        freeSpacesList.appendChild(listItem);
      });
      freeSpacesContainer.appendChild(freeSpacesList);
    }
  }
  const createOrJoinGroupBtn = document.getElementById('createOrJoinGroup');
const getActivitySuggestionsBtn = document.getElementById('getActivitySuggestions');
let freeSpacesCalculated = false;

createOrJoinGroupBtn.addEventListener('click', () => {
  const confirmed = confirm('Do you want to create or join a group?');
  if (confirmed) {
    window.location.href = 'groups.html';
  }
});

getActivitySuggestionsBtn.addEventListener('click', () => {
  if (!freeSpacesCalculated) {
    alert('Please calculate your free spaces first before getting activity suggestions.');
  } else {
    // Code to display activity suggestions goes here
    console.log('Displaying activity suggestions...');
  }
});

// Array to store the user's free time slots
let freeTimeSlots = [];

// Function to read the users.json file
function readUsersFile() {
  const fs = require('fs');
  const path = require('path');

  const filePath = path.join(__dirname, '../jsonFiles/users.json');
  const fileData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(fileData);
}

// Function to get the user's free time slots from the users.json file
function fetchFreeTimeSlots(username) {
  const users = readUsersFile();
  const user = users.find(user => user.username === username);
  return user ? user.freeTime : [];
}

// Function to get activity suggestions based on the free time slots
function getActivitySuggestions(username) {
  // Fetch the user's free time slots
  freeTimeSlots = fetchFreeTimeSlots(username);

  // Create an array to store the suggested activities
  let suggestions = [];

  // Iterate over the free time slots
  for (const slot of freeTimeSlots) {
    const duration = calculateDuration(slot.start, slot.end);

    // Suggest activities based on the duration
    if (duration <= 30) {
      suggestions.push('Take a short walk');
      suggestions.push('Do some stretching exercises');
    } else if (duration <= 60) {
      suggestions.push('Go for a jog or a bike ride');
      suggestions.push('Practice a hobby or skill');
    } else if (duration <= 120) {
      suggestions.push('Watch a movie or a TV show');
      suggestions.push('Visit a nearby park or attraction');
    } else {
      suggestions.push('Plan a day trip or an outdoor activity');
      suggestions.push('Attend a cultural event or exhibition');
    }
  }

  // Display the activity suggestions to the user
  displaySuggestions(suggestions);
}

// Function to calculate the duration of a time slot in minutes
function calculateDuration(start, end) {
  const startTime = new Date(start);
  const endTime = new Date(end);
  const durationInMilliseconds = endTime.getTime() - startTime.getTime();
  return Math.floor(durationInMilliseconds / (1000 * 60));
}

// Function to display the activity suggestions to the user
function displaySuggestions(suggestions) {
  const suggestionsContainer = document.createElement('div');
  suggestions.forEach((suggestion) => {
    const suggestionElement = document.createElement('p');
    suggestionElement.textContent = suggestion;
    suggestionsContainer.appendChild(suggestionElement);
  });
  document.body.appendChild(suggestionsContainer);
}

// Event listener for the "Get Activity Suggestions" button
document.getElementById('getActivitySuggestions').addEventListener('click', () => {
  // Assuming you have access to the current user's username
  const currentUsername = getUserUsername(); // Implement this function to retrieve the current user's username

  getActivitySuggestions(currentUsername);
});