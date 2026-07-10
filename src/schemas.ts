import * as z from "zod";

const UserId = z.string();

export const CreatePublicChatroomRequestSchema = z.object({
    name: z.string(),
    visibility: z.literal("public")
});

export const CreatePrivateChatroomRequestSchema = z.object({
    name: z.string(),
    visibility: z.literal("private"),
    members: z.array(UserId)
});

export const CreateChatroomRequestSchema = z.discriminatedUnion("visibility", [
    CreatePublicChatroomRequestSchema,
    CreatePrivateChatroomRequestSchema
]);

export const PublicChatroomSchema = CreatePublicChatroomRequestSchema.extend({
    visibility: z.literal("public"),
    id: z.string(),
    createdBy: UserId
});

export const PrivateChatroomSchema = PublicChatroomSchema.extend({
    visibility: z.literal("private"),
    members: z.array(UserId)
});

export const ChatroomSchema = z.discriminatedUnion("visibility", [
    PublicChatroomSchema,
    PrivateChatroomSchema
]);

export const CreateUserRequestSchema = z.object({
    username: z.string().nonempty(),
    password: z.string()
});

export const UserLoginRequestSchema = CreateUserRequestSchema.extend({});

export const UserSchema = z.object({
    uid: UserId,
    username: z.string(),
    passwordHash: z.string()
});

export const MessageSchema = z.object({
    content: z.string(),
    createdAt: z.date(),
    createdBy: UserId,
    id: z.string(),
    chatroomId: z.string()
});

export const TokenSchema = z.object({
    uid: UserId,
    token: z.string(),
    createdAt: z.date()
});

export const PublicUserSchema = UserSchema.omit({ passwordHash: true });

export const JoinChatroomSchema = z.object({
    roomId: z.string()
});

export const SendMessageSchema = z.object({
    message: z.string()
});

export type CreateChatroomRequest = z.infer<typeof CreateChatroomRequestSchema>;
export type PublicChatroom = z.infer<typeof PublicChatroomSchema>;
export type PrivateChatroom = z.infer<typeof PrivateChatroomSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type Chatroom = z.infer<typeof ChatroomSchema>;
export type User = z.infer<typeof UserSchema>;
export type PublicUser = z.infer<typeof PublicUserSchema>;
export type Token = z.infer<typeof TokenSchema>;
export type Message = z.infer<typeof MessageSchema>;
