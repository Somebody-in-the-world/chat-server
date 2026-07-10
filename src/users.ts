import type { Collection, Db } from "mongodb";
import { PublicUserSchema, type PublicUser, type User } from "./schemas.js";
import bcrypt from "bcrypt";
import type { Tokens } from "./tokens.js";

const PASSWORD_HASH_ROUNDS = 10;

export class Users {
    private users: Collection<User>;

    constructor(
        db: Db,
        private tokens: Tokens
    ) {
        this.users = db.collection("users");
    }

    async create(username: string, password: string) {
        if ((await this.users.findOne({ username })) !== null) {
            return null;
        }
        const uid = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
        const user = { uid, username };
        await this.users.insertOne({ ...user, passwordHash });
        return user;
    }

    async find(uid: string) {
        const user = await this.users.findOne({ uid });
        if (user === null) return null;
        return PublicUserSchema.parse(user);
    }

    async findByUsername(username: string) {
        const user = await this.users.findOne({ username });
        if (user === null) return null;
        return PublicUserSchema.parse(user);
    }

    async login(user: PublicUser, password: string) {
        const passwordHash = (await this.users.findOne({ uid: user.uid }))!.passwordHash;
        if (await bcrypt.compare(password, passwordHash)) {
            return await this.tokens.create(user.uid);
        }
        return null;
    }

    async delete(uid: string, deleter: string) {
        if (uid !== deleter) return "unauthorized";
        const { deletedCount } = await this.users.deleteOne({ uid });
        if (deletedCount === 0) return "not_found";
        return "success";
    }
}
