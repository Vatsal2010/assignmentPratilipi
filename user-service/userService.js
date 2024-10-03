// userService.js

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const amqp = require('amqplib/callback_api');
require('dotenv').config();

const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// User Schema
const userSchema = new mongoose.Schema({
    id: { type: String, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET;

// RabbitMQ connection
let channel;
amqp.connect(process.env.RABBITMQ_URI, (error, connection) => {
    if (error) throw error;
    connection.createChannel((error, ch) => {
        if (error) throw error;
        channel = ch;
        channel.assertQueue('userQueue', { durable: false });
    });
});

 

// User Registration
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ id:"1",username, password: hashedPassword });
    await user.save();
    channel.sendToQueue('userQueue', Buffer.from(JSON.stringify({ action: 'register', username })));
    res.status(201).json({ message: 'User registered successfully' });
});

// User Login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username'); // Only return the username field
        return res.json(users);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch users', error: error.message });
    }
});

app.get('/users/:id', async (req, res) => {
    const { id } = req.params; // Extract the id from the request parameters
    try {
        const user = await User.findById(id); // Use findById to fetch user by ID
        if (!user) return res.status(404).json({ message: 'User not found' }); // Check if user exists
        res.json(user); // Return the user data
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch user', error: error.message }); // Handle errors
    }
});

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(403);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Protected route example
app.get('/profile', authenticateJWT, (req, res) => {
    res.json({ message: 'This is a protected route', userId: req.user.id });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`User Service is running on http://localhost:${PORT}`);
});
