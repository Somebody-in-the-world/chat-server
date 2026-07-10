import * as z from "zod";
import type { Chatrooms } from "../chatrooms.js";
import { rateLimit, validateToken } from "../middleware.js";
import { OpenApiRouter } from "../openapi.js";
import {
    ChatroomSchema,
    CreateChatroomRequestSchema,
    CreatePrivateChatroomRequestSchema,
    CreatePublicChatroomRequestSchema
} from "../schemas.js";
import type { Tokens } from "../tokens.js";
import { status, statusSchema } from "../response.js";

export function createChatroomsRouter(chatrooms: Chatrooms, tokens: Tokens) {
    const router = OpenApiRouter("/api/chatrooms", { tags: ["Chatrooms"] });
    router.post(
        "/",
        {
            description: "Creates a chatroom",
            body: CreateChatroomRequestSchema,
            responses: {
                201: statusSchema(201)
            }
        },
        rateLimit({
            windowMs: 20 * 1000,
            limit: 5
        }),
        validateToken(tokens),
        async (req, res) => {
            const chatroom = await chatrooms.create(req.body.name, res.locals.uid, req.body);
            res.setHeader("Location", `/api/chatrooms/${chatroom.id}`);
            res.status(201).send(status(201));
        }
    );

    router.patch(
        "/:id",
        {
            description: "Updates a chatroom",
            body: z.union([
                CreatePublicChatroomRequestSchema.partial().omit({ visibility: true }),
                CreatePrivateChatroomRequestSchema.partial().omit({ visibility: true })
            ]),
            params: z.object({
                id: z.string()
            }),
            responses: {
                401: statusSchema(401),
                404: statusSchema(404),
                204: z.void()
            }
        },
        rateLimit({
            windowMs: 20 * 1000,
            limit: 5
        }),
        validateToken(tokens),
        async (req, res) => {
            const result = await chatrooms.update(req.params.id, res.locals.uid, req.body);
            if (result === "unauthorized") return res.status(401).send(status(401));
            if (result === "not_found") return res.status(404).send(status(404));
            res.status(204).end();
        }
    );

    router.delete(
        "/:id",
        {
            description: "Delete a chatroom",
            params: z.object({ id: z.string() }),
            responses: {
                401: statusSchema(401),
                204: z.void()
            }
        },
        rateLimit({
            windowMs: 20 * 1000,
            limit: 5
        }),
        validateToken(tokens),
        async (req, res) => {
            const result = await chatrooms.delete(req.params.id, res.locals.uid);
            if (result === "unauthorized") return res.status(401).send(status(401));
            res.status(204).end();
        }
    );

    router.get(
        "/:id",
        {
            description: "Get a chatroom's info",
            responses: {
                200: ChatroomSchema,
                404: statusSchema(404)
            },
            params: z.object({ id: z.string() })
        },
        rateLimit({
            windowMs: 15 * 1000,
            limit: 5
        }),
        async (req, res) => {
            const id = req.params.id;
            const result = await chatrooms.find(id);
            if (result === null) {
                return res.status(404).send(status(404));
            }
            res.json(result);
        }
    );

    router.get(
        "/",
        {
            description: "Get all chatrooms' info",
            responses: { 200: z.array(ChatroomSchema) }
        },
        rateLimit({
            windowMs: 30 * 1000,
            limit: 5
        }),
        async (_req, res) => {
            res.json(await chatrooms.list());
        }
    );

    return router;
}
