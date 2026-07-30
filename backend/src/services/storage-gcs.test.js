import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the GCS storage driver against a mocked `@google-cloud/storage`
 * client — nothing here needs real credentials or a real bucket, matching
 * `services/storage.js`'s local-driver tests in `tests/foundation.test.js`.
 */

vi.mock('@google-cloud/storage', () => ({ Storage: vi.fn() }));

const { Storage } = await import('@google-cloud/storage');
const { createGcsStorageAdapter } = await import('./storage-gcs.js');
const { ValidationError } = await import('../utils/app-error.js');

/**
 * Wires a fresh mocked GCS client into the `Storage` constructor mock. Set up
 * inside each test body (not a `beforeEach`) so it always runs after
 * vitest's `restoreMocks` config resets the constructor mock between tests.
 * @returns {{ file: { save: import('vitest').Mock, delete: import('vitest').Mock } }}
 */
const setupClient = () => {
  const file = {
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const bucket = { file: vi.fn().mockReturnValue(file) };
  Storage.mockImplementation(() => ({ bucket: vi.fn().mockReturnValue(bucket) }));
  return { file };
};

describe('createGcsStorageAdapter', () => {
  it('reports its driver name', () => {
    setupClient();
    const adapter = createGcsStorageAdapter({ bucket: 'estate-media', projectId: 'estate-prod' });
    expect(adapter.driver).toBe('gcs');
  });

  it('uploads a buffer and returns an opaque key with a public url', async () => {
    const { file } = setupClient();
    const adapter = createGcsStorageAdapter({ bucket: 'estate-media', projectId: 'estate-prod' });

    const stored = await adapter.put({
      buffer: Buffer.from('bytes'),
      contentType: 'image/jpeg',
      prefix: 'property-media',
    });

    expect(stored.key).toMatch(/^property-media\/[0-9a-f-]{36}\.jpg$/);
    expect(stored.url).toBe(`https://storage.googleapis.com/estate-media/${stored.key}`);
    expect(stored.size).toBe(5);
    expect(file.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg', resumable: false }),
    );
  });

  it('chooses the extension from the mime type, never the filename', async () => {
    setupClient();
    const adapter = createGcsStorageAdapter({ bucket: 'estate-media', projectId: 'estate-prod' });

    const stored = await adapter.put({
      buffer: Buffer.from('%PDF-'),
      contentType: 'application/pdf',
      prefix: 'property-media',
    });

    expect(stored.key.endsWith('.pdf')).toBe(true);
  });

  it('rejects a content type that is not on the allowlist', async () => {
    const { file } = setupClient();
    const adapter = createGcsStorageAdapter({ bucket: 'estate-media', projectId: 'estate-prod' });

    await expect(
      adapter.put({ buffer: Buffer.from('x'), contentType: 'application/x-php', prefix: 'property-media' }),
    ).rejects.toThrow(ValidationError);
    expect(file.save).not.toHaveBeenCalled();
  });

  it('removes an object', async () => {
    const { file } = setupClient();
    const adapter = createGcsStorageAdapter({ bucket: 'estate-media', projectId: 'estate-prod' });

    await adapter.remove('property-media/some-key.jpg');

    expect(file.delete).toHaveBeenCalled();
  });

  it('tolerates removing an object that is already gone', async () => {
    const { file } = setupClient();
    file.delete.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 404 }));
    const adapter = createGcsStorageAdapter({ bucket: 'estate-media', projectId: 'estate-prod' });

    await expect(adapter.remove('property-media/some-key.jpg')).resolves.toBeUndefined();
  });

  it('propagates a non-404 failure from remove', async () => {
    const { file } = setupClient();
    file.delete.mockRejectedValueOnce(Object.assign(new Error('permission denied'), { code: 403 }));
    const adapter = createGcsStorageAdapter({ bucket: 'estate-media', projectId: 'estate-prod' });

    await expect(adapter.remove('property-media/some-key.jpg')).rejects.toThrow('permission denied');
  });

  it('urlFor returns the same public url shape put uses', () => {
    setupClient();
    const adapter = createGcsStorageAdapter({ bucket: 'estate-media', projectId: 'estate-prod' });

    expect(adapter.urlFor('property-media/abc.jpg')).toBe(
      'https://storage.googleapis.com/estate-media/property-media/abc.jpg',
    );
  });
});
