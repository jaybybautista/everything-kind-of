import express from "express";
import cors from "cors";
import "dotenv/config";

import { requireAuth } from "./middleware/authMiddleware.js";
import geminiRoutes from "./routes/gemini.js";
import datamuseRoutes from "./routes/datamuse.js";
import discussionRoutes from "./routes/discussions.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/discussions", discussionRoutes);

// Every route below requires a valid Firebase ID token:
// keeps the Gemini API key
// server-side and only usable by logged-in users of this app.
app.use("/api/gemini", requireAuth, geminiRoutes);
app.use("/api/datamuse", requireAuth, datamuseRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
