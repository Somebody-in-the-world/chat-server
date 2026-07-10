import crypto from "crypto";
import type { Collection, Db } from "mongodb";
import { TokenSchema, type Token } from "./schemas.js";

export class Tokens {
    private tokens: Collection<Token>;

    constructor(
        db: Db,
        private readonly ttl = 86400 * 14
    ) {
        this.tokens = db.collection("tokens");
    }

    async create(uid: string) {
        const token = crypto.randomBytes(32).toString("base64");
        await this.tokens.insertOne({
            uid,
            token,
            createdAt: new Date()
        });
        return token;
    }

    async revoke(token: string) {
        await this.tokens.deleteOne({ token });
    }

    async isValidToken(token_str: string) {
        const token = await this.tokens.findOne({ token: token_str });
        if (token === null) return false;
        const timeDiff = (Date.now() - token.createdAt.getTime()) / 1000;
        if (timeDiff > this.ttl) {
            return false;
        }
        return true;
    }

    async getTokenInfo(token: string) {
        const tokenInfo = await this.tokens.findOne({ token });
        if (tokenInfo === null) return null;
        return TokenSchema.parse(tokenInfo);
    }

    async cleanExpiredTokens() {
        this.tokens.deleteMany({
            createdAt: { $lt: new Date(Date.now() - this.ttl * 1000) }
        });
    }
}
