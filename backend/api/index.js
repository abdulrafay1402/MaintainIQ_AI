require("dotenv").config();

const app = require("../src/app");
const connectDB = require("../src/config/db");
const { connectCloudinary } = require("../src/config/cloudinary");
const { connectEmail } = require("../src/services/emailService");

let connected = false;

module.exports = async (req, res) => {
  if (!connected) {
    await connectDB();
    await connectCloudinary();
    await connectEmail();
    connected = true;
  }

  return app(req, res);
};