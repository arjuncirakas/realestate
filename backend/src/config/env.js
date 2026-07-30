import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Parses and validates the environment once, at boot (Section 8.2). Every other
 * module imports `env` from here; ESLint fails the build on any other
 * `process.env` access.
 *
 * A missing or malformed variable exits the process with a readable list of what
 * is wrong, rather than surfacing as an undefined value ten frames deep.
 */

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Resolved from this file's location, not the working directory, so `node
// prisma/seed.js` and `npm --prefix backend run dev` behave the same. dotenv
// never overwrites a variable that is already set, so real environment
// variables still win over the file in CI and production.
loadDotenv({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });

/** Placeholder secrets from `.env.example` — usable in development, never in production. */
const PLACEHOLDER_SECRET_MARKERS = ['change-me', 'dev-only', 'test-'];

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .startsWith('postgres', 'DATABASE_URL must be a PostgreSQL connection string'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z
      .string()
      .regex(/^\d+[smhd]$/, 'ACCESS_TOKEN_TTL must look like 15m, 2h or 7d')
      .default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    /** Comma-separated list; exposed as `corsOrigins`. */
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

    STORAGE_DRIVER: z.enum(['local', 'gcs']).default('local'),
    LOCAL_STORAGE_PATH: z.string().min(1).default('./uploads'),
    /** Absolute base URL for locally stored files. Defaults from PORT below. */
    PUBLIC_UPLOAD_BASE_URL: z.string().url().optional(),

    GCS_BUCKET: z.string().optional(),
    GCS_PROJECT_ID: z.string().optional(),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

    GEOCODING_API_KEY: z.string().optional(),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }

    if (value.STORAGE_DRIVER === 'gcs') {
      for (const key of ['GCS_BUCKET', 'GCS_PROJECT_ID']) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER is "gcs"`,
          });
        }
      }
    }

    if (value.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
        if (PLACEHOLDER_SECRET_MARKERS.some((marker) => value[key].includes(marker))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} still holds an example value — generate a real secret before deploying`,
          });
        }
      }
    }
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  // No logger here: it depends on this module, and a boot failure has to be
  // legible on stderr regardless.
  process.stderr.write(
    [
      'Environment configuration is invalid:',
      ...lines,
      '',
      'Copy backend/.env.example to backend/.env and fill in the missing values.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const value = parsed.data;

/** Validated configuration. The only source of environment data in the app. */
export const env = Object.freeze({
  ...value,

  isDevelopment: value.NODE_ENV === 'development',
  isTest: value.NODE_ENV === 'test',
  isProduction: value.NODE_ENV === 'production',

  /** CORS origins as a list, since `cors` accepts an array. */
  corsOrigins: value.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  /** Absolute path to the local upload directory. */
  localStorageRoot: path.resolve(BACKEND_ROOT, value.LOCAL_STORAGE_PATH),

  /** Public base URL for locally stored files, defaulted from PORT. */
  publicUploadBaseUrl: value.PUBLIC_UPLOAD_BASE_URL ?? `http://localhost:${value.PORT}/uploads`,
});
