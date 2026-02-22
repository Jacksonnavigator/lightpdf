/**
 * multerConfig.js – Multer configuration for PDF uploads
 *
 * Multer handles multipart/form-data (file uploads).
 * We store files in memory (memoryStorage) to move them to our data folder after validation.
 * Alternative: diskStorage to write directly to disk.
 */

import multer from "multer";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIMES = ["application/pdf"];

/**
 * Multer middleware: single file, field name "file"
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error("Only PDF files are allowed"), false);
    }
    cb(null, true);
  },
});

export const uploadSingle = upload.single("file");
