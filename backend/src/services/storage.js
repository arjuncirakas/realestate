import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { ACCEPTED_MIME_TYPES } from '../contracts/index.js';
import { InternalError, ValidationError } from '../utils/app-error.js';

/**
 * Object storage behind an adapter (Section 2.5). Application code imports
 * `storage` and never touches the filesystem or a cloud SDK directly, so the
 * production driver can change without a single module changing.
 *
 * The local driver is here; the GCS driver is WP3's `storage-gcs.js` and is
 * imported dynamically, so this file has no dependency on the GCS SDK.
 *
 * @typedef {object} StoredObject
 * @property {string} key    storage key to persist in `storage_key`
 * @property {string} url    public URL to persist in `url`
 * @property {number} size   bytes written
 *
 * @typedef {object} StorageAdapter
 * @property {string} driver                                   'local' or 'gcs'
 * @property {(args: PutArgs) => Promise<StoredObject>} put     stores one file
 * @property {(key: string) => Promise<void>} remove            deletes by key, tolerating a missing object
 * @property {(key: string) => string} urlFor                   public URL for a key
 *
 * @typedef {object} PutArgs
 * @property {Buffer} buffer            file contents, from multer memory storage
 * @property {string} contentType       MIME type, already checked by the upload middleware
 * @property {string} prefix            one of `STORAGE_PREFIX`
 */

/**
 * Extension per accepted MIME type. The client-supplied filename is never used
 * to build a key — that is what lets a `.php` or `../..` name become a stored
 * path. The declared type is on a fixed allowlist, so this map is total.
 */
const EXTENSION_BY_MIME_TYPE = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'application/pdf': '.pdf',
});

/**
 * Builds an opaque, collision-free storage key.
 * @param {{ prefix: string, contentType: string }} args
 * @returns {string} e.g. `property-media/9f1c….jpg`
 */
const buildKey = ({ prefix, contentType }) => {
  const extension = EXTENSION_BY_MIME_TYPE[contentType];
  if (!extension) {
    throw new ValidationError('That file type is not supported.');
  }
  if (!/^[a-z0-9-]+$/.test(prefix)) {
    throw new InternalError();
  }
  return `${prefix}/${randomUUID()}${extension}`;
};

/**
 * Local filesystem driver — the development default (Section 2.5). Files are
 * written under `LOCAL_STORAGE_PATH` and served by `app.js` at `/uploads`.
 *
 * @param {{ rootDirectory: string, publicBaseUrl: string }} config
 * @returns {StorageAdapter}
 */
export const createLocalStorageAdapter = ({ rootDirectory, publicBaseUrl }) => {
  /**
   * Resolves a key to an absolute path, refusing anything that escapes the root.
   * @param {string} key
   * @returns {string}
   */
  const resolveWithinRoot = (key) => {
    const absolute = path.resolve(rootDirectory, key);
    const boundary = `${path.resolve(rootDirectory)}${path.sep}`;
    // Defence in depth: keys are generated, never client-supplied, but a future
    // caller passing one through from a request must not be able to traverse.
    if (!absolute.startsWith(boundary)) {
      throw new InternalError();
    }
    return absolute;
  };

  return {
    driver: 'local',

    async put({ buffer, contentType, prefix }) {
      const key = buildKey({ prefix, contentType });
      const destination = resolveWithinRoot(key);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, buffer);
      return { key, url: `${publicBaseUrl}/${key}`, size: buffer.length };
    },

    async remove(key) {
      try {
        await unlink(resolveWithinRoot(key));
      } catch (error) {
        // Deleting an object that is already gone is the desired end state.
        if (error.code !== 'ENOENT') throw error;
      }
    },

    urlFor(key) {
      return `${publicBaseUrl}/${key}`;
    },
  };
};

/**
 * Selects the driver named by `STORAGE_DRIVER`.
 * @returns {Promise<StorageAdapter>}
 */
const resolveAdapter = async () => {
  if (env.STORAGE_DRIVER === 'gcs') {
    // Dynamic so the GCS SDK is neither imported nor required in development.
    // WP3 owns services/storage-gcs.js.
    let module;
    try {
      module = await import('./storage-gcs.js');
    } catch (error) {
      throw new Error(
        `STORAGE_DRIVER=gcs but services/storage-gcs.js could not be loaded: ${error.message}`,
        { cause: error },
      );
    }
    return module.createGcsStorageAdapter({
      bucket: env.GCS_BUCKET,
      projectId: env.GCS_PROJECT_ID,
    });
  }

  return createLocalStorageAdapter({
    rootDirectory: env.localStorageRoot,
    publicBaseUrl: env.publicUploadBaseUrl.replace(/\/$/, ''),
  });
};

/** The adapter every module uses. */
export const storage = await resolveAdapter();

/**
 * Where `app.js` should mount static file serving, or null when the driver
 * serves its own URLs.
 * @returns {{ directory: string } | null}
 */
export const getLocalStorageMount = () =>
  storage.driver === 'local' ? { directory: env.localStorageRoot } : null;

/**
 * The MIME types the storage layer can write, for callers that want to check
 * before reading a file into memory.
 * @returns {string[]}
 */
export const supportedContentTypes = () => Object.keys(ACCEPTED_MIME_TYPES);
