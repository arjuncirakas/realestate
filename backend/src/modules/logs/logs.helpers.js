import { toIsoDate, toIsoDateTime } from '../../utils/serialize.js';

/**
 * Serialisers for management logs, log media and plot snapshots
 * (Section 4.2/5.2).
 */

/** Every log needs its author's name and its media, for `ManagementLogResponseSchema`. */
export const LOG_DETAIL_INCLUDE = Object.freeze({
  agent: { select: { id: true, fullName: true } },
  media: { orderBy: { createdAt: 'asc' } },
});

/**
 * @param {object} m a Prisma `management_log_media` row
 * @returns {object} `ManagementLogMediaResponseSchema` shape
 */
const serializeLogMedia = (m) => ({
  id: m.id,
  logId: m.logId,
  url: m.url,
  caption: m.caption,
  createdAt: toIsoDateTime(m.createdAt),
});

/**
 * Turns a management log row (fetched with `LOG_DETAIL_INCLUDE`) into the
 * `ManagementLogResponseSchema` shape.
 * @param {object} log Prisma management log row
 * @returns {object}
 */
export const serializeManagementLog = (log) => ({
  id: log.id,
  propertyId: log.propertyId,
  agentId: log.agentId,
  agent: log.agent ? { id: log.agent.id, fullName: log.agent.fullName } : null,
  logType: log.logType,
  title: log.title,
  notes: log.notes,
  occurredOn: toIsoDate(log.occurredOn),
  isVisibleToOwner: log.isVisibleToOwner,
  media: (log.media ?? []).map(serializeLogMedia),
  createdAt: toIsoDateTime(log.createdAt),
  updatedAt: toIsoDateTime(log.updatedAt),
});

/**
 * Turns a plot snapshot row into the `PlotSnapshotResponseSchema` shape.
 * @param {object} snapshot Prisma plot_snapshot row
 * @returns {object}
 */
export const serializePlotSnapshot = (snapshot) => ({
  id: snapshot.id,
  propertyId: snapshot.propertyId,
  capturedAt: toIsoDateTime(snapshot.capturedAt),
  url: snapshot.url,
  source: snapshot.source,
  createdAt: toIsoDateTime(snapshot.createdAt),
});
