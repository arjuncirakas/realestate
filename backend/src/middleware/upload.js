import multer from 'multer';
import { ACCEPTED_MIME_TYPES, UPLOAD_LIMITS } from '../contracts/index.js';
import { ValidationError } from '../utils/app-error.js';

/**
 * Multipart upload handling (Section 5.2): memory storage behind the storage
 * adapter, at most 10 files of 10 MB each, and a fixed MIME allowlist.
 *
 * Files stay in memory rather than on disk because the storage adapter is the
 * only thing that decides where bytes end up — local disk in development, GCS in
 * production — and a temp file would have to be cleaned up on every error path.
 */

/**
 * Rejects anything outside the Section 5.2 allowlist.
 *
 * `mimetype` here is the client-declared type, so this is a first filter, not
 * proof of content. It is paired with a fixed server-side extension per type in
 * the storage adapter, so a mislabelled file can never be stored under an
 * attacker-chosen name or extension.
 *
 * @param {import('express').Request} req
 * @param {{ mimetype: string, fieldname: string, originalname: string }} file
 * @param {(error: Error | null, accept?: boolean) => void} callback
 * @returns {void}
 */
const fileFilter = (req, file, callback) => {
  if (!Object.hasOwn(ACCEPTED_MIME_TYPES, file.mimetype)) {
    callback(
      new ValidationError(
        'That file type is not supported. Upload a JPEG, PNG, WebP, MP4 or PDF.',
        [
          {
            field: file.fieldname,
            message: `${file.originalname}: ${file.mimetype} is not accepted`,
          },
        ],
      ),
    );
    return;
  }
  callback(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_LIMITS.maxFileSizeBytes,
    files: UPLOAD_LIMITS.maxFiles,
  },
  fileFilter,
});

/** Up to 10 files on the `files` field — property media and log media. */
export const uploadMediaFiles = upload.array(UPLOAD_LIMITS.fieldName, UPLOAD_LIMITS.maxFiles);

/** A single file on the `file` field — plot snapshots. */
export const uploadSingleFile = upload.single(UPLOAD_LIMITS.singleFieldName);

/**
 * Maps an accepted MIME type to the `MediaType` it is stored as.
 * @param {string} mimeType
 * @returns {string | null} null when the type is not on the allowlist
 */
export const mediaTypeForMimeType = (mimeType) => ACCEPTED_MIME_TYPES[mimeType] ?? null;
