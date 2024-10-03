// orderService.js

const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib/callback_api');
require('dotenv').config();

const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Order Schema
const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
});

const Order = mongoose.model('Order', orderSchema);

// RabbitMQ connection
let channel;
amqp.connect(process.env.RABBITMQ_URI, (error, connection) => {
    if (error) throw error;
    connection.createChannel((error, ch) => {
        if (error) throw error;
        channel = ch;
        channel.assertQueue('orderQueue', { durable: false });
    });
});

// Create an order
app.post('/orders', async (req, res) => {
    const { userId, productId, quantity } = req.body;
    const order = new Order({ userId, productId, quantity });
    await order.save();
    channel.sendToQueue('orderQueue', Buffer.from(JSON.stringify({ action: 'create', order })));
    res.status(201).json({ message: 'Order placed successfully' });
});

app.get('/orders/:orderId', async (req, res) => {
    const { orderId } = req.params; // Extract the id from the request parameters
    try {
        const order = await Order.findById(orderId); // Use findById to fetch user by ID
        if (!order) return res.status(404).json({ message: 'User not found' }); // Check if user exists
        res.json(order); // Return the user data
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch user', error: error.message }); // Handle errors
    }
});

// Get all orders
app.get('/orders', async (req, res) => {
    const orders = await Order.find();
    res.json(orders);
});

// Start the server
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Order Service is running on http://localhost:${PORT}`);
});
