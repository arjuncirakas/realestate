import { describe, expect, it, vi } from 'vitest';
import { SlugParamSchema } from '../../contracts/index.js';
import { ConflictError, ValidationError } from '../../utils/app-error.js';
import { generateUniqueSlug, geocodeAddress, slugifyTitle } from './properties.helpers.js';

describe('slugifyTitle', () => {
  it('lowercases and hyphenates a title', () => {
    expect(slugifyTitle('Ten Cent Plot near Technopark')).toBe('ten-cent-plot-near-technopark');
  });

  it('strips punctuation and collapses whitespace runs', () => {
    expect(slugifyTitle("Buyer's dream — 12 cent!")).toBe('buyer-s-dream-12-cent');
  });

  it('never leaves a leading or trailing hyphen', () => {
    expect(slugifyTitle('  --Coastal plot--  ')).toBe('coastal-plot');
  });

  it('falls back to a non-empty base when the title has no ASCII letters or digits', () => {
    expect(slugifyTitle('★★★')).toBe('plot');
  });
});

describe('generateUniqueSlug', () => {
  it('returns a slug matching SlugParamSchema on the first attempt when it is free', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    const slug = await generateUniqueSlug('Ten Cent Plot near Technopark', { exists });

    expect(exists).toHaveBeenCalledTimes(1);
    expect(SlugParamSchema.safeParse({ slug }).success).toBe(true);
    expect(slug.startsWith('ten-cent-plot-near-technopark-')).toBe(true);
  });

  it('retries with a new suffix when a candidate collides (Section 11.1 collision path)', async () => {
    const exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const slug = await generateUniqueSlug('Repeated Title', { exists });

    expect(exists).toHaveBeenCalledTimes(3);
    expect(SlugParamSchema.safeParse({ slug }).success).toBe(true);
  });

  it('gives up after a bounded number of attempts rather than looping forever', async () => {
    const exists = vi.fn().mockResolvedValue(true);
    await expect(generateUniqueSlug('Always Taken', { exists })).rejects.toThrow(ConflictError);
    expect(exists.mock.calls.length).toBeGreaterThan(1);
    expect(exists.mock.calls.length).toBeLessThan(20);
  });

  it('keeps the total slug at or under 160 characters for a very long title', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    const longTitle = 'A'.repeat(300);
    const slug = await generateUniqueSlug(longTitle, { exists });

    expect(slug.length).toBeLessThanOrEqual(160);
    expect(SlugParamSchema.safeParse({ slug }).success).toBe(true);
  });

  it('produces a different slug for the same title on two calls', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    const first = await generateUniqueSlug('Ten Cent Plot', { exists });
    const second = await generateUniqueSlug('Ten Cent Plot', { exists });

    expect(first).not.toBe(second);
  });
});

describe('geocodeAddress', () => {
  const address = {
    addressLine: null,
    locality: 'Kottiyam',
    city: 'Kollam',
    district: 'Kollam',
    state: 'Kerala',
    pincode: '691571',
  };

  it('throws a ValidationError instead of a network call when no API key is configured', async () => {
    const fetchImpl = vi.fn();
    await expect(geocodeAddress(address, { apiKey: '', fetchImpl })).rejects.toThrow(
      ValidationError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns the coordinates from a successful geocoding response, via an injected fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ geometry: { location: { lat: 8.848, lng: 76.706 } } }] }),
    });

    const coords = await geocodeAddress(address, { apiKey: 'test-key', fetchImpl });

    expect(coords).toEqual({ latitude: 8.848, longitude: 76.706 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain('key=test-key');
    expect(url).toContain(encodeURIComponent('Kottiyam'));
  });

  it('rejects when the geocoding service has no result for the address', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    await expect(geocodeAddress(address, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects when the geocoding service responds with a non-2xx status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    await expect(geocodeAddress(address, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(
      ValidationError,
    );
  });
});
