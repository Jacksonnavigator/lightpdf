import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

import { uploadSingle } from "./middleware/multerConfig.js";
import { pdfToDocx, docxToPdf } from "./lib/converter.js";
import {
  getDocPaths,
  getDocDir,
  readState,
  writeState,
  getDataDir,
} from "./lib/storage.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ─── Upload PDF ───────────────────────────────────────────────────────────────
app.post("/api/upload", uploadSingle, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { v4: uuidv4 } = await import("uuid");
    const id = uuidv4();
    const { dir, inputPdf } = getDocPaths(id);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(inputPdf, req.file.buffer);
    await writeState(id, { converting: true, ready: false, pdfReady: false });

    // Convert in background
    pdfToDocx(id)
      .then(() => writeState(id, { converting: false, ready: true, pdfReady: false }))
      .catch(async (err) => {
        console.error("[upload] Conversion failed:", err.message);
        await writeState(id, { converting: false, ready: false, error: err.message });
      });

    res.json({ id, message: "Upload received, converting…" });
  } catch (err) {
    console.error("[upload] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Poll conversion status ───────────────────────────────────────────────────
app.get("/api/status/:id", async (req, res) => {
  try {
    const state = await readState(req.params.id);
    res.json(state);
  } catch {
    res.status(404).json({ error: "Document not found" });
  }
});

// ─── Get Collabora editor config ──────────────────────────────────────────────
app.get("/api/doc/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const state = await readState(id);
    if (!state.ready) return res.status(400).json({ error: "Document not ready yet" });

    const docxUrl = `${BASE_URL}/files/${id}/document.docx`;
    const collaboraUrl = process.env.COLLABORA_URL || "http://localhost:9980";

    // Collabora WOPI src
    const wopiSrc = encodeURIComponent(`${BASE_URL}/wopi/files/${id}`);
    const editorUrl = `${collaboraUrl}/browser/dist/cool.html?WOPISrc=${wopiSrc}`;

    res.json({ editorUrl, docxUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── WOPI – CheckFileInfo ─────────────────────────────────────────────────────
app.get("/wopi/files/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { docx } = getDocPaths(id);
    const stat = await fs.stat(docx);

    res.json({
      BaseFileName: "document.docx",
      Size: stat.size,
      UserId: "user1",
      UserFriendlyName: "User",
      UserCanWrite: true,
      SupportsUpdate: true,
      SupportsLocks: false,
      LastModifiedTime: stat.mtime.toISOString(),
    });
  } catch (err) {
    res.status(404).json({ error: "File not found" });
  }
});

// ─── WOPI – GetFile ───────────────────────────────────────────────────────────
app.get("/wopi/files/:id/contents", async (req, res) => {
  try {
    const { docx } = getDocPaths(req.params.id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const data = await fs.readFile(docx);
    res.send(data);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// ─── WOPI – PutFile (save from Collabora) ────────────────────────────────────
app.post("/wopi/files/:id/contents", express.raw({ type: "*/*", limit: "100mb" }), async (req, res) => {
  try {
    const { id } = req.params;
    const { docx } = getDocPaths(id);
    await fs.writeFile(docx, req.body);

    // Convert updated DOCX → PDF
    await docxToPdf(id);
    await writeState(id, { converting: false, ready: true, pdfReady: true });

    res.json({ ok: true });
  } catch (err) {
    console.error("[wopi put]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve DOCX files (for direct download) ──────────────────────────────────
app.get("/files/:id/:filename", async (req, res) => {
  try {
    const filePath = path.join(getDataDir(), req.params.id, req.params.filename);
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// ─── Download final PDF ───────────────────────────────────────────────────────
app.get("/api/download/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { pdf } = getDocPaths(id);
    await fs.access(pdf);
    res.setHeader("Content-Disposition", `attachment; filename="document.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
    const data = await fs.readFile(pdf);
    res.send(data);
  } catch {
    res.status(404).json({ error: "PDF not ready. Save the document in the editor first." });
  }
});

// ─── Download DOCX ────────────────────────────────────────────────────────────
app.get("/api/download-docx/:id", async (req, res) => {
  try {
    const { docx } = getDocPaths(req.params.id);
    await fs.access(docx);
    res.setHeader("Content-Disposition", `attachment; filename="document.docx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const data = await fs.readFile(docx);
    res.send(data);
  } catch {
    res.status(404).json({ error: "DOCX not ready" });
  }
});

app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ Backend running at ${BASE_URL}`)
);
