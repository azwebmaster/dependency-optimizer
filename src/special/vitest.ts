import * as fs from 'fs';
import createDebug from 'debug';

const debug = createDebug('depoptimize:special:vitest');

const parseVitest = (filePath: string, deps: string[], rootDir: string) => {
    debug('Processing Vitest config file: %s', filePath);
    const usedDeps: string[] = [];

    // Only process Vitest config files
    if (!/vite(st)?\.config\.(js|ts|mjs)$/.test(filePath)) {
        debug('Skipping non-Vitest config file: %s', filePath);
        return usedDeps;
    }

    try {
        // Read the config file content
        const content = fs.readFileSync(filePath, 'utf-8');
        debug('Successfully read config file, content length: %d', content.length);

        // Check for vitest itself
        if (/vitest|defineConfig/i.test(content)) {
            debug('Detected vitest usage in config');
            usedDeps.push('vitest');
        }

        // Check for coverage providers based on configuration
        if (/provider\s*:\s*['"]v8['"]/i.test(content)) {
            debug('Detected v8 coverage provider');
            usedDeps.push('@vitest/coverage-v8');
        }
        if (/provider\s*:\s*['"]istanbul['"]/i.test(content)) {
            debug('Detected istanbul coverage provider');
            usedDeps.push('@vitest/coverage-istanbul');
        }

        debug('Found %d used dependencies: %O', usedDeps.length, usedDeps);
        // Filter to only return deps that are actually in the deps array
        return usedDeps;

    } catch (error) {
        // If we can't read the file, fall back to basic checks
        debug('Failed to read config file: %O', error);
        console.warn(`Could not read vitest config ${filePath}:`, error);
        return deps.filter(dep => dep === 'vitest' || dep.startsWith('@vitest/'));
    }
};
export default parseVitest;
