#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies `backend/src/contracts/` to `frontend/src/contracts/` so both sides of
 * the API boundary validate against the same zod schemas (Section 2.4).
 *
 *   node scripts/sync-contracts.js            copy, overwriting the target tree
 *   node scripts/sync-contracts.js --check    compare only, exit 1 on any drift
 *
 * The copy is byte-for-byte: no banner is injected, because `--check` compares
 * content hashes and any generated preamble would make the two trees differ by
 * construction. `frontend/src/contracts/` is generated output — it is
 * gitignored, rebuilt by the root `postinstall`, and must never be hand-edited.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(HERE, '..', 'src', 'contracts');
const TARGET_DIR = path.resolve(HERE, '..', '..', 'frontend', 'src', 'contracts');

/** Contract files are plain ES modules; nothing else belongs in the tree. */
const COPY_EXTENSIONS = new Set(['.js']);

/**
 * Lists every contract file in a directory, recursively, as sorted paths
 * relative to that directory. A missing directory yields an empty list rather
 * than throwing, so `--check` can report "never synced" instead of crashing.
 * @param {string} dir absolute path to walk
 * @returns {Promise<string[]>} sorted relative paths, POSIX separators
 */
const listFiles = async (dir) => {
  /** @type {string[]} */
  const found = [];

  /**
   * @param {string} current absolute directory being walked
   * @param {string} prefix relative path accumulated so far
   * @returns {Promise<void>}
   */
  const walk = async (current, prefix) => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name), relative);
      } else if (COPY_EXTENSIONS.has(path.extname(entry.name))) {
        found.push(relative);
      }
    }
  };

  await walk(dir, '');
  return found.sort();
};

/**
 * Reads a contract tree into a map of relative path to content hash.
 * @param {string} dir absolute path to the tree root
 * @returns {Promise<Map<string, string>>}
 */
const readTree = async (dir) => {
  const files = await listFiles(dir);
  const tree = new Map();
  for (const relative of files) {
    const contents = await readFile(path.join(dir, relative));
    tree.set(relative, createHash('sha256').update(contents).digest('hex'));
  }
  return tree;
};

/**
 * Compares the source tree against the generated tree.
 * @returns {Promise<{ added: string[], removed: string[], changed: string[], sourceCount: number }>}
 *   `added` exist in source but not in the target, `removed` the reverse
 */
const diffTrees = async () => {
  const [source, target] = await Promise.all([readTree(SOURCE_DIR), readTree(TARGET_DIR)]);
  const added = [];
  const changed = [];
  for (const [relative, hash] of source) {
    if (!target.has(relative)) added.push(relative);
    else if (target.get(relative) !== hash) changed.push(relative);
  }
  const removed = [...target.keys()].filter((relative) => !source.has(relative));
  return {
    added: added.sort(),
    changed: changed.sort(),
    removed: removed.sort(),
    sourceCount: source.size,
  };
};

/**
 * Copies the source tree over the target, deleting target files that no longer
 * exist in source so a renamed contract cannot linger on the frontend.
 * @returns {Promise<{ copied: number, deleted: number }>}
 */
const sync = async () => {
  const [sourceFiles, targetFiles] = await Promise.all([
    listFiles(SOURCE_DIR),
    listFiles(TARGET_DIR),
  ]);

  if (sourceFiles.length === 0) {
    throw new Error(`No contract files found in ${SOURCE_DIR}`);
  }

  for (const relative of sourceFiles) {
    const from = path.join(SOURCE_DIR, relative);
    const to = path.join(TARGET_DIR, relative);
    await mkdir(path.dirname(to), { recursive: true });
    await writeFile(to, await readFile(from));
  }

  const sourceSet = new Set(sourceFiles);
  const stale = targetFiles.filter((relative) => !sourceSet.has(relative));
  for (const relative of stale) {
    await rm(path.join(TARGET_DIR, relative), { force: true });
  }

  return { copied: sourceFiles.length, deleted: stale.length };
};

/**
 * Entry point. Exits 1 on drift in `--check` mode, or on any failure.
 * @returns {Promise<void>}
 */
const main = async () => {
  const isCheck = process.argv.includes('--check');

  if (isCheck) {
    const { added, changed, removed, sourceCount } = await diffTrees();
    const drifted = added.length + changed.length + removed.length;

    if (drifted === 0) {
      console.log(`contracts:check — in sync (${sourceCount} files)`);
      return;
    }

    console.error('contracts:check — FAILED, contract trees differ.\n');
    for (const relative of added) console.error(`  missing from frontend: ${relative}`);
    for (const relative of changed) console.error(`  content differs:       ${relative}`);
    for (const relative of removed) console.error(`  stale in frontend:     ${relative}`);
    console.error('\nRun `npm run contracts:sync` and commit nothing — the frontend');
    console.error('tree is generated. If a contract itself needs changing, that is a');
    console.error('WP0 change (Section 2.4): stop and report it to the lead.');
    process.exitCode = 1;
    return;
  }

  const { copied, deleted } = await sync();
  const suffix = deleted > 0 ? `, ${deleted} stale file(s) removed` : '';
  console.log(`contracts:sync — ${copied} file(s) copied to frontend/src/contracts${suffix}`);
};

main().catch((error) => {
  console.error(`contracts — ${error.message}`);
  process.exitCode = 1;
});
