const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authorize, listEvents, loadSavedCredentialsIfExist, saveCredentials, insertEvent, getUsers } = require('./googleApiUtils.js');
const GROUPS_DATA_PATH = path.join(__dirname, '../jsonFiles/groups.json');
const USERS_DATA_PATH = path.join(__dirname, '../jsonFiles/users.json');
let groups = []; // Initialize groups array
let users = []; // Initialize users array

// Load groups data asynchronously when server starts
fs.readFile(GROUPS_DATA_PATH)
    .then(data => {
        if (data.length > 0) {
            groups = JSON.parse(data); // Parse JSON data
            console.log('Groups data loaded:', groups); // Debugging line
        }
    })
    .catch(err => {
        console.error('Error reading groups.json:', err);
    });

// Load users data asynchronously when server starts
fs.readFile(USERS_DATA_PATH)
    .then(data => {
        if (data.length > 0) {
            users = JSON.parse(data); // Parse JSON data
            // Remove the 'freeTime' and 'events' properties from each user object
            const usersWithoutFreeTimeAndEvents = users.map(({ freeTime, events, ...userDetails }) => userDetails);
            console.log('Users data loaded without freeTime and events:', usersWithoutFreeTimeAndEvents); // Debugging line
        }
    })
    .catch(err => {
        console.error('Error reading users.json:', err);
    });

// Function to get the next group ID
function getNextGroupID() {
    if (groups.length === 0) {
        return "1";
    }
    const maxID = Math.max(...groups.map(group => parseInt(group.groupID)));
    return (maxID + 1).toString();
}

