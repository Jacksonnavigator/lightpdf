/**
 * storage.js – File paths and document state helpers
 *
 * Each document gets a folder: data/{uuid}/
 * - input.pdf       – Original uploaded PDF
 * - document.docx   – Converted DOCX (for OnlyOffice to edit)
 * - document.pdf    – Final PDF (after user saves in editor)
 *
 * We keep a simple state file (JSON) to track: converting, ready, pdfReady
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve data directory (from env or default).
 * Relative paths are resolved from project root (parent of backend/) so that
 * DATA_DIR=data => Pdf/data, which must match the folder Docker mounts as /data.
 */
export function getDataDir() {
  const dir = process.env.DATA_DIR ?? "data";
  if (path.isAbsolute(dir)) return dir;
  // Resolve from project root (backend's parent)
  return path.resolve(__dirname, "../../", dir);
}

/**
 * Get the folder path for a document by ID
 */
export function getDocDir(id) {
  return path.join(getDataDir(), id);
}

/**
 * Get paths for a document
 */
export function getDocPaths(id) {
  const dir = getDocDir(id);
  return {
    dir,
    inputPdf: path.join(dir, "input.pdf"),
    docx: path.join(dir, "document.docx"),
    pdf: path.join(dir, "document.pdf"),
    stateFile: path.join(dir, "state.json"),
  };
}

/**
 * Read document state (converting, ready, pdfReady)
 */
export async function readState(id) {
  const { stateFile } = getDocPaths(id);
  try {
    const raw = await fs.readFile(stateFile, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { converting: false, ready: false, pdfReady: false };
  }
}

/**
 * Write document state
 */
export async function writeState(id, state) {
  const { dir, stateFile } = getDocPaths(id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}
