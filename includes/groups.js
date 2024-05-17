document.getElementById('createGroupForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const groupName = document.getElementById('groupName').value;
    fetch('/groups', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ groupName })
    })
    .then(response => {
        if (response.ok) {
            alert('Group created successfully');
            document.getElementById('createGroupForm').reset();
        } else {
            alert('Failed to create group');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to create group');
    });
});

document.getElementById('addUserForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const groupName = document.getElementById('groupNameAddUser').value;
    const username = document.getElementById('username').value;
    fetch(`/groups/${groupName}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
    })
    .then(response => {
        if (response.ok) {
            alert('User added to group successfully');
            document.getElementById('addUserForm').reset();
        } else {
            alert('Failed to add user to group');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to add user to group');
    });
});