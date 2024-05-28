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