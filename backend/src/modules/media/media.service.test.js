import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the media service's business rules: the one-cover-per-
 * property behaviour and mime-type rejection (Section 11.1). Prisma and the
 * storage adapter are mocked so these run without a database or bucket.
 */

const prismaMock = {
  property: { findUnique: vi.fn() },
  propertyMedia: {
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../../config/prisma.js', () => ({ prisma: prismaMock }));

const storageMock = { put: vi.fn(), remove: vi.fn() };
vi.mock('../../services/storage.js', () => ({ storage: storageMock }));

const { NotFoundError, ValidationError } = await import('../../utils/app-error.js');
const { uploadPropertyMedia, updateMedia, deleteMedia } = await import('./media.service.js');

/** A minimal multer-shaped file for the service, which never reads the disk. */
const file = (overrides = {}) => ({
  buffer: Buffer.from('bytes'),
  mimetype: 'image/jpeg',
  originalname: 'plot.jpg',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Every test's transaction mock runs the array of "queries" it is given —
  // matching how `prisma.$transaction([...])` resolves in real usage.
  prismaMock.$transaction.mockImplementation(async (ops) => Promise.all(ops));
  storageMock.remove.mockResolvedValue(undefined);
});

describe('uploadPropertyMedia — cover rule', () => {
  const asRow = (data, id) => ({ id, createdAt: new Date('2026-01-01T00:00:00Z'), ...data });

  it('marks the first uploaded image as cover when the property has none', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1' });
    prismaMock.propertyMedia.findFirst.mockResolvedValue(null);
    prismaMock.propertyMedia.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    storageMock.put.mockImplementation(async () => ({
      key: 'property-media/a.jpg',
      url: 'http://x/a.jpg',
      size: 5,
    }));
    let counter = 0;
    prismaMock.propertyMedia.create.mockImplementation(({ data }) =>
      Promise.resolve(asRow(data, `media-${(counter += 1)}`)),
    );

    const result = await uploadPropertyMedia({
      propertyId: 'prop-1',
      files: [file(), file({ originalname: 'plot-2.jpg' })],
      fields: {},
    });

    expect(result[0].isCover).toBe(true);
    expect(result[1].isCover).toBe(false);
  });

  it('does not assign a cover when the property already has one', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1' });
    prismaMock.propertyMedia.findFirst.mockResolvedValue({ id: 'existing-cover' });
    prismaMock.propertyMedia.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    storageMock.put.mockResolvedValue({ key: 'property-media/b.jpg', url: 'http://x/b.jpg', size: 5 });
    prismaMock.propertyMedia.create.mockImplementation(({ data }) => Promise.resolve(asRow(data, 'media-2')));

    const [result] = await uploadPropertyMedia({ propertyId: 'prop-1', files: [file()], fields: {} });

    expect(result.isCover).toBe(false);
  });

  it('only offers the cover to an image, never a video or document', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1' });
    prismaMock.propertyMedia.findFirst.mockResolvedValue(null);
    prismaMock.propertyMedia.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    storageMock.put.mockImplementation(async () => ({ key: 'property-media/c', url: 'http://x/c', size: 5 }));
    let counter = 0;
    prismaMock.propertyMedia.create.mockImplementation(({ data }) =>
      Promise.resolve(asRow(data, `media-${(counter += 1)}`)),
    );

    const result = await uploadPropertyMedia({
      propertyId: 'prop-1',
      files: [file({ mimetype: 'application/pdf', originalname: 'deed.pdf' }), file({ originalname: 'plot.jpg' })],
      fields: {},
    });

    expect(result[0].isCover).toBe(false); // the PDF
    expect(result[1].isCover).toBe(true); // the image, uploaded second
  });

  it('continues sort order from the property\'s current maximum', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1' });
    prismaMock.propertyMedia.findFirst.mockResolvedValue({ id: 'existing-cover' });
    prismaMock.propertyMedia.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
    storageMock.put.mockResolvedValue({ key: 'property-media/d.jpg', url: 'http://x/d.jpg', size: 5 });
    prismaMock.propertyMedia.create.mockImplementation(({ data }) => Promise.resolve(asRow(data, 'media-3')));

    const [result] = await uploadPropertyMedia({ propertyId: 'prop-1', files: [file()], fields: {} });

    expect(result.sortOrder).toBe(5);
  });

  it('rejects an upload with no files', async () => {
    await expect(uploadPropertyMedia({ propertyId: 'prop-1', files: [], fields: {} })).rejects.toThrow(
      ValidationError,
    );
    expect(prismaMock.property.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a file whose mime type is not on the allowlist without touching storage', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1' });
    prismaMock.propertyMedia.findFirst.mockResolvedValue(null);
    prismaMock.propertyMedia.aggregate.mockResolvedValue({ _max: { sortOrder: null } });

    await expect(
      uploadPropertyMedia({
        propertyId: 'prop-1',
        files: [file({ mimetype: 'application/x-php', originalname: 'shell.php' })],
        fields: {},
      }),
    ).rejects.toThrow(ValidationError);
    expect(storageMock.put).not.toHaveBeenCalled();
  });

  it('404s when the property does not exist', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null);

    await expect(
      uploadPropertyMedia({ propertyId: 'missing', files: [file()], fields: {} }),
    ).rejects.toThrow(NotFoundError);
    expect(storageMock.put).not.toHaveBeenCalled();
  });

  it('removes every stored object when the database write fails', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1' });
    prismaMock.propertyMedia.findFirst.mockResolvedValue(null);
    prismaMock.propertyMedia.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    storageMock.put
      .mockResolvedValueOnce({ key: 'property-media/e.jpg', url: 'http://x/e.jpg', size: 5 })
      .mockResolvedValueOnce({ key: 'property-media/f.jpg', url: 'http://x/f.jpg', size: 5 });
    prismaMock.$transaction.mockRejectedValue(new Error('database is unavailable'));

    await expect(
      uploadPropertyMedia({ propertyId: 'prop-1', files: [file(), file()], fields: {} }),
    ).rejects.toThrow('database is unavailable');

    expect(storageMock.remove).toHaveBeenCalledWith('property-media/e.jpg');
    expect(storageMock.remove).toHaveBeenCalledWith('property-media/f.jpg');
  });
});

