import { Router } from 'express';
import { IdParamSchema, MediaUpdateSchema, MediaUploadFieldsSchema } from '../../contracts/index.js';
import { authenticate, requireAgent } from '../../middleware/auth.js';
import { uploadMediaFiles } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { patchMedia, removeMedia, uploadMedia } from './media.controller.js';

/**
 * Property media routes (Section 5.2). Declares its full sub-paths — both
 * `/properties/:id/media` and `/media/:id` — so `app.js` needs only one
 * `app.use(API_PREFIX, mediaRoutes)` line.
 */
const router = Router();

// Auth and role checks run before multer touches the request body, so an
// unauthorised caller never gets as far as having their upload parsed.
router.post(
  '/properties/:id/media',
  authenticate,
  requireAgent,
  uploadMediaFiles,
  validate({ params: IdParamSchema, body: MediaUploadFieldsSchema }),
  uploadMedia,
);

router.patch(
  '/media/:id',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: MediaUpdateSchema }),
  patchMedia,
);

router.delete(
  '/media/:id',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema }),
  removeMedia,
);

export const mediaRoutes = router;
