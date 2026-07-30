import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { InternalError, ValidationError } from '../utils/app-error.js';

/**
 * Google Cloud Storage driver for the storage adapter (Section 2.5), loaded
 * dynamically by `services/storage.js` only when `STORAGE_DRIVER=gcs`. No
 * other module imports the GCS SDK — this file is the one place it is
 * allowed, and even here only through `createGcsStorageAdapter`.
 *
 * Nothing in local development exercises this path, so it is covered by unit
 * tests against a mocked `@google-cloud/storage` client (`storage-gcs.test.js`)
 * rather than a real bucket.
 */

/**
 * Extension per accepted MIME type — identical table to the local driver, so
 * a key built here looks the same regardless of which driver wrote it. The
 * client-supplied filename is never used to build a key.
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
 * A GCS "object not found" error, so `remove` can tolerate deleting something
 * that is already gone, exactly like the local driver.
 * @param {unknown} error
 * @returns {boolean}
 */
const isNotFound = (error) => error?.code === 404;

/**
 * Creates the GCS-backed storage adapter, matching the local driver's shape
 * exactly (`{ driver, put, remove, urlFor }`) so no calling module can tell
 * which driver it is talking to.
 *
 * @param {{ bucket: string, projectId: string }} config
 * @returns {import('./storage.js').StorageAdapter}
 */
export const createGcsStorageAdapter = ({ bucket, projectId }) => {
  const client = new Storage({ projectId });
  const bucketRef = client.bucket(bucket);

  /**
   * The public URL a stored object is served at. Bucket objects are served
   * directly from GCS in production; there is no local static mount.
   * @param {string} key
   * @returns {string}
   */
  const urlFor = (key) => `https://storage.googleapis.com/${bucket}/${key}`;

  return {
    driver: 'gcs',

    async put({ buffer, contentType, prefix }) {
      const key = buildKey({ prefix, contentType });
      await bucketRef.file(key).save(buffer, { contentType, resumable: false });
      return { key, url: urlFor(key), size: buffer.length };
    },

    async remove(key) {
      try {
        await bucketRef.file(key).delete();
      } catch (error) {
        // Deleting an object that is already gone is the desired end state.
        if (!isNotFound(error)) throw error;
      }
    },

    urlFor,
  };
};
