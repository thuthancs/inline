import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { config } from "dotenv";

config();

// Initialize Redis client (uses UPSTASH_REDIS_REST_KV_REST_API_URL and UPSTASH_REDIS_REST_KV_REST_API_TOKEN env vars)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

// Session expiry: 30 days in seconds
const SESSION_TTL = 60 * 60 * 24 * 30;

// Encryption key for tokens (32 bytes = 64 hex chars)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

export interface UserSession {
    accessToken: string;
    workspaceId: string;
    workspaceName: string;
    workspaceIcon: string | null;
    botId: string;
    userId: string | null;
    createdAt: number;
}

/**
 * Encrypt a string using AES-256-GCM
 */
function encrypt(text: string): string {
    if (!ENCRYPTION_KEY) {
        throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(ENCRYPTION_KEY, "hex"),
        iv
    );
    const encrypted = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 */
function decrypt(encrypted: string): string {
    if (!ENCRYPTION_KEY) {
        throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    const [ivHex, tagHex, dataHex] = encrypted.split(":");
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(ENCRYPTION_KEY, "hex"),
        Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(dataHex, "hex", "utf8") + decipher.final("utf8");
}

/**
 * Create a new session and store it in Redis
 */
export async function createSession(
    sessionId: string,
    data: Omit<UserSession, "createdAt">
): Promise<void> {
    const sessionData: UserSession = {
        ...data,
        accessToken: encrypt(data.accessToken), // Encrypt the token
        createdAt: Date.now(),
    };

    await redis.set(`session:${sessionId}`, JSON.stringify(sessionData), {
        ex: SESSION_TTL,
    });
}

/**
 * Get a session by ID, returns null if not found
 */
export async function getSession(sessionId: string): Promise<UserSession | null> {
    const data = await redis.get<string>(`session:${sessionId}`);
    if (!data) return null;

    const session: UserSession = typeof data === "string" ? JSON.parse(data) : data;

    // Decrypt the access token
    session.accessToken = decrypt(session.accessToken);

    return session;
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
}

/**
 * Refresh session TTL (extend expiry on activity)
 */
export async function touchSession(sessionId: string): Promise<void> {
    await redis.expire(`session:${sessionId}`, SESSION_TTL);
}

/**
 * Generate a secure random session ID
 */
export function generateSessionId(): string {
    return crypto.randomUUID();
}

