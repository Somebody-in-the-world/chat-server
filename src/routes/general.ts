import * as z from "zod";
import { OpenApiRouter } from "../openapi.js";
import type { Db } from "mongodb";
import { rateLimit } from "../middleware.js";

export function createGeneralRouter(db: Db) {
    const router = OpenApiRouter("/api", { tags: ["General"] });

    router.get(
        "/status",
        {
            description: "Get status",
            responses: {
                200: z.object({
                    database: z.union([z.literal("up"), z.literal("down")]),
                    server: z.union([z.literal("up"), z.literal("down")])
                })
            }
        },
        rateLimit({
            windowMs: 60 * 1000,
            limit: 10
        }),
        async (_req, res) => {
            let dbUp = true;
            try {
                await db.command({ ping: 1 });
            } catch {
                dbUp = false;
            }
            res.status(200).send({
                database: dbUp ? "up" : "down",
                server: "up"
            });
        }
    );

    return router;
}
