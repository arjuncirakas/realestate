/**
 * Pagination helpers, so every list endpoint produces the same `meta` block
 * (Section 5.1) from the same arithmetic.
 */

/**
 * Turns validated `page`/`limit` into Prisma's `skip`/`take`.
 * @param {{ page: number, limit: number }} query already parsed by PaginationQuerySchema
 * @returns {{ skip: number, take: number }}
 */
export const toPrismaPagination = ({ page, limit }) => ({
  skip: (page - 1) * limit,
  take: limit,
});

/**
 * Builds the `meta` block of a paginated response.
 * @param {{ page: number, limit: number, total: number }} args
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
export const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  // An empty result set has zero pages, not one.
  totalPages: Math.ceil(total / limit),
});
