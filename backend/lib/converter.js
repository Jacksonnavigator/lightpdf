/**
 * converter.js – Run LibreOffice headless conversion
 *
 * Two modes:
 * - CONVERT_MODE=local: Backend runs in Docker with LibreOffice; run soffice in-process (same container).
 * - Otherwise: Backend on host; run "docker exec" into pdf-libreoffice container.
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { getDocDir, getDataDir } from "./storage.js";

const execAsync = promisify(exec);

const CONVERT_MODE = process.env.CONVERT_MODE || "docker";
const CONTAINER = process.env.LIBREOFFICE_CONTAINER || "pdf-libreoffice";
const DEFAULT_TIMEOUT_MS = Number(process.env.CONVERT_TIMEOUT_MS || 180000); // 3 minutes

const loFlags =
  "--headless --nologo --nolockcheck --nodefault --nofirststartwizard " +
  "-env:UserInstallation=file:///tmp/lo-profile";

/**
 * Convert a file using LibreOffice.
 * @param {string} inputPath - Full path to input file
 * @param {string} outputFormat - "docx" or "pdf"
 * @param {string} outputDir - Directory for output
 */
export async function convert(inputPath, outputFormat, outputDir) {
  const dataDir = getDataDir();
  const relInput = path.relative(dataDir, inputPath);
  const relOutput = path.relative(dataDir, outputDir);

  let cmd;
  if (CONVERT_MODE === "local") {
    // Backend in Docker: paths are already under /data, run soffice directly
    const inPath = path.join(dataDir, relInput).replace(/\\/g, "/");
    const outPath = path.join(dataDir, relOutput).replace(/\\/g, "/");
    cmd = `soffice ${loFlags} --convert-to ${outputFormat} --outdir "${outPath}" "${inPath}"`;
  } else {
    // Backend on host: paths in container are under /data
    const inputInContainer = path.join("/data", relInput).replace(/\\/g, "/");
    const outputInContainer = path.join("/data", relOutput).replace(/\\/g, "/");
    cmd = `docker exec ${CONTAINER} soffice ${loFlags} --convert-to ${outputFormat} --outdir "${outputInContainer}" "${inputInContainer}"`;
  }

  console.log("[converter] Running:", cmd);

  const { stderr, stdout } = await execAsync(cmd, {
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
  }).catch((err) => {
    const hint =
      CONVERT_MODE === "local"
        ? "Check LibreOffice is installed in the container."
        : `If Docker is not running, start Docker Desktop and retry. Ensure container '${CONTAINER}' is up (docker compose up -d).`;
    const timeoutMsg = err.killed
      ? `Conversion timed out after ${DEFAULT_TIMEOUT_MS}ms. `
      : "";
    throw new Error(
      `LibreOffice conversion failed. ${timeoutMsg}${err.message}\n${err.stderr || ""}\n${hint}`
    );
  });

  if (stdout) console.log("[converter]", stdout.trim());
  if (stderr) console.warn("[converter]", stderr.trim());

  const errText = (stderr || "").toLowerCase();
  if (errText.includes("could not be loaded") || (errText.includes("error:") && errText.includes("source file"))) {
    throw new Error(
      "The PDF could not be converted. It may be password-protected, corrupted, or in a format LibreOffice cannot open. Try a different PDF or remove protection."
    );
  }
}

/**
 * Convert PDF to DOCX
 */
export async function pdfToDocx(id) {
  const dir = getDocDir(id);
  const inputPdf = path.join(dir, "input.pdf");
  await convert(inputPdf, "docx", dir);

  // LibreOffice names the output based on the input filename.
  // input.pdf -> input.docx, but our app expects document.docx.
  const produced = path.join(dir, "input.docx");
  const target = path.join(dir, "document.docx");
  try {
    await fs.access(produced);
  } catch {
    throw new Error(
      "Conversion produced no DOCX. The PDF may be password-protected, corrupted, or in a format LibreOffice cannot open. Try a different PDF."
    );
  }
  try {
    await fs.rename(produced, target);
    console.log("[converter] Renamed input.docx -> document.docx");
  } catch (e) {
    await fs.copyFile(produced, target);
    console.log("[converter] Copied input.docx -> document.docx");
  }
}

/**
 * Convert DOCX to PDF
 */
export async function docxToPdf(id) {
  const dir = getDocDir(id);
  const inputDocx = path.join(dir, "document.docx");
  await convert(inputDocx, "pdf", dir);
}
