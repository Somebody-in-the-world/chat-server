import { type Options, rateLimit as rateLimitMiddleware } from "express-rate-limit";
import z from "zod";
import { OpenApiMiddleware } from "../openapi.js";
import { err } from "../response.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type LiteralToZod<T> = T extends string | number | boolean | bigint | null | undefined
    ? z.ZodLiteral<T>
    : T extends [...infer R]
      ? z.ZodTuple<{
            [K in keyof R]: LiteralToZod<T[K]>;
        }>
      : z.ZodObject<{
            [K in keyof T]: LiteralToZod<T[K]>;
        }>;

function literalToZod<const T>(val: T): LiteralToZod<T> {
    if (typeof val !== "object" || val === null) return z.literal(val as any) as any;
    if (Array.isArray(val)) {
        return z.tuple(val.map((v) => literalToZod(v)) as any) as any;
    }
    return z.object(
        Object.fromEntries(Object.entries(val).map(([k, v]) => [k, literalToZod(v)]))
    ) as any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const rateLimit = <const TRateLimitResponse>(
    opts?: Partial<Omit<Options, "message">> & { message?: TRateLimitResponse }
) =>
    OpenApiMiddleware(
        {
            external: true,
            responses: {
                429: literalToZod(
                    opts?.message ??
                        err("Too many requests, please try again later.", { code: 429 })
                )
            }
        },
        rateLimitMiddleware({
            message: err("Too many requests, please try again later."),
            ...opts
        })
    );
