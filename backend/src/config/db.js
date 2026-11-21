const mongoose = require("mongoose");

// Serverless (Vercel)-এ প্রতিটি রিকোয়েস্টে নতুন কানেকশন না খুলে আগেরটা পুনরায় ব্যবহার হবে
let cached = global._mongooseCache;
if (!cached) cached = global._mongooseCache = { conn: null, promise: null };

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        bufferCommands: false,
      })
      .then((m) => {
        console.log("MongoDB Connected Successfully");
        return m;
      })
      .catch((error) => {
        cached.promise = null; // পরের রিকোয়েস্টে আবার চেষ্টা হবে
        console.error("MongoDB Connection Failed:", error.message);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;
