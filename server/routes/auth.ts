import crypto from "crypto";
import { config } from "dotenv";
import { Router } from "express";
import {
    createSession,
    deleteSession,
    generateSessionId,
    getSession,
} from "../services/sessions.js";

config();

const router = Router();

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID!;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET!;
const REDIRECT_URI = process.env.REDIRECT_URI!;

/**
 * Step 1: Initiate OAuth flow
 * Redirects user to Notion's OAuth authorization page
 */
router.get("/notion", (req, res) => {
    if (!NOTION_CLIENT_ID || !REDIRECT_URI) {
        return res.status(500).json({
            error: "OAuth not configured. Missing NOTION_CLIENT_ID or REDIRECT_URI",
        });
    }

    const state = crypto.randomUUID();
    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", NOTION_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("state", state);

    // Store state in session/cookie for verification
    res.cookie("oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600000, // 10 minutes
    });

    res.redirect(authUrl.toString());
});

/**
 * Step 2: Handle OAuth callback
 * Notion redirects here with authorization code
 */
router.get("/callback", async (req, res) => {
    const { code, state } = req.query;
    const storedState = req.cookies?.oauth_state;

    // Verify state parameter
    if (!state || state !== storedState) {
        return res.status(400).json({ error: "Invalid state parameter" });
    }

    if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Missing authorization code" });
    }

    if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET || !REDIRECT_URI) {
        return res.status(500).json({
            error: "OAuth not configured. Missing credentials",
        });
    }

    try {
        // Exchange authorization code for access token
        const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString("base64")}`,
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("Token exchange failed:", tokenData);
            throw new Error(tokenData.error || "Token exchange failed");
        }

        // Generate session ID
        const sessionId = generateSessionId();

        // Store session in Redis
        await createSession(sessionId, {
            accessToken: tokenData.access_token,
            workspaceId: tokenData.workspace_id,
            workspaceName: tokenData.workspace_name,
            workspaceIcon: tokenData.workspace_icon || null,
            botId: tokenData.bot_id,
            userId: tokenData.owner?.user?.id || null,
        });

        // Clear OAuth state cookie
        res.clearCookie("oauth_state");

        // Redirect to success page with session ID
        const successUrl = new URL(`${REDIRECT_URI.replace("/auth/callback", "")}/auth/success`);
        successUrl.searchParams.set("session", sessionId);
        res.redirect(successUrl.toString());
    } catch (error: any) {
        console.error("OAuth callback error:", error);
        res.status(500).json({
            error: error.message || "OAuth authentication failed",
        });
    }
});

/**
 * Success page - Chrome extension will capture this URL
 */
router.get("/success", (_req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Successful</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    background: #f5f5f5;
                }
                .container {
                    text-align: center;
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                h1 { color: #333; margin-bottom: 0.5rem; }
                p { color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>✅ Authentication Successful</h1>
                <p>You can close this window and return to the extension.</p>
            </div>
        </body>
        </html>
    `);
});

/**
 * Verify session validity
 */
router.get("/session", async (req, res) => {
    const sessionId = req.headers["x-session-id"] as string;

    if (!sessionId) {
        return res.status(401).json({ error: "Missing session ID" });
    }

    try {
        const session = await getSession(sessionId);

        if (!session) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        res.json({
            connected: true,
            workspaceName: session.workspaceName,
            workspaceIcon: session.workspaceIcon,
            userId: session.userId,
        });
    } catch (error: any) {
        console.error("Session verification error:", error);
        res.status(500).json({ error: "Failed to verify session" });
    }
});

/**
 * Logout - delete session
 */
router.post("/logout", async (req, res) => {
    const sessionId = req.headers["x-session-id"] as string;

    if (!sessionId) {
        return res.status(400).json({ error: "Missing session ID" });
    }

    try {
        await deleteSession(sessionId);
        res.json({ ok: true });
    } catch (error: any) {
        console.error("Logout error:", error);
        res.status(500).json({ error: "Failed to logout" });
    }
});

export default router;

