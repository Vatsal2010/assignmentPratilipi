// productService.js

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

// Product Schema
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    inventory: { type: Number, required: true },
});

const Product = mongoose.model('Product', productSchema);

// RabbitMQ connection
let channel;
amqp.connect(process.env.RABBITMQ_URI, (error, connection) => {
    if (error) throw error;
    connection.createChannel((error, ch) => {
        if (error) throw error;
        channel = ch;
        channel.assertQueue('productQueue', { durable: false });
    });
});

// Create a product
app.post('/products', async (req, res) => {
    const { name, price, inventory } = req.body;
    const product = new Product({ name, price, inventory });
    await product.save();
    channel.sendToQueue('productQueue', Buffer.from(JSON.stringify({ action: 'create', product })));
    res.status(201).json({ message: 'Product created successfully' });
});

// Get all products
app.get('/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

// Update inventory
app.patch('/products/:id/inventory', async (req, res) => {
    const { inventory } = req.body;
    await Product.findByIdAndUpdate(req.params.id, { inventory });
    channel.sendToQueue('productQueue', Buffer.from(JSON.stringify({ action: 'update_inventory', id: req.params.id, inventory })));
    res.json({ message: 'Inventory updated successfully' });
});

// Start the server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Product Service is running on http://localhost:${PORT}`);
});
