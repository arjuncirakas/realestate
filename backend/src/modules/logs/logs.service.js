import { prisma } from '../../config/prisma.js';
import { STORAGE_PREFIX } from '../../config/constants.js';
import { storage } from '../../services/storage.js';
import { NotFoundError, ValidationError } from '../../utils/app-error.js';
import { buildPaginationMeta, toPrismaPagination } from '../../utils/pagination.js';
import { fromIsoDate } from '../../utils/serialize.js';
import { assertOwnerAccess, assertPropertyExists } from '../ownership/ownership.helpers.js';
import {
  LOG_DETAIL_INCLUDE,
  serializeManagementLog,
  serializePlotSnapshot,
} from './logs.helpers.js';

/**
 * Business logic for the agency's management log, log media, and the plot
 * snapshot timeline (Section 4.2/5.2), plus the owner-facing reads of both
 * under `/me/properties/:id`.
 */

/**
 * @param {string} id
 * @returns {Promise<object>} the raw management log row
 * @throws {NotFoundError} when no such log exists
 */
const findLogOrThrow = async (id) => {
  const log = await prisma.managementLog.findUnique({ where: { id } });
  if (!log) throw new NotFoundError('We could not find that management log.');
  return log;
};

/**
 * The first moment of a `YYYY-MM-DD` date, UTC.
 * @param {string} isoDate
 * @returns {Date}
 */
const startOfIsoDate = (isoDate) => fromIsoDate(isoDate);

/**
 * The first moment of the day *after* a `YYYY-MM-DD` date, UTC — used as an
 * exclusive upper bound so a `to` date includes every snapshot captured on
 * that day, not just those at exactly midnight.
 * @param {string} isoDate
 * @returns {Date}
 */
