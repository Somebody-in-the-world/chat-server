import { Db } from "mongodb";
import express, { type NextFunction, type Request, type Response } from "express";
import { Chatrooms } from "./chatrooms.js";
import { Users } from "./users.js";
import { Tokens } from "./tokens.js";
import { Server } from "socket.io";
import { createServer } from "http";
import { createChatroomsRouter } from "./routes/chatrooms.js";
import { createUsersRouter } from "./routes/users.js";
import { createAuthRouter } from "./routes/auth.js";
import { addSocketHooks } from "./socket.js";
import { Messages } from "./messages.js";
import { logRequests } from "./middleware.js";
import cors from "cors";
import { buildOpenApiDocument } from "./openapi.js";
import swaggerUi from "swagger-ui-express";
import { createGeneralRouter } from "./routes/general.js";
import helmet from "helmet";

export function createApp({ db }: { db: Db }) {
    const app = express();

    const chatrooms = new Chatrooms(db);
    const tokens = new Tokens(db);
    const users = new Users(db, tokens);
    const messages = new Messages(db);

    const chatroomRoutes = createChatroomsRouter(chatrooms, tokens);
    const userRoutes = createUsersRouter(users, tokens);
    const authRoutes = createAuthRouter(users, tokens);
    const generalRoutes = createGeneralRouter(db);

    app.set("trust proxy", 1);

    app.use(
        cors({
            origin: process.env.CLIENT_URL
        })
    );
    app.use(
        helmet({
            crossOriginResourcePolicy: false,
            crossOriginOpenerPolicy: false,
            crossOriginEmbedderPolicy: false
        })
    );
    app.use(express.json());
    app.use(logRequests());

    chatroomRoutes.attach(app);
    userRoutes.attach(app);
    authRoutes.attach(app);
    generalRoutes.attach(app);

    const doc = buildOpenApiDocument({
        info: {
            title: "Chat API",
            version: "0.1.0"
        },
        servers: [
            {
                url: process.env.SERVER_URL,
                description: "Main server"
            }
        ]
    });
    app.get("/openapi.json", (_req, res) => res.send(doc));
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(doc));

    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof SyntaxError) {
            res.sendStatus(400);
            return;
        }
        console.error(`[SERVER ERROR] ${err.stack}`);
        res.sendStatus(500);
    });

    const server = createServer(app);
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL
        },
        connectionStateRecovery: {
            skipMiddlewares: false
        }
    });
    addSocketHooks(io, tokens, chatrooms, messages);

    return server;
}
