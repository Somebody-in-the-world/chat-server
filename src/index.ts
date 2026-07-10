import { MongoClient } from "mongodb";
import { createApp } from "./server.js";
import { MongoMemoryServer } from "mongodb-memory-server";
import { configDotenv } from "dotenv";
configDotenv();

let URI;
if (process.env.NODE_ENV === "development") {
    const serv = await MongoMemoryServer.create();
    URI = serv.getUri();
} else {
    URI = process.env.MONGODB_URI;
}

if (!URI) throw new Error("Mongodb uri not defined");

const mongo = new MongoClient(URI);
const db = mongo.db(process.env.DB_NAME);
const PORT = Number(process.env.PORT);
const app = createApp({ db });

app.listen(PORT, "127.0.0.1");