const startOfNextIsoDate = (isoDate) => {
  const date = fromIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

/**
 * `POST /properties/:id/logs` — agent records work done on the land. Starts
 * visible to the owner unless the agent explicitly marks it hidden
 * (Section 4.2).
 * @param {{ propertyId: string, agentId: string, logType: string, title: string, notes?: string|null, occurredOn: string, isVisibleToOwner?: boolean }} args
 * @returns {Promise<object>} `ManagementLogResponseSchema` shape
 * @throws {NotFoundError} when the property does not exist
 */
export const createManagementLog = async ({
  propertyId,
  agentId,
  logType,
  title,
  notes,
  occurredOn,
  isVisibleToOwner,
}) => {
  await assertPropertyExists(propertyId);

  const created = await prisma.managementLog.create({
    data: {
      propertyId,
      agentId,
      logType,
      title,
      notes: notes ?? null,
      occurredOn: fromIsoDate(occurredOn),
      isVisibleToOwner: isVisibleToOwner ?? true,
    },
    include: LOG_DETAIL_INCLUDE,
  });

  return serializeManagementLog(created);
};

/**
 * `PATCH /logs/:id` — agent edit.
 * @param {{ id: string, logType?: string, title?: string, notes?: string|null, occurredOn?: string, isVisibleToOwner?: boolean }} args
 * @returns {Promise<object>} `ManagementLogResponseSchema` shape
 * @throws {NotFoundError} when no such log exists
 */
export const updateManagementLog = async ({
  id,
  logType,
  title,
  notes,
  occurredOn,
  isVisibleToOwner,
}) => {
  await findLogOrThrow(id);

  const data = {
    ...(logType !== undefined ? { logType } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(occurredOn !== undefined ? { occurredOn: fromIsoDate(occurredOn) } : {}),
    ...(isVisibleToOwner !== undefined ? { isVisibleToOwner } : {}),
  };

  const updated = await prisma.managementLog.update({
    where: { id },
    data,
    include: LOG_DETAIL_INCLUDE,
  });
  return serializeManagementLog(updated);
};

/**
 * Removes storage objects that were written but never made it into a
 * database row, so a crash partway through a batch never leaves billable,
 * unreferenced bytes behind. Mirrors the media module's approach (Section
 * "Reuse, do not rebuild") rather than inventing a new one.
 * @param {Array<{ key: string }>} stored
 * @returns {Promise<void>}
 */
const cleanupOrphans = async (stored) => {
  await Promise.all(stored.map(({ key }) => storage.remove(key).catch(() => {})));
};

/**
 * `POST /logs/:id/media` — attaches up to 10 files to an existing log.
 * Bytes are written to storage first, one file at a time, then recorded in a
 * single transaction; if the transaction fails, every object written during
 * this call is removed again — an upload either fully lands or leaves
 * nothing behind. Returns the log with its media freshly loaded, since there
 * is no separate list schema for log media in the contract.
 * @param {{ logId: string, files: Array<{ buffer: Buffer, mimetype: string, originalname: string }>, fields: { caption?: string } }} args
 * @returns {Promise<object>} `ManagementLogResponseSchema` shape
 * @throws {NotFoundError} when no such log exists
 * @throws {ValidationError} when no files were attached
 */
export const uploadManagementLogMedia = async ({ logId, files, fields }) => {
  await findLogOrThrow(logId);

  if (!files || files.length === 0) {
    throw new ValidationError('Attach at least one file to upload.', [
      { field: 'files', message: 'No files were received' },
    ]);
  }

  const stored = [];
  try {
    for (const file of files) {
      // Sequential, not Promise.all: keeps the cleanup list exact if a later
      // file in the batch fails.
      stored.push(
        await storage.put({
          buffer: file.buffer,
          contentType: file.mimetype,
          prefix: STORAGE_PREFIX.logMedia,
        }),
      );
    }

    await prisma.$transaction(
      stored.map((object) =>
        prisma.managementLogMedia.create({
          data: {
            logId,
            storageKey: object.key,
            url: object.url,
            caption: fields.caption ?? null,
          },
        }),
      ),
    );
  } catch (error) {
    await cleanupOrphans(stored);
    throw error;
  }

  const updated = await prisma.managementLog.findUnique({
    where: { id: logId },
    include: LOG_DETAIL_INCLUDE,
  });
  return serializeManagementLog(updated);
};

/**
 * `POST /properties/:id/snapshots` — agent uploads one site photograph.
 * `capturedAt` defaults to the time of upload; `source` is fixed to
 * `MANUAL` in the MVP (Section 4.2).
 * @param {{ propertyId: string, file: { buffer: Buffer, mimetype: string, originalname: string }, capturedAt?: string }} args
 * @returns {Promise<object>} `PlotSnapshotResponseSchema` shape
 * @throws {NotFoundError} when the property does not exist
 * @throws {ValidationError} when no file was attached
 */
export const createPlotSnapshot = async ({ propertyId, file, capturedAt }) => {
  await assertPropertyExists(propertyId);

  if (!file) {
    throw new ValidationError('Attach a photograph to upload.', [
      { field: 'file', message: 'No file was received' },
    ]);
  }

  let stored;
  try {
    stored = await storage.put({
      buffer: file.buffer,
      contentType: file.mimetype,
      prefix: STORAGE_PREFIX.snapshots,
    });

    const created = await prisma.plotSnapshot.create({
      data: {
        propertyId,
        capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
        storageKey: stored.key,
        url: stored.url,
        source: 'MANUAL',
      },
    });

    return serializePlotSnapshot(created);
  } catch (error) {
    if (stored) await storage.remove(stored.key).catch(() => {});
    throw error;
  }
};

/**
 * `GET /me/properties/:id/logs` — visible logs only, unconditionally
 * (Section 5.2). Verifies ownership first (Section 5.3), then excludes every
 * `isVisibleToOwner: false` row no matter who is asking — there is no
 * agent-facing log list in the spec for a role carve-out to serve, so this
 * route behaves identically for every caller who passes the ownership check.
 * @param {{ propertyId: string, userId: string, page: number, limit: number, logType?: string, from?: string, to?: string }} args
 * @returns {Promise<{ rows: object[], meta: object }>}
 * @throws {NotFoundError} when no such property exists
 * @throws {ForbiddenError} when the caller does not own a share of it
 */
export const listPropertyLogsForOwner = async ({
  propertyId,
  userId,
  page,
  limit,
  logType,
  from,
  to,
}) => {
  await assertOwnerAccess({ propertyId, userId });

  const where = {
    propertyId,
    isVisibleToOwner: true,
    ...(logType ? { logType } : {}),
    ...(from || to
      ? {
          occurredOn: {
            ...(from ? { gte: fromIsoDate(from) } : {}),
            ...(to ? { lte: fromIsoDate(to) } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.managementLog.findMany({
      where,
      include: LOG_DETAIL_INCLUDE,
      orderBy: { occurredOn: 'desc' },
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.managementLog.count({ where }),
  ]);

  return {
    rows: rows.map(serializeManagementLog),
    meta: buildPaginationMeta({ page, limit, total }),
  };
};

/**
 * `GET /me/properties/:id/snapshots` — the site-photo timeline, newest
 * first (Section 5.2). Verifies ownership first (Section 5.3).
 * @param {{ propertyId: string, userId: string, page: number, limit: number, from?: string, to?: string }} args
 * @returns {Promise<{ rows: object[], meta: object }>}
 * @throws {NotFoundError} when no such property exists
 * @throws {ForbiddenError} when the caller does not own a share of it
 */
export const listPropertySnapshotsForOwner = async ({
  propertyId,
  userId,
  page,
  limit,
  from,
  to,
}) => {
  await assertOwnerAccess({ propertyId, userId });

  const where = {
    propertyId,
    ...(from || to
      ? {
          capturedAt: {
            ...(from ? { gte: startOfIsoDate(from) } : {}),
            ...(to ? { lt: startOfNextIsoDate(to) } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.plotSnapshot.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.plotSnapshot.count({ where }),
  ]);

  return {
    rows: rows.map(serializePlotSnapshot),
    meta: buildPaginationMeta({ page, limit, total }),
  };
};
