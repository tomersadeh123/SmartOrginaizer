let freeSpacesData = [];
let isFreeSpacesVisible = false;
let freeSpacesCalculated = false;
let currentSuggestionIndex = 0;
const suggestionsPerBatch = 5;
let allSuggestions = [];

// Fetches free spaces data
async function getFreeSpaces() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    if (!username) {
      console.error('Username not found in URL query parameter.');
      return;
    }

    const loadingIndicator = document.querySelector('.loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'block';
    }

    const response = await fetch('http://localhost:3000/events/calculate-free-time', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });

    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }

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

// Displays free spaces in a more user-friendly format, combining hours for the same date:
// Formats a date string to a more readable format
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

// Formats a time string to a more readable format
function formatTime(timeString) {
  const date = new Date(timeString);
  return date.toTimeString().split(' ')[0]; // Extracts the time part
}

function displayFreeSpaces(freeSpaces) {
  const freeSpacesContainer = document.getElementById('free-spaces-container');
  freeSpacesContainer.innerHTML = '';

  if (freeSpaces.length === 0) {
    freeSpacesContainer.textContent = 'No free spaces available.';
    return;
  }

  // Group free spaces by date
  const groupedFreeSpaces = freeSpaces.reduce((acc, freeSpace) => {
    const dateStr = formatDate(freeSpace.start);
    const timeStr = `${formatTime(freeSpace.start)} - ${formatTime(freeSpace.end)}`;
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(timeStr);
    return acc;
  }, {});

  // Create HTML elements for each date and its corresponding hours
  for (const [date, times] of Object.entries(groupedFreeSpaces)) {
    const freeSpaceItem = document.createElement('div');
    freeSpaceItem.classList.add('free-space-item');
    freeSpaceItem.innerHTML = `
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Hours:</strong><br> ${times.join('<br>')}</p>
    `;
    freeSpacesContainer.appendChild(freeSpaceItem);
  }
}

// Toggles the visibility of free spaces
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

// Event listener for creating or joining a group
createOrJoinGroupBtn.addEventListener('click', () => {
  const confirmed = confirm('Do you want to move to group page?');
  if (confirmed) {
    window.location.href = `groups.html?username=${getUserUsername()}`;
  }
});

// Event listener for getting activity suggestions
getActivitySuggestionsBtn.addEventListener('click', () => {
  if (!freeSpacesCalculated) {
    alert('Please calculate your free spaces first before getting activity suggestions.');
  } else {
    const currentUsername = getUserUsername();
    getActivitySuggestions(currentUsername);
  }
});

// Fetches activity suggestions from the server
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

// Gets activity suggestions
function getActivitySuggestions(username) {
  fetchActivitySuggestions(username)
    .then(response => {
      const { suggestions } = response;
      allSuggestions = suggestions;
      currentSuggestionIndex = 0;
      updateSuggestions();
    })
    .catch(error => {
      console.error('Error getting activity suggestions:', error);
    });
}

// Updates the displayed suggestions
function updateSuggestions() {
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  suggestionsContainer.innerHTML = '';

  if (allSuggestions.length === 0) {
    suggestionsContainer.textContent = 'No activity suggestions available.';
    return;
  }

  // Slice the suggestions to show only the current batch
  const suggestionsToShow = allSuggestions.slice(0, currentSuggestionIndex + suggestionsPerBatch);

  // Group activity suggestions by date
  const groupedSuggestions = suggestionsToShow.reduce((acc, suggestion) => {
    const dateStr = formatDate(suggestion.start);
    const timeStr = `${formatTime(suggestion.start)} - ${formatTime(suggestion.end)}`;
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push({ title: suggestion.suggestion, timeStr, suggestion });
    return acc;
  }, {});

  // Create HTML elements for each date and its corresponding suggestions
  for (const [date, times] of Object.entries(groupedSuggestions)) {
    const suggestionItem = document.createElement('div');
    suggestionItem.classList.add('suggestion-item');
    suggestionItem.innerHTML = `<p><strong>Date:</strong> ${date}</p><p><strong>Suggestions:</strong></p>`;

    times.forEach(({ title, timeStr, suggestion: fullSuggestion }) => {
      const suggestionElement = document.createElement('div');
      suggestionElement.innerHTML = `
        <p>${title}</p>
        <p>${timeStr} <button class="add-event-button">Add Event</button></p>
      `;
      suggestionElement.querySelector('.add-event-button').addEventListener('click', () => {
        addEvent(fullSuggestion);
      });
      suggestionItem.appendChild(suggestionElement);
    });

    suggestionsContainer.appendChild(suggestionItem);
  }

  // Add display more/less buttons if needed
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

async function addEvent(suggestion) {
  const username = getUserUsername();
  try {
    if (
      typeof suggestion.start !== 'string' ||
      typeof suggestion.end !== 'string' ||
      !suggestion.start.trim() ||
      !suggestion.end.trim()
    ) {
      throw new Error('Invalid start or end time');
    }

    // Format the date and time
    const formattedStartDate = formatDate(suggestion.start);
    const formattedStartTime = formatTime(suggestion.start);
    const formattedEndDate = formatDate(suggestion.end);
    const formattedEndTime = formatTime(suggestion.end);

    // Add confirmation before adding the event
    const confirmation = confirm(`Are you sure you want to add this event?\n\n${suggestion.suggestion}\nStart: ${formattedStartDate} at ${formattedStartTime}\nEnd: ${formattedEndDate} at ${formattedEndTime}`);
    if (!confirmation) {
      return; // User canceled the action
    }

    const event = {
      start: {
        dateTime: suggestion.start,
        timeZone: 'Asia/Jerusalem', // or any other desired time zone
      },
      end: {
        dateTime: suggestion.end,
        timeZone: 'Asia/Jerusalem', // or any other desired time zone
      },
      summary: suggestion.suggestion,
    };

    const response = await fetch('http://localhost:3000/users/AddEvent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        event,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add event');
    }

    const result = await response.json();
    alert(`Event added successfully:\n\n${suggestion.suggestion}\nStart: ${formattedStartDate} at ${formattedStartTime}\nEnd: ${formattedEndDate} at ${formattedEndTime}`);
  } catch (error) {
    console.error('Error adding event:', error);
    alert('Failed to add event. Please try again.');
  }
}

// Get the current user's username from the URL
function getUserUsername() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('username');
}

// Event listener for the Home button
document.addEventListener('DOMContentLoaded', () => {
  const homeLinks = document.querySelectorAll('.homeLink');
  homeLinks.forEach(homeLink => {
    homeLink.addEventListener('click', (event) => {
      event.preventDefault(); // Prevent the default link behavior
      const username = getUserUsername();
      if (username) {
        window.location.href = `HomePage.html?username=${username}`;
      } else {
        window.location.href = 'HomePage.html'; // Fallback if username is not found
      }
    });
  });
});
document.addEventListener("DOMContentLoaded", function() {
    // to get current year
    function getYear() {
        var currentDate = new Date();
        var currentYear = currentDate.getFullYear();
        document.querySelector("#displayYear").innerHTML = currentYear;
    }

    getYear();

    // client section owl carousel
    $(".client_owl-carousel").owlCarousel({
        loop: true,
        margin: 20,
        dots: false,
        nav: true,
        navText: [],
        autoplay: true,
        autoplayHoverPause: true,
        navText: [
            '<i class="fa fa-angle-left" aria-hidden="true"></i>',
            '<i class="fa fa-angle-right" aria-hidden="true"></i>'
        ],
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 2
            },
            1000: {
                items: 2
            }
        }
    });
});

