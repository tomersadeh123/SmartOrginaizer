document.getElementById('createGroupForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const groupName = document.getElementById('groupName').value;
    const username = getUserUsername(); // Get the current user's username

    fetch('http://localhost:3000/groups/groups', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ groupName, username }) // Include username in the request body
    })
    .then(response => response.json().then(data => ({ status: response.status, body: data })))
    .then(response => {
        if (response.status === 201) {
            showSuccessMessage(`Group created successfully. Your group's ID: ${response.body.groupID}`);
            document.getElementById('createGroupForm').reset();
            addGroupToUserGroups({ groupID: response.body.groupID, name: groupName, users: [username] }); // Add the new group to the DOM
        } else {
            showErrorMessage(response.body.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showErrorMessage('Failed to create group');
    });
});

function addGroupToUserGroups(group) {
    const userGroupsContainer = document.getElementById('userGroupsContainer');

    // Remove "You are not part of any groups" message if present
    if (userGroupsContainer.textContent === 'You are not part of any groups.') {
        userGroupsContainer.textContent = '';
    }

    // Create the list item for the new group
    const listItem = document.createElement('li');
    listItem.classList.add('group-item');

    const toggleButton = document.createElement('button');
    toggleButton.classList.add('toggle-button');
    toggleButton.textContent = group.name;
    toggleButton.addEventListener('click', () => {
        const groupInfo = listItem.querySelector('.group-info');
        groupInfo.classList.toggle('hidden');
    });

    const groupInfo = document.createElement('div');
    groupInfo.classList.add('group-info', 'hidden');
    groupInfo.innerHTML = `
        <strong>Group Name:</strong> <span>${group.name}</span><br>
        <strong>Group ID:</strong> <span>${group.groupID}</span><br>
        <strong>Group Users:</strong> <span>${group.users.join(', ')}</span>
    `;

    listItem.appendChild(toggleButton);
    listItem.appendChild(groupInfo);

    // Append the new list item to the user groups container
    const list = userGroupsContainer.querySelector('ul') || document.createElement('ul');
    list.classList.add('group-list');
    list.appendChild(listItem);

    if (!userGroupsContainer.contains(list)) {
        userGroupsContainer.appendChild(list);
    }
}

document.getElementById('addUserForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const groupID = document.getElementById('groupIDAddUser').value.trim();
    const username = document.getElementById('username').value;
    const requester = getUserUsername(); // Get the current user's username

    fetch(`http://localhost:3000/groups/groups/${groupID}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, requester }) // Include the requester's username
    })
    .then(response => response.json().then(data => ({ status: response.status, body: data })))
    .then(response => {
        if (response.status === 201) {
            showSuccessMessage(response.body.message);
            document.getElementById('addUserForm').reset();
        } else {
            showErrorMessage(response.body.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showErrorMessage('Failed to add user to group');
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const calculateBtn = document.getElementById('calculateBtn');
    const resultContainer = document.getElementById('resultContainer');
    const customEventFormContainer = document.getElementById('customEventFormContainer');
    const customEventForm = document.getElementById('customEventForm');
    const cancelEventBtn = document.getElementById('cancelEventBtn');
    let selectedSlot = null;

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

    calculateBtn.addEventListener('click', async function() {
        const groupIDInput = document.getElementById('groupIDCommonSlots');
        const groupID = groupIDInput.value.trim();
        const requester = getUserUsername(); // Get the current user's username
    
        if (!groupID) {
            resultContainer.textContent = 'Please enter a group ID.';
            return;
        }
    
        try {
            // Fetch group members' schedules
            const response = await fetch(`http://localhost:3000/groups/groups/${groupID}/schedules?requester=${requester}`);
    
            if (response.ok) {
                const schedules = await response.json();
                // Find the common free time slots
                const commonSlots = findCommonFreeSlots(schedules);
                // Update the resultContainer with the common free time slots
                resultContainer.innerHTML = '';
                if (commonSlots.length === 0) {
                    resultContainer.textContent = 'No common free time slots found.';
                } else {
                    const groupedSlots = commonSlots.reduce((acc, slot) => {
                        const dateStr = formatDate(slot.start);
                        const timeStr = `${formatTime(slot.start)} - ${formatTime(slot.end)}`;
                        if (!acc[dateStr]) {
                            acc[dateStr] = [];
                        }
                        acc[dateStr].push({ timeStr, slot });
                        return acc;
                    }, {});
    
                    for (const [date, times] of Object.entries(groupedSlots)) {
                        const slotItem = document.createElement('div');
                        slotItem.classList.add('slot-item');
                        slotItem.innerHTML = `<p><strong>Date:</strong> ${date}</p><p><strong>Free Common Hours:</strong></p>`;
    
                        times.forEach(({ timeStr, slot }) => {
                            const timeElement = document.createElement('div');
                            timeElement.innerHTML = `
                                <p>${timeStr}</p>
                                <button class="add-google-calendar-button">Add to Google Calendar</button>
                            `;
                            timeElement.querySelector('.add-google-calendar-button').addEventListener('click', () => {
                                showCustomEventForm(slot);
                            });
                            slotItem.appendChild(timeElement);
                        });
                        
                        resultContainer.appendChild(slotItem);
                    }
                }
            } else {
                const errorData = await response.json();
                showErrorMessage(errorData.error || 'Failed to fetch group schedules');
            }
        } catch (error) {
            console.error('Error:', error);
            showErrorMessage('Failed to fetch group schedules');
        }
    });
});

