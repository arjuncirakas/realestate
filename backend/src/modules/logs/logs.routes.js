import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, requireAgent } from '../../middleware/auth.js';
import { uploadMediaFiles, uploadSingleFile } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import {
  IdParamSchema,
  ManagementLogCreateSchema,
  ManagementLogListQuerySchema,
  ManagementLogMediaUploadFieldsSchema,
  ManagementLogUpdateSchema,
  PlotSnapshotCreateSchema,
  PlotSnapshotListQuerySchema,
} from '../../contracts/index.js';
import * as logsController from './logs.controller.js';

/**
 * Routes for `/me/properties/:id/logs`, `/me/properties/:id/snapshots`,
 * `/properties/:id/logs`, `/logs/:id`, `/logs/:id/media` and
 * `/properties/:id/snapshots` (Section 5.2). Full sub-paths are declared
 * here so `app.js` needs only one `app.use(API_PREFIX, logsRoutes)` line
 * (Section 13.1).
 */
export const logsRoutes = Router();

logsRoutes.get(
  '/me/properties/:id/logs',
  authenticate,
  validate({ params: IdParamSchema, query: ManagementLogListQuerySchema }),
  asyncHandler(logsController.listMyPropertyLogs),
);

logsRoutes.get(
  '/me/properties/:id/snapshots',
  authenticate,
  validate({ params: IdParamSchema, query: PlotSnapshotListQuerySchema }),
  asyncHandler(logsController.listMyPropertySnapshots),
);

logsRoutes.post(
  '/properties/:id/logs',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: ManagementLogCreateSchema }),
  asyncHandler(logsController.createLog),
);

logsRoutes.patch(
  '/logs/:id',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: ManagementLogUpdateSchema }),
  asyncHandler(logsController.updateLog),
);

// Auth and role checks run before multer touches the request body, so an
// unauthorised caller never gets as far as having their upload parsed.
logsRoutes.post(
  '/logs/:id/media',
  authenticate,
  requireAgent,
  uploadMediaFiles,
  validate({ params: IdParamSchema, body: ManagementLogMediaUploadFieldsSchema }),
  asyncHandler(logsController.uploadLogMedia),
);

logsRoutes.post(
  '/properties/:id/snapshots',
  authenticate,
  requireAgent,
  uploadSingleFile,
  validate({ params: IdParamSchema, body: PlotSnapshotCreateSchema }),
  asyncHandler(logsController.createSnapshot),
);
