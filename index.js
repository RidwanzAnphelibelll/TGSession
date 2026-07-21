#!/usr/bin/env node

const cors    = require('cors');
const path    = require('path');
const express = require('express');
const { router: apiRouter } = require('./routes/api');

const PORT = process.env.PORT || 3000;
const app  = express();

app.enable('trust proxy');
app.set('json spaces', 2);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
});

module.exports = app;
