import * as z from "zod";
import { rateLimit, validateToken } from "../middleware/index.js";
import { OpenApiRouter } from "../openapi.js";
import { status, statusSchema } from "../response.js";
import { PublicUserSchema, UserLoginRequestSchema } from "../schemas.js";
import type { Tokens } from "../tokens.js";
import type { Users } from "../users.js";

export function createAuthRouter(users: Users, tokens: Tokens) {
    const router = OpenApiRouter("/api", { tags: ["Authentication"] });

    router.post(
        "/login",
        {
            description: "Login",
            body: UserLoginRequestSchema,
            responses: {
                200: z.object({ token: z.string() }),
                401: statusSchema(401)
            }
        },
        rateLimit({
            windowMs: 60 * 1000,
            limit: 5
        }),
        async (req, res) => {
            const user = await users.findByUsername(req.body.username);
            if (user === null) return res.status(401).send(status(401));
            const token = await users.login(user, req.body.password);

            if (token === null) return res.status(401).send(status(401));
            res.json({ token });
        }
    );

    router.post(
        "/logout",
        { description: "Logout", body: z.void(), responses: { 204: z.void() } },
        rateLimit({
            windowMs: 60 * 1000,
            limit: 5
        }),
        validateToken(tokens),
        async (_req, res) => {
            await tokens.revoke(res.locals.token);
            res.status(204).end();
        }
    );

    router.get(
        "/userinfo",
        {
            description: "Get user info",
            responses: {
                200: z.union([PublicUserSchema, z.null()])
            }
        },
        rateLimit({
            windowMs: 60 * 1000,
            limit: 10
        }),
        validateToken(tokens),
        async (_req, res) => {
            res.send(await users.find(res.locals.uid));
        }
    );

    return router;
}
