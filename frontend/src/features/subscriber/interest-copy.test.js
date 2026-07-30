import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Section 1.3 is non-negotiable: the interest register is an enquiry
 * mechanism, not an investment product. This scans the source of every file
 * that renders interest-register copy for the prohibited vocabulary, so a
 * future edit that slips in "invest" or a yield figure fails the build rather
 * than reaching a buyer. `RegisterInterestForm.test.jsx` covers the rendered
 * text of the form itself; this covers the page copy around it as well.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const FILES = [
  ['forms/RegisterInterestForm.jsx', join(HERE, 'forms', 'RegisterInterestForm.jsx')],
  ['pages/InterestsPage.jsx', join(HERE, 'pages', 'InterestsPage.jsx')],
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

describe('interest register copy stays inside Section 1.3', () => {
  it.each(FILES)('%s uses none of the prohibited vocabulary', (_label, filePath) => {
    const source = stripComments(readFileSync(filePath, 'utf-8')).toLowerCase();

    for (const banned of BANNED_PHRASES) {
      expect(source).not.toContain(banned);
    }
  });
});
