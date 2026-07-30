import { z } from 'zod';
import { UserRoleSchema } from './enums.js';
import {
  atLeastOneField,
  BooleanQuerySchema,
  EmailSchema,
  IsoDateTimeSchema,
  optionalParam,
  PaginationQuerySchema,
  PersonNameSchema,
  PhoneSchema,
  UuidSchema,
} from './common.contract.js';

/**
 * Accounts, sessions and admin user management — endpoints under `/auth`,
 * `/users` (Section 5.2) and the rules in Section 6.
 */

/**
 * Section 6: minimum 8 characters, must contain a letter and a number, no
 * maximum below 72 bytes (bcrypt truncates beyond that).
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  fullName: PersonNameSchema,
  phone: PhoneSchema.optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  // Not PasswordSchema: rule changes must never lock out an existing account.
  password: z.string().min(1, 'Password is required'),
});

/**
 * The refresh token normally arrives in the `httpOnly` cookie set at login
 * (Section 6). The body field is the fallback for non-browser clients.
 */
export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const LogoutRequestSchema = RefreshRequestSchema;

export const UserResponseSchema = z.object({
  id: UuidSchema,
  email: z.string(),
  phone: z.string().nullable(),
  fullName: z.string(),
  role: UserRoleSchema,
  isActive: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

/** Minimal projection of a user for embedding in other payloads. */
export const UserSummarySchema = z.object({
  id: UuidSchema,
  fullName: z.string(),
});

/**
 * Payload of register, login and refresh. The refresh token itself is not in
 * the body — it is delivered as an `httpOnly` cookie (Section 6), so a browser
 * client never has to store it.
 */
export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
  accessToken: z.string().min(1),
  accessTokenExpiresIn: z.number().int().positive(),
});

export const MeResponseSchema = UserResponseSchema;

export const MeUpdateSchema = atLeastOneField(
  z.object({
    fullName: PersonNameSchema.optional(),
    phone: PhoneSchema.nullable().optional(),
  }),
);

/** `PATCH /users/:id` — admin only, role and activation (Section 5.2). */
export const AdminUserUpdateSchema = atLeastOneField(
  z.object({
    role: UserRoleSchema.optional(),
    isActive: z.boolean().optional(),
  }),
);

export const UserListQuerySchema = PaginationQuerySchema.extend({
  q: optionalParam(z.string().trim().min(1).max(120)),
  role: optionalParam(UserRoleSchema),
  isActive: optionalParam(BooleanQuerySchema),
});

export const UserListResponseSchema = z.array(UserResponseSchema);
