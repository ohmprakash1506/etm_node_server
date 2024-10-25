const { MongoClient } = require('mongodb');
// or as an es module:
// import { MongoClient } from 'mongodb'

// Connection URL
const url = 'mongodb+srv://eTravelMate:na36NnPr3YyEu1bi@cluster0.1qig8hs.mongodb.net?retryWrites=true&w=majority';
// const url = 'mongodb://localhost:27017?replicaSet=rs&retryWrites=true&w=majority';
const client = new MongoClient(url);

module.exports = client;