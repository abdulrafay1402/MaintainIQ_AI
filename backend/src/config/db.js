const mongoose = require("mongoose");
const dns = require("dns");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

const checkDnsResolution = (hostname) => {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, address) => {
      if (err) {
        reject(new Error(`DNS resolution failed for host ${hostname}: ${err.message}`));
      } else {
        resolve(address);
      }
    });
  });
};

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  if (!process.env.VERCEL) {
    // Extract hostname from MONGODB_URI
    const hostname = process.env.MONGODB_URI.split('@').pop().split('/').shift().split(':').shift();
    try {
      console.log(`Checking DNS resolution for MongoDB host: ${hostname}...`);
      await checkDnsResolution(hostname);
      console.log("DNS resolution: OK");
    } catch (dnsErr) {
      throw new Error(`MongoDB connection check failed: DNS lookup error. Details: ${dnsErr.message}`);
    }
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI);
  }

  cached.conn = await cached.promise;

  console.log(`MongoDB connected: ${cached.conn.connection.host}`);

  return cached.conn;
};

module.exports = connectDB;