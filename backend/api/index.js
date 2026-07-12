require("dotenv").config();

const app = require("../app");
const connectDB = require("../config/db");

let connected = false;

module.exports = async (req, res) => {
  if (!connected) {
    await connectDB();
    connected = true;
  }

  return app(req, res);
};