import { OpenApiMiddleware } from "../openapi.js";
import { status, statusSchema } from "../response.js";
import { TokenSchema } from "../schemas.js";
import type { Tokens } from "../tokens.js";

export const validateToken = (tokens: Tokens) =>
    OpenApiMiddleware(
        {
            locals: TokenSchema,
            responses: {
                401: statusSchema(401)
            },
            security: {
                type: "http",
                description: "Token used for actions",
                scheme: "bearer",
                bearerFormat: "opaque"
            }
        },
        async (req, res, next) => {
            const token = req.headers.authorization?.split(" ")[1];
            if (token === undefined) {
                res.status(401).send(status(401));
                return;
            }
            if (await tokens.isValidToken(token)) {
                res.locals = (await tokens.getTokenInfo(token))!;
                next();
                return;
            }
            res.status(401).send(status(401));
        }
    );
