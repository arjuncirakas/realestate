import { PropertyListResponseSchema, PropertyMapResponseSchema, PropertyResponseSchema } from '../../contracts/index.js';
import * as propertiesService from './properties.service.js';

/**
 * Thin HTTP layer for `/properties` (Section 9.2). Every handler here only
 * calls a service function and shapes the envelope from Section 5.1 — no
 * Prisma calls, no business logic. Every payload is parsed through its
 * contract response schema before it goes out, so a service that drifts from
 * the contract fails loudly here rather than shipping a malformed response.
 */

/**
 * `GET /properties`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const listProperties = async (req, res) => {
  const { items, meta } = await propertiesService.listProperties(req.query);
  res.json({ data: PropertyListResponseSchema.parse(items), meta });
};

/**
 * `GET /properties/map`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const getPropertiesMap = async (req, res) => {
  const pins = await propertiesService.getPropertiesMap(req.query);
  res.json({ data: PropertyMapResponseSchema.parse(pins), meta: {} });
};

/**
 * `GET /properties/admin/list`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const listAdminProperties = async (req, res) => {
  const { items, meta } = await propertiesService.listAdminProperties(req.query, req.user);
  res.json({ data: PropertyListResponseSchema.parse(items), meta });
};

/**
 * `GET /properties/:slug`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const getPropertyBySlug = async (req, res) => {
  const property = await propertiesService.getPropertyBySlug(req.params.slug, req.user, req.ip);
  res.json({ data: PropertyResponseSchema.parse(property), meta: {} });
};

/**
 * `POST /properties`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const createProperty = async (req, res) => {
  const property = await propertiesService.createProperty(req.body, req.user);
  res.status(201).json({ data: PropertyResponseSchema.parse(property), meta: {} });
};

/**
 * `PATCH /properties/:id`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const updateProperty = async (req, res) => {
  const property = await propertiesService.updateProperty(req.params.id, req.body);
  res.json({ data: PropertyResponseSchema.parse(property), meta: {} });
};

/**
 * `POST /properties/:id/publish`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const publishProperty = async (req, res) => {
  const property = await propertiesService.publishProperty(req.params.id);
  res.json({ data: PropertyResponseSchema.parse(property), meta: {} });
};

/**
 * `DELETE /properties/:id`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const deleteProperty = async (req, res) => {
  const property = await propertiesService.withdrawProperty(req.params.id);
  res.json({ data: PropertyResponseSchema.parse(property), meta: {} });
};
