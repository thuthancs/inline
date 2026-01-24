import cors from "cors";
import { config } from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import childrenRouter from "./routes/children.js";
import commentRouter from "./routes/comment.js";
import dataSourcesRouter from "./routes/dataSources.js";
import pagesRouter from "./routes/pages.js";
import saveRouter from "./routes/save.js";
import saveWithCommentRouter from "./routes/saveWithComment.js";
import searchRouter from "./routes/search.js";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Serve frontend
const CLIENT_DIR = path.join(__dirname, "..", "inline-client");
app.use(express.static(CLIENT_DIR));

app.get("/", (_req, res) => {
    res.sendFile(path.join(CLIENT_DIR, "index.html"));
});

// Mount routes
app.use("/search", searchRouter);
app.use("/children", childrenRouter);
app.use("/", dataSourcesRouter);  // Handles /data-source/:id and /data-sources/:id
app.use("/create-page", pagesRouter);
app.use("/save", saveRouter);
app.use("/save-with-comment", saveWithCommentRouter);
app.use("/comment", commentRouter);

app.listen(PORT, () => {
    console.log(`Your app is listening on port ${PORT}`);
});
