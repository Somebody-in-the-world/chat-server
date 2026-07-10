import type { Collection, Db } from "mongodb";
import { MessageSchema, type Message } from "./schemas.js";
import type { OperationResult } from "./db.js";

export class Messages {
    private messages: Collection<Message>;

    constructor(db: Db) {
        this.messages = db.collection("messages");
    }

    async send(content: string, createdBy: string, chatroomId: string) {
        const id = crypto.randomUUID();
        const message = {
            content,
            createdBy,
            chatroomId,
            createdAt: new Date(),
            id
        };

        await this.messages.insertOne(message);

        return message;
    }

    async readMessage(id: string) {
        const message = await this.messages.findOne({ id });
        return message ? MessageSchema.parse(message) : null;
    }

    async list(chatroomId: string) {
        const messages = await this.messages.find({ chatroomId }).toArray();
        return messages.map((message) => MessageSchema.parse(message));
    }

    async update(content: string, uid: string, id: string): Promise<OperationResult> {
        const message = await this.messages.findOne({ id });
        if (message === null) return "not_found";
        if (message.createdBy !== uid) return "unauthorized";
        this.messages.updateOne({ id }, { $set: { content } });
        return "success";
    }

    async delete(uid: string, id: string): Promise<OperationResult> {
        const message = await this.messages.findOne({ id });
        if (message === null) return "not_found";
        if (message.createdBy !== uid) return "unauthorized";
        this.messages.deleteOne({ id });
        return "success";
    }
}