describe('updateMedia — cover switch', () => {
  it('clears the property\'s other covers in the same transaction as setting this one', async () => {
    prismaMock.propertyMedia.findUnique.mockResolvedValue({
      id: 'media-1',
      propertyId: 'prop-1',
      isCover: false,
    });
    prismaMock.propertyMedia.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.propertyMedia.update.mockResolvedValue({
      id: 'media-1',
      propertyId: 'prop-1',
      type: 'IMAGE',
      url: 'http://x',
      caption: null,
      sortOrder: 0,
      isCover: true,
      createdAt: new Date(),
    });

    const result = await updateMedia({ mediaId: 'media-1', patch: { isCover: true } });

    expect(prismaMock.propertyMedia.updateMany).toHaveBeenCalledWith({
      where: { propertyId: 'prop-1', isCover: true, id: { not: 'media-1' } },
      data: { isCover: false },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(result.isCover).toBe(true);
  });

  it('does not touch other rows when isCover is not part of the patch', async () => {
    prismaMock.propertyMedia.findUnique.mockResolvedValue({
      id: 'media-1',
      propertyId: 'prop-1',
      isCover: false,
    });
    prismaMock.propertyMedia.update.mockResolvedValue({
      id: 'media-1',
      propertyId: 'prop-1',
      type: 'IMAGE',
      url: 'http://x',
      caption: 'new caption',
      sortOrder: 0,
      isCover: false,
      createdAt: new Date(),
    });

    await updateMedia({ mediaId: 'media-1', patch: { caption: 'new caption' } });

    expect(prismaMock.propertyMedia.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('404s when the media item does not exist', async () => {
    prismaMock.propertyMedia.findUnique.mockResolvedValue(null);

    await expect(updateMedia({ mediaId: 'missing', patch: { caption: 'x' } })).rejects.toThrow(NotFoundError);
    expect(prismaMock.propertyMedia.update).not.toHaveBeenCalled();
  });
});

describe('deleteMedia', () => {
  it('removes the storage object before deleting the row', async () => {
    prismaMock.propertyMedia.findUnique.mockResolvedValue({
      id: 'media-1',
      storageKey: 'property-media/x.jpg',
    });
    const order = [];
    storageMock.remove.mockImplementation(async () => {
      order.push('storage');
    });
    prismaMock.propertyMedia.delete.mockImplementation(async () => {
      order.push('db');
    });

    await deleteMedia({ mediaId: 'media-1' });

    expect(order).toEqual(['storage', 'db']);
    expect(storageMock.remove).toHaveBeenCalledWith('property-media/x.jpg');
  });

  it('404s when the media item does not exist, and never touches storage', async () => {
    prismaMock.propertyMedia.findUnique.mockResolvedValue(null);

    await expect(deleteMedia({ mediaId: 'missing' })).rejects.toThrow(NotFoundError);
    expect(storageMock.remove).not.toHaveBeenCalled();
    expect(prismaMock.propertyMedia.delete).not.toHaveBeenCalled();
  });
});
