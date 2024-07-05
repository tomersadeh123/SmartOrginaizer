document.getElementById('registrationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
        const formData = {
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            events: []
        };
        const response = await fetch('http://localhost:3000/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        if (response.ok) {
            showSuccessMessage('Registration successful! Welcome aboard!');
            document.getElementById('registrationForm').reset();
            document.getElementById('chk').checked = true;
        } else {
            const errorData = await response.json();
            showErrorMessage(`Registration failed: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error registering user:', error);
        showErrorMessage('Something went wrong. Please try again later.');
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
