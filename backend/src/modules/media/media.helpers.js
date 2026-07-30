import { toIsoDateTime } from '../../utils/serialize.js';

/**
 * Maps a `property_media` row to the shape `PropertyMediaResponseSchema`
 * expects. `storageKey` is deliberately left out — clients get `url` only
 * (Section 5.2).
 *
 * @param {{ id: string, propertyId: string, type: string, url: string, caption: string | null, sortOrder: number, isCover: boolean, createdAt: Date }} row
 * @returns {{ id: string, propertyId: string, type: string, url: string, caption: string | null, sortOrder: number, isCover: boolean, createdAt: string }}
 */
export const toMediaResponse = (row) => ({
  id: row.id,
  propertyId: row.propertyId,
  type: row.type,
  url: row.url,
  caption: row.caption,
  sortOrder: row.sortOrder,
  isCover: row.isCover,
  createdAt: toIsoDateTime(row.createdAt),
});
