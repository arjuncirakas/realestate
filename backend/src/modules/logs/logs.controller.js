import {
  ManagementLogListResponseSchema,
  ManagementLogResponseSchema,
  PlotSnapshotListResponseSchema,
  PlotSnapshotResponseSchema,
} from '../../contracts/index.js';
import * as logsService from './logs.service.js';

/**
 * Thin controllers for management logs, log media and plot snapshots
 * (Section 5.2). Every outbound payload is `.parse()`d through its contract
 * schema before it reaches `res.json`.
 */

/**
 * `GET /me/properties/:id/logs`.
 * @type {import('express').RequestHandler}
 */
export const listMyPropertyLogs = async (req, res) => {
  const { rows, meta } = await logsService.listPropertyLogsForOwner({
    ...req.query,
    propertyId: req.params.id,
    userId: req.user.id,
  });
  res.json({ data: ManagementLogListResponseSchema.parse(rows), meta });
};

/**
 * `GET /me/properties/:id/snapshots`.
 * @type {import('express').RequestHandler}
 */
export const listMyPropertySnapshots = async (req, res) => {
  const { rows, meta } = await logsService.listPropertySnapshotsForOwner({
    ...req.query,
    propertyId: req.params.id,
    userId: req.user.id,
  });
  res.json({ data: PlotSnapshotListResponseSchema.parse(rows), meta });
};

/**
 * `POST /properties/:id/logs` — session- and route-derived fields are spread
 * last so a stray `propertyId`/`agentId` in the body cannot override them.
 * @type {import('express').RequestHandler}
 */
export const createLog = async (req, res) => {
  const log = await logsService.createManagementLog({
    ...req.body,
    propertyId: req.params.id,
    agentId: req.user.id,
  });
  res.status(201).json({ data: ManagementLogResponseSchema.parse(log), meta: {} });
};

/**
 * `PATCH /logs/:id`.
 * @type {import('express').RequestHandler}
 */
export const updateLog = async (req, res) => {
  const log = await logsService.updateManagementLog({ ...req.body, id: req.params.id });
  res.json({ data: ManagementLogResponseSchema.parse(log), meta: {} });
};

/**
 * `POST /logs/:id/media` — multipart, up to 10 files on the `files` field.
 * @type {import('express').RequestHandler}
 */
export const uploadLogMedia = async (req, res) => {
  const log = await logsService.uploadManagementLogMedia({
    logId: req.params.id,
    files: req.files,
    fields: req.body,
  });
  res.status(201).json({ data: ManagementLogResponseSchema.parse(log), meta: {} });
};

/**
 * `POST /properties/:id/snapshots` — multipart, a single file on the `file` field.
 * @type {import('express').RequestHandler}
 */
export const createSnapshot = async (req, res) => {
  const snapshot = await logsService.createPlotSnapshot({
    ...req.body,
    propertyId: req.params.id,
    file: req.file,
  });
  res.status(201).json({ data: PlotSnapshotResponseSchema.parse(snapshot), meta: {} });
};