function showCustomEventForm(slot) {
    const slotStartDate = new Date(slot.start);
    const slotEndDate = new Date(slot.end);

    // Pre-fill the start and end time fields with the selected slot times
    document.getElementById('eventStartTime').value = slotStartDate.toTimeString().slice(0, 5);
    document.getElementById('eventEndTime').value = slotEndDate.toTimeString().slice(0, 5);
    document.getElementById('eventName').value = ''; // Clear previous values

    const selectedDateElement = document.getElementById('selectedDate');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = slotStartDate.toLocaleDateString(undefined, options);
    selectedDateElement.innerHTML = `<strong>Selected Date:</strong> ${formattedDate}`; // Update the date display

    const customEventFormContainer = document.getElementById('customEventFormContainer');
    customEventFormContainer.style.display = 'block';

    // Scroll to the custom event form section
    customEventFormContainer.scrollIntoView({ behavior: 'smooth' });

    document.getElementById('customEventForm').onsubmit = async function(event) {
        event.preventDefault();

        const startTime = document.getElementById('eventStartTime').value;
        const endTime = document.getElementById('eventEndTime').value;
        const eventName = document.getElementById('eventName').value.trim();

        if (!startTime || !endTime || !eventName) {
            alert('Please fill in all fields.');
            return;
        }

        const selectedStartTime = new Date(slotStartDate.toDateString() + ' ' + startTime);
        const selectedEndTime = new Date(slotStartDate.toDateString() + ' ' + endTime);

        if (selectedStartTime < slotStartDate || selectedEndTime > slotEndDate || selectedStartTime >= selectedEndTime) {
            alert('Please select a valid time range within the available slot.');
            return;
        }

        // Show confirmation dialog
        const confirmationMessage = `Please confirm the event details:\n\n` +
                                `Event Name: "${eventName}"\n` +
                                `Date: ${formattedDate}\n` +
                                `Start Time: ${startTime}\n` +
                                `End Time: ${endTime}\n`;

        if (confirm(confirmationMessage)) {
            // If confirmed, proceed with the original functionality
            customEventFormContainer.style.display = 'none';

            await addGoogleCalendarEvent({
                start: selectedStartTime.toISOString(),
                end: selectedEndTime.toISOString()
            }, eventName);
        }
    };
}

