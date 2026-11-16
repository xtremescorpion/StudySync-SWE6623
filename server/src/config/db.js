/*
 * Database connection: Data Layer (Assignment 3, Figure 1 and Table 2.3).
 *
 * StudySync uses one database: MongoDB, cloud-hosted, as specified in the
 * Assignment 3 conclusion. The connection string lives in server/.env as
 * MONGODB_URI and is never committed.
 */
import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set.\n" +
        "Copy .env.example to server/.env and set MONGODB_URI to your MongoDB\n" +
        "connection string, for example:\n\n" +
        "  MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/studysync\n"
    );
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const { host, name } = mongoose.connection;
  console.log(`Connected to MongoDB (${host}/${name})`);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
