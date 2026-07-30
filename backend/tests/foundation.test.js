import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  isAppError,
} from '../src/utils/app-error.js';
import { formatZodIssues } from '../src/utils/zod-error.js';
import { buildPaginationMeta, toPrismaPagination } from '../src/utils/pagination.js';
import { fromIsoDate, toDecimalString, toIsoDate, toIsoDateTime } from '../src/utils/serialize.js';
import { createLocalStorageAdapter } from '../src/services/storage.js';
import { validate } from '../src/middleware/validate.js';
import { asyncHandler } from '../src/middleware/async-handler.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { PaginationMetaSchema } from '../src/contracts/index.js';

describe('AppError hierarchy', () => {
  it.each([
    [ValidationError, 'VALIDATION_ERROR', 400],
    [UnauthenticatedError, 'UNAUTHENTICATED', 401],
    [ForbiddenError, 'FORBIDDEN', 403],
    [NotFoundError, 'NOT_FOUND', 404],
    [ConflictError, 'CONFLICT', 409],
  ])('%s carries the right code and status', (Constructor, code, status) => {
    const error = new Constructor();
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.message.length).toBeGreaterThan(0);
    expect(isAppError(error)).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  it('does not treat an ordinary Error as an application error', () => {
    expect(isAppError(new Error('boom'))).toBe(false);
  });
});

describe('formatZodIssues', () => {
  it('maps a field issue to its path', () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: 'nope' });
    expect(formatZodIssues(result.error)).toEqual([
      { field: 'email', message: expect.any(String) },
    ]);
  });

  it('reports a cross-field issue under _', () => {
    const schema = z.object({ a: z.number(), b: z.number() }).refine((v) => v.a < v.b, {
      message: 'a must be less than b',
    });
    const result = schema.safeParse({ a: 2, b: 1 });
    expect(formatZodIssues(result.error)).toEqual([
      { field: '_', message: 'a must be less than b' },
    ]);
  });
});

describe('pagination helpers', () => {
  it('converts page and limit to skip and take', () => {
    expect(toPrismaPagination({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toPrismaPagination({ page: 3, limit: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it('builds meta that satisfies PaginationMetaSchema', () => {
    const meta = buildPaginationMeta({ page: 1, limit: 20, total: 143 });
    expect(meta.totalPages).toBe(8);
    expect(PaginationMetaSchema.safeParse(meta).success).toBe(true);
  });

  it('reports zero pages for an empty result set', () => {
    const meta = buildPaginationMeta({ page: 1, limit: 20, total: 0 });
    expect(meta.totalPages).toBe(0);
    expect(PaginationMetaSchema.safeParse(meta).success).toBe(true);
  });
});

describe('serialisation helpers', () => {
  it('turns a Decimal-like value into a string', () => {
    expect(toDecimalString({ toString: () => '5800000' })).toBe('5800000');
    expect(toDecimalString(null)).toBeNull();
  });

  it('renders a date column as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date('2026-08-08T00:00:00.000Z'))).toBe('2026-08-08');
    expect(toIsoDate(null)).toBeNull();
  });

  it('renders a timestamp column in full', () => {
    expect(toIsoDateTime(new Date('2026-07-30T09:00:00.000Z'))).toBe('2026-07-30T09:00:00.000Z');
  });

  it('round-trips a date without shifting the day', () => {
    expect(toIsoDate(fromIsoDate('2026-08-08'))).toBe('2026-08-08');
  });
});

describe('local storage adapter', () => {
  /**
   * @returns {Promise<import('../src/services/storage.js').StorageAdapter>}
   */
  const makeAdapter = async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'estate-storage-'));
    return createLocalStorageAdapter({
      rootDirectory: root,
      publicBaseUrl: 'http://localhost:4000/uploads',
    });
  };

  it('writes a file and returns a key and public URL', async () => {
    const adapter = await makeAdapter();
    const stored = await adapter.put({
      buffer: Buffer.from('image-bytes'),
      contentType: 'image/jpeg',
      prefix: 'property-media',
    });

    expect(stored.key).toMatch(/^property-media\/[0-9a-f-]{36}\.jpg$/);
    expect(stored.url).toBe(`http://localhost:4000/uploads/${stored.key}`);
    expect(stored.size).toBe(11);
  });

  it('chooses the extension from the MIME type, not a filename', async () => {
    const adapter = await makeAdapter();
    const pdf = await adapter.put({
      buffer: Buffer.from('%PDF-'),
      contentType: 'application/pdf',
      prefix: 'property-media',
    });
    expect(pdf.key.endsWith('.pdf')).toBe(true);
  });

  it('rejects a content type that is not on the allowlist', async () => {
    const adapter = await makeAdapter();
    await expect(
      adapter.put({
        buffer: Buffer.from('<?php'),
        contentType: 'application/x-php',
        prefix: 'property-media',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('removes a stored file and tolerates a second removal', async () => {
    const adapter = await makeAdapter();
    const stored = await adapter.put({
      buffer: Buffer.from('bytes'),
      contentType: 'image/png',
      prefix: 'plot-snapshots',
    });
    await adapter.remove(stored.key);
    await expect(adapter.remove(stored.key)).resolves.toBeUndefined();
  });

  it('refuses a key that would escape the storage root', async () => {
    const adapter = await makeAdapter();
    await expect(adapter.remove('../../etc/passwd')).rejects.toThrow();
  });

  it('stores the bytes it was given', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'estate-storage-'));
    const adapter = createLocalStorageAdapter({
      rootDirectory: root,
      publicBaseUrl: 'http://localhost:4000/uploads',
    });
    const stored = await adapter.put({
      buffer: Buffer.from('exact-content'),
      contentType: 'image/webp',
      prefix: 'log-media',
    });
    const onDisk = path.join(root, stored.key);
    expect((await stat(onDisk)).isFile()).toBe(true);
    expect(await readFile(onDisk, 'utf8')).toBe('exact-content');
  });
});

describe('validate middleware', () => {
  /**
   * Minimal app exercising validate + asyncHandler + errorHandler together.
   * @returns {import('express').Express}
   */
  const makeApp = () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get(
      '/items',
      validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1) }) }),
      asyncHandler(async (req, res) => {
        res.json({ data: { page: req.query.page, type: typeof req.query.page }, meta: {} });
      }),
    );
    testApp.post(
      '/items',
      validate({ body: z.object({ email: z.string().email() }) }),
      asyncHandler(async (req, res) => {
        res.json({ data: req.body, meta: {} });
      }),
    );
    testApp.get(
      '/boom',
      asyncHandler(async () => {
        throw new Error('unexpected failure with internal detail');
      }),
    );
    testApp.use(errorHandler);
    return testApp;
  };

  it('replaces raw query values with parsed ones', async () => {
    const res = await request(makeApp()).get('/items?page=3');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ page: 3, type: 'number' });
  });

  it('applies defaults when a parameter is absent', async () => {
    const res = await request(makeApp()).get('/items');
    expect(res.body.data.page).toBe(1);
  });

  it('returns field-level details on a bad body', async () => {
    const res = await request(makeApp()).post('/items').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('email');
  });

  it('turns an unexpected throw into a generic 500 with no internal detail', async () => {
    const res = await request(makeApp()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
  });
});
