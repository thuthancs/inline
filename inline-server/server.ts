import { Client } from "@notionhq/client";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import path from "path";

config()

const app = express();
app.use(cors({ origin: "*" }));

// Notion SDK for JavaScript
const notion = new Client({ auth: process.env.NOTION_KEY });

// <http://expressjs.com/en/starter/static-files.html>
app.use(express.static("public"));
app.use(express.json());

// <http://expressjs.com/en/starter/basic-routing.html>
app.get("/", function (request: any, response: any) {
    response.sendFile(path.join(__dirname, "inline-client", "index.html"));
});

// listen for requests
const listener = app.listen(process.env.PORT, function () {
    console.log("Your app is listening on port " + listener.address().port);
});

// Search a page in Notion and return the page_id
app.post('/search', async (req: any, res: any) => {
    try {
        const query = String(req.body?.query ?? "").trim();
        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }

        const response = await notion.search({ query });

        // Convert Notion objects to a list of titles
        const titles = response.results.map((item: any) => {
            const titleProp = item.properties?.name;
            const titleFromProps =
                Array.isArray(titleProp) && titleProp.length
                    ? titleProp.map((t: any) => t.plain_text).join("")
                    : null;

            const titleFromTopLevel =
                item?.title && Array.isArray(item.title)
                    ? item.title.map((t: any) => t.plain_text).join("")
                    : null;

            return titleFromProps || titleFromTopLevel || "(Untitled)";
        })
        res.json({ titles });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: "Notion search failed" });
    }

    const port = Number(process.env.PORT ?? 3000);
    app.listen(port, () => console.log(`Listening on ${port}`));
});

// Add a new block to the page

// Add a new comment to a block

// Ask a question about a specific text
