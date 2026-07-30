import { UserListResponseSchema, UserResponseSchema } from '../../contracts/index.js';
import * as usersService from './users.service.js';

/**
 * Thin HTTP handlers for `/users/*` (admin only — `requireAdmin` guards these
 * routes before a handler ever runs).
 */

/**
 * GET /users
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const listUsersHandler = async (req, res) => {
  const { items, meta } = await usersService.listUsers(req.query);
  res.status(200).json({ data: UserListResponseSchema.parse(items), meta });
};

/**
 * PATCH /users/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const updateUserHandler = async (req, res) => {
  const user = await usersService.updateUser(req.params.id, req.body);
  res.status(200).json({ data: UserResponseSchema.parse(user), meta: {} });
};
