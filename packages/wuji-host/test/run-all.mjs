import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const tests = (await readdir(testDir))
  .filter(name => name.endsWith('.test.js'))
  .sort();

for (const test of tests) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(testDir, test)], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${test} failed with exit code ${code}`)));
  });
}
console.log(`Wuji host tests passed: ${tests.length}`);
