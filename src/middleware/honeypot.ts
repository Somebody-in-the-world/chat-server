import type { Request, RequestHandler, Response } from "express";
import { normalize } from "node:path";

export interface IpMetadata {
    ip: string;
    suspiciousStart: number;
    suspiciousCount: number;
    isBanned: boolean;
}

export interface IpStorage {
    get(ip: string): IpMetadata | undefined;
    set(ip: string, metadata: IpMetadata): void;
    delete(ip: string): void;
}

type HoneypotPath =
    | string
    | {
          path: string;
          type?: "exact" | "substring" | "basepath";
          method?: string | null;
      };

type HoneypotHandler = (req: Request, res: Response, metadata: IpMetadata) => void;

export interface HoneypotConfig {
    paths?: HoneypotPath[];
    banThreshold?: number;
    banDuration?: number;
    ipStorage?: IpStorage;
    banHandler?: HoneypotHandler;
    suspiciousHandler?: HoneypotHandler;
}

function matchMethod(method: string | null | undefined, recieved: string) {
    if (method === null || method === undefined) return true;
    return method.toUpperCase() === recieved.toUpperCase();
}

export class MemoryStorage implements IpStorage {
    #bannedIps = new Map<string, IpMetadata>();

    get(ip: string): IpMetadata | undefined {
        return this.#bannedIps.get(ip);
    }

    set(ip: string, metadata: IpMetadata): void {
        this.#bannedIps.set(ip, metadata);
    }

    delete(ip: string): void {
        this.#bannedIps.delete(ip);
    }
}

export const defaultBanHandler: HoneypotHandler = (_req, res) => {
    res.status(403)
        .type("html")
        .send(
            `
<!DOCTYPE html>
<head>
    <title>You have been banned</title>
</head>
<body>
    <h2>You have been banned from this site</h2>
    <p>
        You have been banned from accessing this site for an unknown amount of time
        due to suspicious activity.
    </p>
    <br />
    <p>
        If you believe this is an error, please contact the site owner for more information.
    </p>
</body>
            `.trim()
        );
};

export const defaultSuspiciousHandler: HoneypotHandler = () => {};

function checkSuspicious(req: Request, paths: HoneypotPath[]) {
    for (const path of paths) {
        if (typeof path === "string") {
            if (path === req.path) {
                return true;
            }
        } else {
            const matchPath = normalize(path.path);
            const receivedPath = normalize(req.path);
            switch (path.type) {
                case "exact":
                    if (matchPath === receivedPath && matchMethod(path.method, req.method)) {
                        return true;
                    }
                    break;
                case "substring":
                    if (receivedPath.includes(matchPath) && matchMethod(path.method, req.method)) {
                        return true;
                    }
                    break;
                case "basepath":
                    if (
                        receivedPath.startsWith(matchPath) &&
                        matchMethod(path.method, req.method)
                    ) {
                        return true;
                    }
                    break;
            }
        }
    }
    return false;
}

export const honeypot =
    (config?: HoneypotConfig): RequestHandler =>
    (req, res, next) => {
        const {
            paths = [],
            ipStorage = new MemoryStorage(),
            banThreshold = 5,
            banDuration = 60 * 60 * 1000,
            banHandler = defaultBanHandler,
            suspiciousHandler = defaultSuspiciousHandler
        } = config ?? {};

        const forwardedFor = req.headers["x-forwarded-for"];
        const ip =
            req.ip ??
            req.socket.remoteAddress ??
            (typeof forwardedFor === "string" ? forwardedFor.split(",")[0] : undefined);

        if (!ip) {
            console.warn("[Honeypot warning]: No IP for request, ignoring...");
            return;
        }

        let ipMetadata = ipStorage.get(ip);

        if (ipMetadata && Date.now() - ipMetadata.suspiciousStart > banDuration) {
            ipStorage.delete(ip);
            ipMetadata = undefined;
        }

        if (ipMetadata?.isBanned) {
            banHandler(req, res, ipMetadata);
            return;
        }

        const isSuspicious = checkSuspicious(req, paths);
        if (isSuspicious) {
            if (ipMetadata) {
                const suspiciousCount = ipMetadata.suspiciousCount + 1;
                ipStorage.set(ip, {
                    ...ipMetadata,
                    suspiciousCount,
                    isBanned: suspiciousCount >= banThreshold
                });
            } else {
                ipStorage.set(ip, {
                    ip,
                    suspiciousStart: Date.now(),
                    isBanned: false,
                    suspiciousCount: 1
                });
            }

            ipMetadata = ipStorage.get(ip);
            suspiciousHandler(req, res, ipMetadata!);
        }
        next();
    };
