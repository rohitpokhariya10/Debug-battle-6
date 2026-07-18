import mongoose from 'mongoose';
import { env } from './env.js';
import dns from 'dns';

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);


/**
 * Establishes a connection to MongoDB using Mongoose.
 * Exits the process on failure to prevent a partially initialised app.
 */

const uri =
  "mongodb+srv://bhavyadhanwani1234_db_user:kM13nL79Wm9aTmS3@cluster0.qyfub1p.mongodb.net/tictactoe";



const connectDB = async () => {
  try {
  const conn = await mongoose.connect(uri);
  console.log(`✅ MongoDB connected to: ${conn.connection.host}`);
} catch (error) {
  console.error("Primary connection failed:", error);
  console.log("⚠️ Trying local fallback...");

  try {
    const conn = await mongoose.connect("mongodb://127.0.0.1:27017/xogame");
    console.log(`✅ MongoDB connected to local: ${conn.connection.host}`);
  } catch (fallbackError) {
    console.error("Fallback failed:", fallbackError);
    process.exit(1);
  }
}
};

export default connectDB;
