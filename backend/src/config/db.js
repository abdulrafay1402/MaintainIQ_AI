const mongoose = require("mongoose");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI);
  }

  cached.conn = await cached.promise;

  console.log(`MongoDB connected: ${cached.conn.connection.host}`);

  return cached.conn;
};

module.exports = connectDB;