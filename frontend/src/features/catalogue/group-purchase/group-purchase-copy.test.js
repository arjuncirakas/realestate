import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Section 1.3 is non-negotiable and is this work package's primary
 * responsibility (Section 13): the group-purchase catalogue is an enquiry
 * mechanism, not an investment product. This scans the source of every file
 * this work package writes for the prohibited vocabulary, so a future edit
 * that slips in "invest" or a yield figure fails the build rather than
 * reaching a buyer. Modelled on `subscriber/interest-copy.test.js`, which
 * covers `RegisterInterestForm` itself — this covers the pages that embed it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const FILES = [
  ['GroupPurchaseListPage.jsx', join(HERE, 'GroupPurchaseListPage.jsx')],
  ['GroupPurchaseDetailPage.jsx', join(HERE, 'GroupPurchaseDetailPage.jsx')],
];

const BANNED_PHRASES = [
  'invest',
  'investor',
  'shares',
  'dividend',
  'yield',
  'roi',
  'appreciation',
  'countdown',
  'spots left',
  'funding progress',
  'portfolio return',
];

/** Strips comments so a JSDoc block explaining the rule cannot trip the rule itself. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('group-purchase page copy stays inside Section 1.3', () => {
  it.each(FILES)('%s uses none of the prohibited vocabulary', (_label, filePath) => {
    const source = stripComments(readFileSync(filePath, 'utf-8')).toLowerCase();

    for (const banned of BANNED_PHRASES) {
      expect(source).not.toContain(banned);
    }
  });
});
