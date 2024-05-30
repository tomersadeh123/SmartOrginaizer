let freeSpacesData = [];
let isFreeSpacesVisible = false;

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
      freeSpacesData = data.freeTime; // Store the data for later use
      document.getElementById('toggleFreeSpaces').style.display = 'inline'; // Show the toggle button
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

function toggleFreeSpacesDisplay() {
  const freeSpacesContainer = document.getElementById('free-spaces-container');
  const toggleButton = document.getElementById('toggleFreeSpaces');

  isFreeSpacesVisible = !isFreeSpacesVisible;

  if (isFreeSpacesVisible) {
    displayFreeSpaces(freeSpacesData);
    freeSpacesContainer.style.display = 'block';
    toggleButton.textContent = 'Hide Free Spaces';
  } else {
    freeSpacesContainer.style.display = 'none';
    toggleButton.textContent = 'Show Free Spaces';
  }
}

document.getElementById('toggleFreeSpaces').addEventListener('click', toggleFreeSpacesDisplay);

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

// Function to fetch activity suggestions from the server
async function fetchActivitySuggestions(username) {
  try {
    const response = await fetch('http://localhost:3000/users/Suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch activity suggestions');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching activity suggestions:', error);
    throw error;
  }
}
let currentSuggestionIndex = 0;
const suggestionsPerBatch = 5;
let allSuggestions = [];

// Function to get activity suggestions based on the free time slots
function getActivitySuggestions(username) {
  // Fetch the activity suggestions from the server
  fetchActivitySuggestions(username)
    .then(response => {
      // Extract suggestions from the response
      const { suggestions } = response;
      allSuggestions = suggestions;
      currentSuggestionIndex = 0; // Reset index when fetching new suggestions
      // Display the activity suggestions to the user
      updateSuggestions();
    })
    .catch(error => {
      console.error('Error getting activity suggestions:', error);
    });
}

// Function to update the displayed suggestions
function updateSuggestions() {
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  suggestionsContainer.innerHTML = ''; // Clear previous suggestions

  const suggestionsToShow = allSuggestions.slice(0, currentSuggestionIndex + suggestionsPerBatch);
  suggestionsToShow.forEach((suggestion) => {
    const suggestionElement = document.createElement('div');
    suggestionElement.classList.add('suggestion-item');
    suggestionElement.innerHTML = `
      <p> ${suggestion.suggestion}, Start: ${suggestion.start}, End: ${suggestion.end}</p>
      <button class="add-event-button">Add Event</button>
    `;
    suggestionElement.querySelector('.add-event-button').addEventListener('click', () => {
      addEvent(suggestion);
    });
    suggestionsContainer.appendChild(suggestionElement);
  });

  if (currentSuggestionIndex + suggestionsPerBatch < allSuggestions.length) {
    const displayMoreButton = document.createElement('button');
    displayMoreButton.textContent = 'Display More';
    displayMoreButton.addEventListener('click', () => {
      currentSuggestionIndex += suggestionsPerBatch;
      updateSuggestions();
    });
    suggestionsContainer.appendChild(displayMoreButton);
  }

  if (currentSuggestionIndex > 0) {
    const displayLessButton = document.createElement('button');
    displayLessButton.textContent = 'Display Less';
    displayLessButton.addEventListener('click', () => {
      currentSuggestionIndex = Math.max(0, currentSuggestionIndex - suggestionsPerBatch);
      updateSuggestions();
    });
    suggestionsContainer.appendChild(displayLessButton);
  }
}

// Dummy function to simulate adding an event to the user's calendar
function addEvent(suggestion) {
  alert(`Event added: ${suggestion.suggestion}, Start: ${suggestion.start}, End: ${suggestion.end}`);
}

// Event listener for the "Get Activity Suggestions" button
document.getElementById('getActivitySuggestions').addEventListener('click', () => {
  const currentUsername = getUserUsername();
  getActivitySuggestions(currentUsername);
});

// Dummy function to get the current user's username
function getUserUsername() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('username');
}
