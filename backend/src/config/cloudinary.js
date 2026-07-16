const { v2: cloudinary } = require("cloudinary");
const dns = require("dns");

let isConnected = false;

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

const connectCloudinary = async () => {
  if (isConnected) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required");
  }

  if (!process.env.VERCEL) {
    try {
      console.log("Checking DNS resolution for Cloudinary host: api.cloudinary.com...");
      await checkDnsResolution("api.cloudinary.com");
      console.log("DNS resolution: OK");
    } catch (dnsErr) {
      throw new Error(`Cloudinary connection check failed: DNS lookup error. Details: ${dnsErr.message}`);
    }
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  if (process.env.VERCEL) {
    isConnected = true;
    return;
  }

  try {
    const pingResult = await cloudinary.api.ping();
    if (pingResult && pingResult.status === "ok") {
      console.log("Cloudinary connected: OK");
      isConnected = true;
    } else {
      throw new Error(`Unexpected ping response: ${JSON.stringify(pingResult)}`);
    }
  } catch (error) {
    console.error("Cloudinary connection failed:", error);
    const errMsg = error.error?.message || error.message || JSON.stringify(error);
    throw new Error(`Cloudinary connection error: ${errMsg}`);
  }
};

module.exports = {
  connectCloudinary,
  cloudinary,
};
