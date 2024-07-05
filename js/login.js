document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
      const formData = {
          username: document.getElementById('loginUsername').value,
          password: document.getElementById('loginPassword').value
      };
      const response = await fetch('http://localhost:3000/users/login', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
      });
      if (response.ok) {
          showSuccessMessage('Login successful! Welcome!');
          const responseData = await response.json();
          const { username } = formData;
          await updateEvents(username); // Update events immediately after login
          setTimeout(() => {
              window.location.href = `includes/HomePage.html?username=${username}`;
            }, 2000); // Redirect after 2 seconds
      } else {
          const errorData = await response.json();
          showErrorMessage(`Login failed: ${errorData.error}`);
      }
  } catch (error) {
      console.error('Error logging in:', error);
      showErrorMessage('Login failed. Please try again later.');
  }
});

function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.classList.add('message');
  successDiv.classList.add('success-message');
  successDiv.textContent = message;
  document.body.insertBefore(successDiv, document.body.firstChild); // Insert at the top of the document
  setTimeout(() => {
      successDiv.remove();
  }, 5000); // Remove the message after 5 seconds
}

function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.classList.add('message');
  errorDiv.classList.add('error-message');
  errorDiv.textContent = message;
  document.body.insertBefore(errorDiv, document.body.firstChild); // Insert at the top of the document
  setTimeout(() => {
      errorDiv.remove();
  }, 3000); // Remove the message after 5 seconds
}

// Function to update user events
async function updateEvents(username) {
  try {
      const response = await fetch(`http://localhost:3000/users/updateEvents?username=${username}`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          }
      });
      if (!response.ok) {
          throw new Error('Failed to update events');
      }
  } catch (error) {
      console.error('Error updating events:', error);
      throw error;
  }
}
