import { Router } from "express";
import { getNotionClientFromSession, getSessionIdFromRequest } from "../services/notionClient.js";

const router = Router();

// Get a single data source with its properties
router.get("/data-source/:dataSourceId", async (req, res) => {
    try {
        // Get session and create Notion client
        const sessionId = getSessionIdFromRequest(req);
        if (!sessionId) {
            return res.status(401).json({ error: "Missing session ID" });
        }

        const notion = await getNotionClientFromSession(sessionId);
        if (!notion) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        const dataSourceId = req.params.dataSourceId;

        console.log("=== DATA SOURCE RETRIEVE DEBUG ===");
        console.log("Fetching data source:", dataSourceId);

        // Use the generic request method to call the data source endpoint
        const dataSource: any = await notion.request({
            method: 'get',
            path: `data_sources/${dataSourceId}`,
        });

        console.log("Data source retrieved:", dataSource.name);
        console.log("Properties:", Object.keys(dataSource.properties || {}).length);
        console.log("===================");

        return res.json(dataSource);
    } catch (e: any) {
        console.error("Data source retrieve error:", e);
        return res.status(500).json({
            error: e?.message || "Failed to retrieve data source"
        });
    }
});

// Get data sources for a database
router.get("/data-sources/:databaseId", async (req, res) => {
    try {
        // Get session and create Notion client
        const sessionId = getSessionIdFromRequest(req);
        if (!sessionId) {
            return res.status(401).json({ error: "Missing session ID" });
        }

        const notion = await getNotionClientFromSession(sessionId);
        if (!notion) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        const databaseId = req.params.databaseId;

        console.log("=== DATA SOURCES DEBUG ===");
        console.log("Fetching data sources for database:", databaseId);

        const database: any = await notion.databases.retrieve({
            database_id: databaseId
        });

        console.log("Database retrieved:", database.title);
        console.log("Data sources found:", database.data_sources?.length || 0);

        const dataSources = (database.data_sources || []).map((ds: any) => ({
            id: ds.id,
            type: "data_source",
            title: ds.name || "(Untitled data source)",
            url: null,
        }));

        console.log("Data sources:", dataSources);
        console.log("===================");

        return res.json(dataSources);
    } catch (e: any) {
        console.error("Data sources fetch error:", e);
        return res.status(500).json({
            error: e?.message || "Failed to fetch data sources"
        });
    }
});

export default router;
