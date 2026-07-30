import { prisma } from '../../config/prisma.js';
import { STORAGE_PREFIX } from '../../config/constants.js';
import { mediaTypeForMimeType } from '../../middleware/upload.js';
import { storage } from '../../services/storage.js';
import { MediaType } from '../../contracts/index.js';
import { NotFoundError, ValidationError } from '../../utils/app-error.js';
import { toMediaResponse } from './media.helpers.js';

/**
 * All data access and business rules for property media (Section 5.2):
 * upload, cover handling, ordering and delete. Controllers never touch Prisma
 * or the storage adapter directly.
 */

/**
 * Confirms a property exists before any upload work touches storage, so an
 * upload to a missing property fails fast with 404 rather than writing bytes
 * nobody can reach.
 * @param {string} propertyId
 * @returns {Promise<void>}
 */
const assertPropertyExists = async (propertyId) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) throw new NotFoundError('No property found with that id.');
};

/**
 * Removes storage objects that were written but never made it into a
 * database row (an upload that failed partway through), so a crash never
 * leaves billable, unreferenced bytes behind.
 * @param {Array<{ key: string }>} stored
 * @returns {Promise<void>}
 */
const cleanupOrphans = async (stored) => {
  await Promise.all(stored.map(({ key }) => storage.remove(key).catch(() => {})));
};

/**
 * Uploads up to 10 files to a property's gallery.
 *
 * Bytes are written to storage first, one file at a time, then recorded in a
 * single database transaction. If the transaction fails after some files were
 * already stored, every object written during this call is removed again —
 * an upload either fully lands or leaves nothing behind.
 *
 * The first uploaded **image** becomes the cover automatically when the
 * property has no cover yet (a video or document uploaded first is never
 * promoted to cover — that stays an agent's explicit choice via `PATCH`).
 * The partial unique index on `property_media` is the backstop: even a race
 * between two concurrent uploads can only ever leave one cover standing.
 *
 * @param {{ propertyId: string, files: Array<{ buffer: Buffer, mimetype: string, originalname: string }>, fields: { caption?: string, sortOrder?: number } }} args
 * @returns {Promise<Array<ReturnType<typeof toMediaResponse>>>}
 */
export const uploadPropertyMedia = async ({ propertyId, files, fields }) => {
  if (!files || files.length === 0) {
    throw new ValidationError('Attach at least one file to upload.', [
      { field: 'files', message: 'No files were received' },
    ]);
  }

  await assertPropertyExists(propertyId);

  const [existingCover, maxSortOrder] = await Promise.all([
    prisma.propertyMedia.findFirst({ where: { propertyId, isCover: true }, select: { id: true } }),
    prisma.propertyMedia.aggregate({ where: { propertyId }, _max: { sortOrder: true } }),
  ]);

  const startingSortOrder = fields.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

  // Resolve every file's type up front so a rejected mime type never touches
  // storage — this is a defence-in-depth check; the upload middleware's
  // `fileFilter` already rejects anything off the allowlist.
  const planned = files.map((file, index) => {
    const type = mediaTypeForMimeType(file.mimetype);
    if (!type) {
      throw new ValidationError('That file type is not supported.', [
        { field: 'files', message: `${file.originalname}: ${file.mimetype} is not accepted` },
      ]);
    }
    return { file, type, sortOrder: startingSortOrder + index };
  });

  const firstImageIndex = existingCover
    ? -1
    : planned.findIndex(({ type }) => type === MediaType.IMAGE);

  const stored = [];
  try {
    for (const { file } of planned) {
      // Sequential, not Promise.all: keeps the cleanup list exact if a later
      // file in the batch fails.
      stored.push(
        await storage.put({
          buffer: file.buffer,
          contentType: file.mimetype,
          prefix: STORAGE_PREFIX.propertyMedia,
        }),
      );
    }

    const rows = await prisma.$transaction(
      planned.map(({ type, sortOrder }, index) =>
        prisma.propertyMedia.create({
          data: {
            propertyId,
            type,
            storageKey: stored[index].key,
            url: stored[index].url,
            caption: fields.caption ?? null,
            sortOrder,
            isCover: index === firstImageIndex,
          },
        }),
      ),
    );

    return rows.map(toMediaResponse);
  } catch (error) {
    await cleanupOrphans(stored);
    throw error;
  }
};

/**
 * Updates caption, sort order and/or cover status on one media item.
 *
 * Setting `isCover: true` clears the flag on every other media row for the
 * same property inside the same transaction as the update — the only way to
 * respect the partial unique index without a window where two rows are both
 * covers, or briefly none are.
 *
 * @param {{ mediaId: string, patch: { caption?: string | null, sortOrder?: number, isCover?: boolean } }} args
 * @returns {Promise<ReturnType<typeof toMediaResponse>>}
 */
export const updateMedia = async ({ mediaId, patch }) => {
  const existing = await prisma.propertyMedia.findUnique({ where: { id: mediaId } });
  if (!existing) throw new NotFoundError('No media item found with that id.');

  const data = {};
  if (patch.caption !== undefined) data.caption = patch.caption;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
  if (patch.isCover !== undefined) data.isCover = patch.isCover;

  if (patch.isCover === true) {
    const [, updated] = await prisma.$transaction([
      prisma.propertyMedia.updateMany({
        where: { propertyId: existing.propertyId, isCover: true, id: { not: mediaId } },
        data: { isCover: false },
      }),
      prisma.propertyMedia.update({ where: { id: mediaId }, data }),
    ]);
    return toMediaResponse(updated);
  }

  const updated = await prisma.propertyMedia.update({ where: { id: mediaId }, data });
  return toMediaResponse(updated);
};

/**
 * Deletes one media item.
 *
 * The storage object is removed **before** the database row. `storage.remove`
 * tolerates an object that is already gone, so if the row-delete step fails
 * after the object is removed, calling delete again is safe and completes the
 * job — the row is still there to retry against. The reverse order would risk
 * the opposite failure: a database row gone with no request left that can
 * reach the now-unreferenced object to clean it up.
 *
 * @param {{ mediaId: string }} args
 * @returns {Promise<void>}
 */
export const deleteMedia = async ({ mediaId }) => {
  const existing = await prisma.propertyMedia.findUnique({ where: { id: mediaId } });
  if (!existing) throw new NotFoundError('No media item found with that id.');

  await storage.remove(existing.storageKey);
  await prisma.propertyMedia.delete({ where: { id: mediaId } });
};
