import httpStatus from "http-status";
import z from "zod";

export function err<const T extends string, const U extends Record<PropertyKey, unknown>>(
    message: T,
    extra?: U
) {
    return { type: "error", message, ...extra } as const;
}

export function errSchema<const T extends string, const U extends Record<PropertyKey, unknown>>(
    message: T,
    extra?: U
) {
    return z.object({ type: z.literal("error"), message: z.literal(message), ...extra });
}

export function success<const T extends string, const U extends Record<PropertyKey, unknown>>(
    message: T,
    extra?: U
) {
    return { type: "success", message, ...extra } as const;
}

export function successSchema<const T extends string, const U extends Record<PropertyKey, unknown>>(
    message: T,
    extra?: U
) {
    return z.object({ type: z.literal("success"), message: z.literal(message), ...extra });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function status<const T extends keyof typeof httpStatus & number>(
    code: T
): (`${T}` extends `4${number}` ? 1 : `${T}` extends `5${number}` ? 1 : 0) extends 1
    ? ReturnType<typeof err<(typeof httpStatus)[T], { code: T }>>
    : ReturnType<typeof success<(typeof httpStatus)[T], { code: T }>> {
    return (
        code >= 400 ? err(httpStatus[code], { code }) : success(httpStatus[code], { code })
    ) as any;
}

export function statusSchema<const T extends keyof typeof httpStatus & number>(
    code: T
): (`${T}` extends `4${number}` ? 1 : `${T}` extends `5${number}` ? 1 : 0) extends 1
    ? ReturnType<typeof errSchema<(typeof httpStatus)[T], { code: T }>>
    : ReturnType<typeof successSchema<(typeof httpStatus)[T], { code: T }>> {
    return (
        code >= 400
            ? errSchema(httpStatus[code], { code: z.literal(code) })
            : successSchema(httpStatus[code], { code: z.literal(code) })
    ) as any;
}
