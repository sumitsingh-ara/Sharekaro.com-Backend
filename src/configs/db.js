const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connect =()=>{
    return mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.bpl9j.mongodb.net/?retryWrites=true&w=majority`)
}


module.exports = connect;