// Route to create a group
router.post('/groups', async (req, res) => {
    const { groupName, username } = req.body; // Include username in the request body

    // Check if groupName and username are provided
    if (!groupName || !username) {
        return res.status(400).json({ error: 'Group name and username are required' });
    }

    try {
        // Check if groupName already exists
        const groupExistsIndex = groups.findIndex(group => group.name === groupName);
        if (groupExistsIndex !== -1) {
            return res.status(400).json({ error: 'Group name already taken, please try another name' });
        }

        // Add new ID to the group
        const newGroupID = getNextGroupID();
        groups.push({ groupID: newGroupID, name: groupName, users: [username] }); // Add the creating user to the group

        // Save updated groups array to file
        await saveGroupsToFile(groups);
        res.status(201).json({ message: 'Group created successfully', groupID: newGroupID }); // Include groupID in the response
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});


// Route to add a user to a group
router.post('/groups/:groupID/users', async (req, res) => {
    const { groupID } = req.params;
    const { username, requester } = req.body; // Include the requester's username

    // Validate the group ID
    const group = groups.find(group => group.groupID === groupID);
    if (!group) {
        return res.status(404).json({ error: 'Group not found, Please enter a valid group ID' });
    }

    // Check if the requester is a member of the group
    if (!group.users.includes(requester)) {
        return res.status(403).json({ error: 'Only members of the group can add new users' });
    }

    // Validate the username
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // Check if the user exists
    const userExists = users.some(user => user.username === username);
    if (!userExists) {
        return res.status(404).json({ error: 'Username not found, Please add only existing users' });
    }

    // Check if the user already exists in the group
    if (group.users.includes(username)) {
        return res.status(400).json({ error: 'User already in the group' });
    }

    // Add the user to the group
    console.log(`Adding user ${username} to group ${groupID}`); // Log the request data
    group.users.push(username);

    // Save the updated groups array to the file
    try {
        await saveGroupsToFile(groups);
        res.status(201).json({ message: `'${username}' has been successfully added to '${group.name}' (Group ID: ${groupID})` });
    } catch (error) {
        console.error('Error saving groups data:', error);
        res.status(500).json({ error: 'Failed to save group data' });
    }
});

// Function to save groups data to groups.json
async function saveGroupsToFile(groups) {
    try {
        await fs.writeFile(GROUPS_DATA_PATH, JSON.stringify(groups, null, 2));
        console.log('Groups data saved to groups.json');
    } catch (error) {
        console.error('Error saving groups data to groups.json:', error);
        throw error;
    }
}

// Route to fetch schedules of group members
router.get('/groups/:groupID/schedules', async (req, res) => {
    const { groupID } = req.params;
    const { requester } = req.query; // Include the requester's username

    const group = groups.find(group => group.groupID === groupID);

    if (!group) {
        return res.status(404).json({ error: 'Group not found, Please enter a valid group ID' });
    }

    // Check if the requester is a member of the group
    if (!group.users.includes(requester)) {
        return res.status(403).json({ error: 'Only members of the group can calculate free time' });
    }

    try {
        const userData = await fs.readFile(USERS_DATA_PATH, 'utf8');
        const users = JSON.parse(userData);
        const groupMembersSchedules = group.users.map(username => {
            const user = users.find(user => user.username === username);
            return user ? { username: user.username, freeTime: user.freeTime } : null;
        }).filter(schedule => schedule !== null); // Remove null values

        res.json(groupMembersSchedules);
    } catch (error) {
        console.error('Error fetching group members schedules:', error);
        res.status(500).json({ error: 'Failed to fetch group members schedules' });
    }
});

// Route to add an event to Google Calendar for each user in the group and update user events
router.post('/groups/:groupID/addGoogleCalendarEvent', async (req, res) => {
    const { groupID } = req.params;
    const { eventDetails } = req.body;
    const group = groups.find(group => group.groupID === groupID);

    if (!group) {
        return res.status(404).json({ error: 'Group not found, Please enter a valid group ID' });
    }

    try {
        // Iterate over each user in the group
        for (const username of group.users) {
            const auth = await authorize(username); // Authorize for each user

            // Add event to Google Calendar
            const event = await insertEvent(auth, eventDetails); // Insert event for each user
            console.log(`Event added to Google Calendar for user ${username}`);

            // Add event to user's events array
            await updateUserEvents(username, eventDetails);
        }
        
        res.status(201).json({ message: 'Event added to Google Calendar for all users in the group' });
    } catch (error) {
        console.error('Error adding event to Google Calendar:', error);
        res.status(500).json({ error: 'Failed to add event to Google Calendar' });
    }
});

async function updateUserEvents(username, eventDetails) {
    try {
        const userData = await fs.readFile(USERS_DATA_PATH, 'utf8');
        const users = JSON.parse(userData);

        // Find the user by username and update events array
        const user = users.find(user => user.username === username);
        if (user) {
            user.events.push(eventDetails);
            await fs.writeFile(USERS_DATA_PATH, JSON.stringify(users, null, 2));
            console.log(`Event added to user ${username}'s events.`);
        } else {
            console.error(`User ${username} not found.`);
        }
    } catch (error) {
        console.error('Error updating user events:', error);
        throw error;
    }
}

// Route to fetch groups for a specific user
router.get('/users/:username/groups', async (req, res) => {
    const { username } = req.params;

    // Reload users data to get the latest data
    try {
        const userData = await fs.readFile(USERS_DATA_PATH, 'utf8');
        users = JSON.parse(userData);
    } catch (error) {
        console.error('Error reading users.json:', error);
        return res.status(500).json({ error: 'Failed to read users data' });
    }

    // Check if the user exists
    const userExists = users.some(user => user.username === username);
    if (!userExists) {
        console.log(`User not found: ${username}`);
        return res.status(404).json({ error: 'Username not found' });
    }

    // Find groups that the user belongs to
    const userGroups = groups.filter(group => group.users.includes(username));

    // Include the usernames in the response
    const userGroupsWithUsers = userGroups.map(group => ({
        groupID: group.groupID,
        name: group.name,
        users: group.users
    }));

    // Always return an array
    res.json(userGroupsWithUsers.length ? userGroupsWithUsers : []);
});

module.exports = router;
