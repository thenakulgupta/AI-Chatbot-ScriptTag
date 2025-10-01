const mongoose = require("mongoose");
require("dotenv").config();

// MongoDB connection configuration
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/chatbot-script";

// Connection options
const options = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};

// Connection state tracking
let isConnected = false;
let connectionAttempts = 0;
const maxConnectionAttempts = 5;

/**
 * Connect to MongoDB
 */
async function connectToDatabase() {
  if (isConnected) {
    console.log("📦 MongoDB already connected");
    return mongoose.connection;
  }

  try {
    console.log("🔄 Connecting to MongoDB...");

    const connection = await mongoose.connect(MONGODB_URI, options);

    isConnected = true;
    connectionAttempts = 0;

    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Database: ${connection.connection.name}`);
    console.log(
      `🌐 Host: ${connection.connection.host}:${connection.connection.port}`
    );

    return connection;
  } catch (error) {
    connectionAttempts++;
    console.error(
      `❌ MongoDB connection failed (attempt ${connectionAttempts}/${maxConnectionAttempts}):`,
      error.message
    );

    if (connectionAttempts >= maxConnectionAttempts) {
      console.error("💥 Max connection attempts reached. Exiting...");
      process.exit(1);
    }

    // Wait before retrying (exponential backoff)
    const waitTime = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
    console.log(`⏳ Retrying in ${waitTime}ms...`);

    setTimeout(() => {
      connectToDatabase();
    }, waitTime);
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectFromDatabase() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("👋 MongoDB disconnected");
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error.message);
  }
}

/**
 * Get connection status
 */
function getConnectionStatus() {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
  };
}

/**
 * Handle connection events
 */
mongoose.connection.on("connected", () => {
  console.log("🔗 Mongoose connected to MongoDB");
  isConnected = true;
});

mongoose.connection.on("error", (error) => {
  console.error("❌ Mongoose connection error:", error);
  isConnected = false;
});

mongoose.connection.on("disconnected", () => {
  console.log("🔌 Mongoose disconnected from MongoDB");
  isConnected = false;
});

// Handle process termination
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT. Closing MongoDB connection...");
  await disconnectFromDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM. Closing MongoDB connection...");
  await disconnectFromDatabase();
  process.exit(0);
});

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
  getConnectionStatus,
  mongoose,
};
