import { Client } from "@notionhq/client";
import { config } from "dotenv";
import { getSession } from "./sessions.js";

config();

export const NOTION_VERSION = "2025-09-03";

/**
 * Create a Notion client with a specific access token
 * Used for per-user OAuth tokens
 */
export function createNotionClient(accessToken: string): Client {
    return new Client({
        auth: accessToken,
        notionVersion: NOTION_VERSION,
    });
}

/**
 * Get a Notion client for a specific session
 * Returns null if session is invalid or expired
 */
export async function getNotionClientFromSession(sessionId: string): Promise<Client | null> {
    if (!sessionId) return null;
    
    const session = await getSession(sessionId);
    if (!session?.accessToken) return null;
    
    return createNotionClient(session.accessToken);
}

/**
 * Helper to extract session ID from request headers
 */
export function getSessionIdFromRequest(req: { headers: { [key: string]: string | string[] | undefined } }): string | null {
    const sessionId = req.headers["x-session-id"];
    if (typeof sessionId === "string") return sessionId;
    if (Array.isArray(sessionId)) return sessionId[0] || null;
    return null;
}
