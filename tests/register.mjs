import { register } from "node:module";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

// Pre-initialize global mongoose cache for unit test environments
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
global.mongooseCache = {
  conn: mongoose,
  promise: Promise.resolve(mongoose),
};

register(pathToFileURL("./tests/loader.mjs"));
