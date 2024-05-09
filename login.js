document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
  
    const formData = {
      username: document.getElementById('username').value,
      password: document.getElementById('password').value,
    };
  
    try {
      const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
  
      if (response.ok) {
        alert('Login successful');
        window.location.href = `freeSlots.html?username=${encodeURIComponent(formData.username)}`;
      } else {
        const errorData = await response.json();
        alert(`Login failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('Login failed. Please try again later.');
    }
  });
  
  document.getElementById('getEventsBtn').addEventListener('click', async () => {
    try {
      const response = await fetch('http://localhost:3000/events');
      const eventData = await response.json();
      const eventsList = document.getElementById('eventsList');
      eventsList.innerHTML = ''; // Clear previous events
  
      eventData.events.forEach(event => {
        const eventItem = document.createElement('div');
        eventItem.textContent = `${event.summary} - ${event.start.dateTime}`;
        eventsList.appendChild(eventItem);
      });
  
      // Store events data in hidden input field
      document.getElementById('eventsData').value = JSON.stringify(eventData.events);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  });
  function onSignIn(googleUser) {
    var profile = googleUser.getBasicProfile();
    console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
    console.log('Name: ' + profile.getName());
    console.log('Image URL: ' + profile.getImageUrl());
    console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
  }