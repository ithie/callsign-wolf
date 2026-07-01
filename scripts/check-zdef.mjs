#!/usr/bin/env node
// Finds ZDEF files in src/game/models/ that are not imported anywhere in TypeScript source.
import { readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const root = new URL('..', import.meta.url).pathname;
const modelsDir = join(root, 'src/game/models');
const srcDir    = join(root, 'src');

const zdefFiles = readdirSync(modelsDir).filter(f => f.endsWith('.zdef'));

const usedFiles = new Set();
for (const f of zdefFiles) {
    const stem = basename(f, '.zdef');
    const pattern = `${stem}.zdef`;
    // Search .ts, .zdef (sub-models), .zcampaign, .js files
    const searchDirs = [srcDir, join(root, 'vscode-ext')];
    for (const dir of searchDirs) {
        try {
            const result = execSync(
                `grep -rl "${pattern}" "${dir}"`,
                { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }
            ).trim();
            if (result) { usedFiles.add(f); break; }
        } catch { /* grep exits 1 when nothing found */ }
    }
}

const unused = zdefFiles.filter(f => !usedFiles.has(f));
if (unused.length === 0) {
    console.log('✓ All ZDEF files are referenced in TypeScript source.');
    process.exit(0);
} else {
    console.warn(`⚠ ${unused.length} unused ZDEF file(s):`);
    unused.forEach(f => console.warn(`  - src/game/models/${f}`));
    process.exit(1);
}
