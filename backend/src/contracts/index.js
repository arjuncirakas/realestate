/**
 * Single import point for every contract. Backend modules and — after
 * `npm run contracts:sync` — frontend features both import from here:
 *
 *   import { PropertyCreateSchema } from '../../contracts/index.js';
 *
 * Only WP0 may add or change files in this directory (Section 2.4). Everyone
 * else imports; a needed change is reported to the lead.
 */

export * from './enums.js';
export * from './common.contract.js';
export * from './envelope.contract.js';
export * from './auth.contract.js';
export * from './property.contract.js';
export * from './media.contract.js';
export * from './engagement.contract.js';
export * from './ownership.contract.js';
