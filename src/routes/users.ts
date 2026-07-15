import * as z from "zod";
import { OpenApiRouter } from "../openapi.js";
import { status, statusSchema } from "../response.js";
import { CreateUserRequestSchema, PublicUserSchema } from "../schemas.js";
import type { Users } from "../users.js";
import { rateLimit, validateToken } from "../middleware/index.js";
import type { Tokens } from "../tokens.js";

export function createUsersRouter(users: Users, tokens: Tokens) {
    const router = OpenApiRouter("/api/users", { tags: ["Users"] });

    router.post(
        "/",
        {
            description: "Create a user",
            body: CreateUserRequestSchema,
            responses: {
                201: statusSchema(201),
                409: statusSchema(409)
            }
        },
        rateLimit({
            windowMs: 60 * 1000,
            limit: 3
        }),
        async (req, res) => {
            const user = await users.create(req.body.username, req.body.password);
            if (user === null) {
                return res.status(409).send(status(409));
            }
            res.setHeader("Location", `/api/users/${user.uid}`);
            res.status(201).send(status(201));
        }
    );

    router.get(
        "/:id",
        {
            description: "Get a user's info",
            params: z.object({
                id: z.string()
            }),
            responses: {
                200: PublicUserSchema,
                404: statusSchema(404)
            }
        },
        rateLimit({
            windowMs: 60 * 1000,
            limit: 10
        }),
        async (req, res) => {
            const id = req.params.id;
            const user = await users.find(id);
            if (user === null) return res.status(404).send(status(404));
            res.json(user);
        }
    );

    router.delete(
        "/:id",
        {
            description: "Delete a user",
            params: z.object({
                id: z.string()
            }),
            responses: {
                204: z.void(),
                404: statusSchema(404)
            }
        },
        validateToken(tokens),
        rateLimit({
            windowMs: 60 * 1000
        }),
        async (req, res) => {
            const id = req.params.id;
            const result = await users.delete(id, res.locals.uid);
            if (result === "not_found") return res.status(404).send(status(404));
            res.status(204).end();
        }
    );

    return router;
}
