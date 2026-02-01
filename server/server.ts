import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "dotenv";
import express from "express";

// Routes
import authRouter from "./routes/auth.js";
import childrenRouter from "./routes/children.js";
import commentRouter from "./routes/comment.js";
import dataSourcesRouter from "./routes/dataSources.js";
import pagesRouter from "./routes/pages.js";
import saveRouter from "./routes/save.js";
import saveWithCommentRouter from "./routes/saveWithComment.js";
import searchRouter from "./routes/search.js";

config();

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Middleware
app.use(cors({ 
    origin: true, // Allow all origins but with credentials support
    credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

// Health check / root route
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Inline API Server" });
});

// Mount routes
app.use("/auth", authRouter);
app.use("/search", searchRouter);
app.use("/children", childrenRouter);
app.use("/", dataSourcesRouter);  // Handles /data-source/:id and /data-sources/:id
app.use("/create-page", pagesRouter);
app.use("/save", saveRouter);
app.use("/save-with-comment", saveWithCommentRouter);
app.use("/comment", commentRouter);

// For local development
if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(`Your app is listening on port ${PORT}`);
    });
}

// Export for Vercel serverless
export default app;
