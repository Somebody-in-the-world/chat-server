import { Socket, type DefaultEventsMap, type Server } from "socket.io";
import * as z from "zod";
import { JoinChatroomSchema, SendMessageSchema, type Token } from "./schemas.js";
import type { Tokens } from "./tokens.js";
import type { Chatrooms } from "./chatrooms.js";
import type { Messages } from "./messages.js";

function validate<T extends z.ZodType>(
    socket: Socket,
    event: string,
    schema: T,
    callback: (message: z.infer<T>, ack: (...args: unknown[]) => void) => void
) {
    socket.on(event, (message: unknown, ack: (...args: unknown[]) => void) => {
        const data = schema.safeParse(message);
        if (data.success) {
            callback(data.data, ack);
        } else {
            socket.emit("error", { event, errors: data.error.issues });
        }
    });
}

export function addSocketHooks(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, Token>,
    tokens: Tokens,
    chatrooms: Chatrooms,
    messages: Messages
) {
    const chatroomConnections = new Map<string, string>();

    io.use(async (socket, next) => {
        const token: unknown = socket.handshake.auth.token;
        if (token === undefined) {
            next(new Error("Token required"));
            return;
        }

        if (typeof token !== "string") {
            next(new Error("Token must be a string"));
            return;
        }

        if (!(await tokens.isValidToken(token))) {
            next(new Error("Invalid token"));
            return;
        }

        const tokenInfo = await tokens.getTokenInfo(token);
        socket.data = tokenInfo!;
        next();
    });

    io.on(
        "connection",
        (socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, Token>) => {
            validate(socket, "chatrooms:join", JoinChatroomSchema, async (req, ack) => {
                const exists = await chatrooms.exists(req.roomId);
                if (!exists) {
                    return socket.emit("error", "chatroom doesn't exist");
                }
                chatroomConnections.set(socket.id, req.roomId);
                ack({ messages: await messages.list(req.roomId) });
                socket.join(req.roomId);
            });

            validate(socket, "chatrooms:leave", z.undefined(), (_req) => {
                if (!chatroomConnections.has(socket.id)) {
                    return socket.emit("error", "not in any chatroom");
                }
                socket.leave(chatroomConnections.get(socket.id)!);
                chatroomConnections.delete(socket.id);
            });

            validate(socket, "messages:send", SendMessageSchema, async (req) => {
                if (!chatroomConnections.has(socket.id)) {
                    return socket.emit("error", "not in any chatroom");
                }
                const roomId: string = chatroomConnections.get(socket.id)!;
                const message = await messages.send(req.message, socket.data.uid, roomId);
                io.to(roomId).emit("messages:received", message);
            });

            socket.on("disconnecting", () => {
                chatroomConnections.delete(socket.id);
            });
        }
    );
}
