const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const GROUPS_DATA_PATH = path.join(__dirname, '../jsonFiles/groups.json');



let groups = []; // Initialize groups array

// Load groups data asynchronously when server starts
fs.readFile('jsonFiles/groups.json')
    .then(data => {
        if (data.length > 0) {
            groups = JSON.parse(data); // Parse JSON data
        }
    })
    .catch(err => {
        console.error('Error reading groups.json:', err);
    });

// Route to create a group
router.post('/groups', async (req, res) => {
    const { groupName } = req.body;

    // Check if groupName is provided
    if (!groupName) {
        return res.status(400).json({ error: 'Group name is required' });
    }

    try {
        // Check if groupName already exists
        const groupExistsIndex = groups.findIndex(group => group.name === groupName);
        if (groupExistsIndex !== -1) {
            return res.status(400).json({ error: 'Group name already taken, please try another name' });
        }

        // If groupName is unique, push the new group into groups array
        groups.push({ name: groupName, users: [] });
        await saveGroupsToFile(groups);
        res.status(201).json({ message: 'Group created successfully' });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});




// Route to add a user to a group
router.post('/groups/:groupName/users', (req, res) => {
  const { groupName } = req.params;
  const { username } = req.body;
  const group = groups.find(group => group.name === groupName);
  if (!group) {
      return res.status(404).json({ error: 'Group not found' });
  }
  if (!username) {
      return res.status(400).json({ error: 'Username is required' });
  }
  group.users.push(username);
  saveGroupsToFile(groups); // Pass the groups array here
  res.status(201).json({ message: 'User added to group successfully' });
});

// Function to save groups data to groups.json
async function saveGroupsToFile(groups) {
try {
    await fs.writeFile('jsonFiles/groups.json', JSON.stringify(groups, null, 2));
    console.log('Groups data saved to groups.json');
} catch (error) {
    console.error('Error saving groups data to groups.json:', error);
    throw error; // Re-throw the error to be caught by the caller
}
}

module.exports = router;