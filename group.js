const express = require('express');
const axios = require('axios');
const userRoutes = express.Router();
const groupUrl = 'https://6733cd45a042ab85d1180908.mockapi.io/groups';
const apiUrl = 'https://6733cee0a042ab85d1180eb5.mockapi.io/users';
const messageApiUrl = 'https://6733cdbea042ab85d1180a9a.mockapi.io/messages'; 

// Define socket connection setup
const setupSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected to server:', socket.id);

        // Join group
        socket.on('join_group', async (groupName) => {
            socket.join(groupName);
            console.log(`${socket.id} joined group: ${groupName}`);

            // Fetch and send initial messages for the group
            try {
                const response = await axios.get(`${messageApiUrl}?group_name=${groupName}`);
                socket.emit('initial_messages', response.data);
            } catch (error) {
                console.error('Error fetching messages from Mock API:', error.message);
                socket.emit('error', { message: 'Unable to fetch messages' });
            }
        });

        // Send message to a group
        socket.on('send_message', async (data) => {
            const { groupName, sender, message } = data;
            try {
                await axios.post(messageApiUrl, {
                    sender_id: sender,
                    group_name: groupName,
                    content: message
                });

                // Emit message to all users in the group
                io.to(groupName).emit('receive_message', {
                    sender_id: sender,
                    content: message
                });
            } catch (error) {
                console.error('Error saving message to Mock API:', error.message);
                socket.emit('error', { message: 'Unable to send message' });
            }
        });

        // Send private message
        socket.on('send_message_pv', async (data) => {
            const { groupName, sender, message, receiver } = data;
            try {
                await axios.post(messageApiUrl, {
                    sender_id: sender,
                    group_name: groupName,
                    content: message,
                    receiver_id: receiver
                });

                // Emit the message to the specific receiver in the group
                io.to(groupName).emit('receive_message', {
                    sender_id: sender,
                    content: message,
                    receiver_id: receiver
                });
            } catch (error) {
                console.error('Error saving private message to Mock API:', error.message);
                socket.emit('error', { message: 'Unable to send private message' });
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected from server:', socket.id);
        });
    });
};

// Route to get chat users excluding the current user
userRoutes.get('/get-chat-users', async (req, res) => {
    const userId = req.query.userId;
    try {
        const response = await axios.get(apiUrl);
        const users = response.data;

        // Filter out the current user
        const chatUsers = users.filter(user => user.id !== userId);
        res.json(chatUsers);
    } catch (error) {
        console.error('Error fetching chat users from Mock API:', error.message);
        res.status(500).json({ error: 'Error fetching chat users' });
    }
});

// Route to add a new group
userRoutes.post('/add-group', async (req, res) => {
    const { name } = req.body;
    try {
        const response = await axios.post(groupUrl, { name });
        res.status(200).json({ message: 'Group added successfully', data: response.data });
    } catch (error) {
        console.error('Error adding group:', error.message);
        res.status(500).json({ error: 'Error adding group' });
    }
});

// Route to get multiple users' info by IDs
userRoutes.post('/multiple', async (req, res) => {
    const { user_ids } = req.body;

    // Validate `user_ids` array
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ error: 'Please provide a valid array of user_ids' });
    }

    try {
        // Create simultaneous requests for each user ID
        const requests = user_ids.map(id => axios.get(`${apiUrl}/${id}`));
        const responses = await Promise.all(requests);

        // Extract the needed data from responses
        const results = responses.map(response => ({
            id: response.data.id,
            username: response.data.username
        }));

        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching usernames from Mock API:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Export a function that takes io as a parameter
module.exports = (io) => {
    setupSocket(io);  // Setup the socket connection
    return userRoutes;
};
