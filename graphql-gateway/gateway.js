// gateway.js

const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Define type definitions
const typeDefs = gql`
    type User {
        id: ID!
        username: String!
    }

    type Product {
        id: ID!
        name: String!
        price: Float!
        inventory: Int!
    }

    type Order {
        id: ID!
        userId: String!
        productId: String!
        quantity: Int!
    }

    input ProductInput {          # Define the input type for products
        name: String!
        price: Float!
        inventory: Int!
    }

    type Query {
        users: [User]
        user(id: ID!): User
        products: [Product]
        product(id: ID!): Product
        orders: [Order]
        order(id: ID!): Order
    }

    type Mutation {
        register(username: String!, password: String!): String
        login(username: String!, password: String!): String
        createProduct(input: ProductInput!): Product    # Updated to return Product
        placeOrder(userId: String!, productId: String!, quantity: Int!): String
    }
`;

// Define resolvers
const resolvers = {
    Query: {
        users: async () => {
            const response = await axios.get(`http://localhost:3001/users`);
            return response.data;
        },
        user: async (_, { id }) => {
            const response = await axios.get(`http://localhost:3001/users/${id}`);
            return response.data;
        },
        products: async () => {
            const response = await axios.get(`http://localhost:3002/products`);
            return response.data;
        },
        product: async (_, { id }) => {    // Added resolver for single order
            const response = await axios.get(`http://localhost:3002/products/${id}`);
            return response.data;
        },
        orders: async () => {
            const response = await axios.get(`http://localhost:3003/orders`);
            return response.data;
        },
        order: async (_, { id }) => {    // Added resolver for single order
            const response = await axios.get(`http://localhost:3003/orders/${id}`);
            return response.data;
        }
    },
    Mutation: {
        register: async (_, { username, password }) => {
            const response = await axios.post(`http://localhost:3001/register`, { username, password });
            return response.data.message;
        },
        login: async (_, { username, password }) => {
            const response = await axios.post(`http://localhost:3001/login`, { username, password });
            return response.data.token;
        },
        createProduct: async (_, { input }) => {   // Adjusted to accept input and return Product
            const response = await axios.post(`http://localhost:3002/products`, input);
            return response.data;  // Assuming your product service returns the created product object
        },
        placeOrder: async (_, { userId, productId, quantity }) => {
            const response = await axios.post(`http://localhost:3003/orders`, { userId, productId, quantity });
            return response.data.message;
        },
    },
};

// Create Apollo Server
const server = new ApolloServer({ typeDefs, resolvers });

const startServer = async () => {
    await server.start();
    server.applyMiddleware({ app });

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`GraphQL Gateway is running on http://localhost:${PORT}${server.graphqlPath}`);
    });
};

// Call the function to start the server
startServer();