async function addGoogleCalendarEvent(slot, eventName) {
    const username = getUserUsername();
    const groupID = document.getElementById('groupIDCommonSlots').value.trim();

    try {
        // Convert start and end times to the correct format with timezone (GMT+3)
        const startTime = new Date(slot.start);
        const endTime = new Date(slot.end);

        // Format the times to ensure they are in GMT+3 (Asia/Jerusalem)
        const options = { timeZone: 'Asia/Jerusalem', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };

        const formatDateTime = (date) => {
            const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
            const getPart = (type) => parts.find(part => part.type === type).value;
            return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
        };

        const formattedStartTime = formatDateTime(startTime);
        const formattedEndTime = formatDateTime(endTime);

        const response = await fetch(`http://localhost:3000/groups/groups/${groupID}/addGoogleCalendarEvent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                eventDetails: {
                    summary: eventName,
                    start: {
                        dateTime: formattedStartTime,
                        timeZone: 'Asia/Jerusalem',
                    },
                    end: {
                        dateTime: formattedEndTime,
                        timeZone: 'Asia/Jerusalem',
                    },
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error('Failed to add event to Google Calendar');
        }

        const result = await response.json();
        alert(`Event "${eventName}" added to Google Calendar.`);
    } catch (error) {
        console.error('Error adding event:', error);
        alert('Failed to add event');
    }
}

// Function to find common free slots
function findCommonFreeSlots(schedules) {
    if (!schedules || schedules.length === 0) return [];

    // Constants for the free time range in minutes (7 AM to 9 PM, GMT+3 time)
    const START_MINUTES = 7 * 60;
    const END_MINUTES = 21 * 60;

    // Convert date strings to minutes from the start of the day in GMT+3 time
    const convertToMinutes = dateStr => {
        const dt = new Date(dateStr);
        const utcHours = dt.getUTCHours();
        const utcMinutes = dt.getUTCMinutes();
        const gmt3Hours = utcHours + 3; // Add 3 hours for GMT+3
        const gmt3Minutes = utcMinutes;
        return gmt3Hours * 60 + gmt3Minutes;
    };

    // Convert minutes from the start of the day to ISO date string in GMT+3 time
    const convertToDateTime = (dayOffset, minutes) => {
        const dt = new Date(Date.UTC(2024, 5, 2 + dayOffset, 0, 0)); // 2024, 5 (June), 2 (starting from June 2)
        const gmt3Hours = Math.floor(minutes / 60);
        const gmt3Minutes = minutes % 60;
        dt.setUTCHours(gmt3Hours, gmt3Minutes);
        return dt.toISOString().slice(0, 16);
    };

    // Filter and normalize free time slots to be within the specified range
    const normalizeSlots = freeTime => freeTime.map(slot => {
        let start = convertToMinutes(slot.start);
        let end = convertToMinutes(slot.end);

        // Adjust to fit within the specified time range
        start = Math.max(start, START_MINUTES);
        end = Math.min(end, END_MINUTES);

        // Ignore slots that don't fit within the range
        return (start < end) ? { start, end, dayOffset: new Date(slot.start).getUTCDate() - 2 } : null;
    }).filter(slot => slot);

    // Convert all free time slots to intervals in minutes
    const intervals = schedules.map(user => normalizeSlots(user.freeTime));

    // Initialize the common slots with the first user's free time
    let commonSlots = intervals[0];

    // Intersect with each user's free time slots
    for (let i = 1; i < intervals.length; i++) {
        const newCommonSlots = [];
        for (const commonSlot of commonSlots) {
            for (const slot of intervals[i]) {
                if (commonSlot.dayOffset === slot.dayOffset) {
                    const start = Math.max(commonSlot.start, slot.start);
                    const end = Math.min(commonSlot.end, slot.end);
                    if (start < end) {
                        newCommonSlots.push({ start, end, dayOffset: commonSlot.dayOffset });
                    }
                }
            }
        }
        commonSlots = newCommonSlots;
    }

    // Convert back to ISO string format
    return commonSlots.map(slot => ({
        start: convertToDateTime(slot.dayOffset, slot.start),
        end: convertToDateTime(slot.dayOffset, slot.end)
    }));
}

document.addEventListener('DOMContentLoaded', function() {
    const username = getUserUsername();

    if (username) {
        fetchUserGroups(username);
    }

    // Function to fetch and display the user's groups
    function fetchUserGroups(username) {
        fetch(`http://localhost:3000/groups/users/${username}/groups`)
            .then(response => response.json())
            .then(groups => {
                displayUserGroups(groups);
            })
            .catch(error => {
                console.error('Error fetching user groups:', error);
                showErrorMessage('Failed to fetch user groups');
            });
    }

    // Function to display the user's groups
    function displayUserGroups(groups) {
        const userGroupsContainer = document.getElementById('userGroupsContainer');
        userGroupsContainer.innerHTML = '';
    
        if (groups.length === 0) {
            userGroupsContainer.textContent = 'You are not part of any groups.';
            return;
        }
    
        const list = document.createElement('ul');
        list.classList.add('group-list');
    
        groups.forEach(group => {
            const listItem = document.createElement('li');
            listItem.classList.add('group-item');
    
            const toggleButton = document.createElement('button');
            toggleButton.classList.add('toggle-button');
            toggleButton.textContent = group.name;
            toggleButton.addEventListener('click', () => {
                const groupInfo = listItem.querySelector('.group-info');
                groupInfo.classList.toggle('hidden');
            });
    
            const groupInfo = document.createElement('div');
            groupInfo.classList.add('group-info', 'hidden');
            groupInfo.innerHTML = `
                <strong>Group Name:</strong> <span>${group.name}</span><br>
                <strong>Group ID:</strong> <span>${group.groupID}</span><br>
                <strong>Group Users:</strong> <span>${group.users.join(', ')}</span>
            `;
    
            listItem.appendChild(toggleButton);
            listItem.appendChild(groupInfo);
            list.appendChild(listItem);
        });
    
        userGroupsContainer.appendChild(list);
    }    
});

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

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.classList.add('message', 'success-message');
    successDiv.textContent = message;
    document.body.insertBefore(successDiv, document.body.firstChild); // Insert at the top of the document
    setTimeout(() => {
        successDiv.remove();
    }, 3000); // Remove the message after 5 seconds
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('message', 'error-message');
    errorDiv.textContent = message;
    document.body.insertBefore(errorDiv, document.body.firstChild); // Insert at the top of the document
    setTimeout(() => {
        errorDiv.remove();
    }, 3000); // Remove the message after 5 seconds
}
