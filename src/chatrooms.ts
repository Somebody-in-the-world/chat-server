import type { Collection, Db } from "mongodb";
import { ChatroomSchema, type Chatroom, type CreateChatroomRequest } from "./schemas.js";
import type { OperationResult } from "./db.js";
import type { DistributedOmit } from "type-fest";

export class Chatrooms {
    private rooms: Collection<Chatroom>;

    constructor(db: Db) {
        this.rooms = db.collection("chatrooms");
    }

    async create(
        name: string,
        createdBy: string,
        extra: DistributedOmit<Chatroom, "name" | "id" | "createdBy">
    ) {
        const id = crypto.randomUUID();
        const chatroom = {
            name,
            id,
            createdBy,
            ...extra
        } as const satisfies Chatroom;
        await this.rooms.insertOne(chatroom);
        return chatroom;
    }

    async exists(id: string) {
        const room = await this.rooms.findOne({ id });
        return room !== null;
    }

    async list() {
        return (await this.rooms.find().toArray()).map((room) => ChatroomSchema.parse(room));
    }

    async find(id: string) {
        const result = await this.rooms.findOne({ id });
        if (result === null) return null;
        return ChatroomSchema.parse(result);
    }

    async update(
        id: string,
        uid: string,
        updated: Partial<CreateChatroomRequest>
    ): Promise<OperationResult> {
        const room = await this.rooms.findOne({ id });
        if (room === null) return "not_found";
        if (room.createdBy !== uid) return "unauthorized";
        await this.rooms.updateOne({ id }, { $set: updated });
        return "success";
    }

    async delete(id: string, uid: string): Promise<OperationResult> {
        const room = await this.rooms.findOne({ id });
        if (room === null) return "not_found";
        if (room.createdBy !== uid) return "unauthorized";
        await this.rooms.deleteOne({ id });
        return "success";
    }
}
