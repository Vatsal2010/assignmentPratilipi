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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
}, { timestamps: true });

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
    
    try {
        await order.save();
        channel.sendToQueue('orderQueue', Buffer.from(JSON.stringify({ action: 'create', order })));
        res.status(201).json({ message: 'Order placed successfully' });
    } catch (error) {
        console.error('Error creating order:', error); // Log the error
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all orders
app.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find().populate('userId productId'); // Populate userId and productId
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error); // Log the error
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get an order by ID
app.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('userId productId'); // Populate userId and productId
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error); // Log the error
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Start the server
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Order Service is running on http://localhost:${PORT}`);
});
