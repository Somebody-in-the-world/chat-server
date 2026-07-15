import type { NextFunction, Request, Response } from "express";

export function logRequests() {
    return (req: Request, _res: Response, next: NextFunction) => {
        console.log(`${req.method} ${req.url}`);
        next();
    };
}
