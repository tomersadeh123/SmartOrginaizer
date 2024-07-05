const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();

// Serve static files from the "includes" directory
app.use(express.static(path.join(__dirname, 'includes')));

// Serve JSON files from the "jsonFiles" directory
app.use('/jsonFiles', express.static(path.join(__dirname, 'jsonFiles')));


app.use(express.json());

const PORT = process.env.PORT || 3000;

// CORS options
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Middleware to parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import route files
const userRoutes = require('./routes/userRoute.js');
const eventRoutes = require('./routes/eventRoute.js');
const groupRoutes = require('./routes/groupRoute.js');

// Use route middlewares
app.use('/users', userRoutes);
app.use('/events', eventRoutes);
app.use('/groups', groupRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});