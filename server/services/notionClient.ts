import { Client } from "@notionhq/client";
import { config } from "dotenv";

config();

export const notion = new Client({
    auth: process.env.NOTION_KEY,
    notionVersion: "2025-09-03"
});

export const NOTION_KEY = process.env.NOTION_KEY;
export const NOTION_VERSION = "2025-09-03";

