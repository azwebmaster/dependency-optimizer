import * as fs from 'fs';

const parseVitest = (filePath: string, deps: string[], rootDir: string) => {
    const usedDeps: string[] = [];

    // Only process Vitest config files
    if (!/vite(st)?\.config\.(js|ts|mjs)$/.test(filePath)) {
        return usedDeps;
    }

    try {
        // Read the config file content
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for vitest itself
        if (/vitest|defineConfig/i.test(content)) {
            usedDeps.push('vitest');
        }

        // Check for coverage providers based on configuration
        if (/provider\s*:\s*['"]v8['"]/i.test(content)) {
            usedDeps.push('@vitest/coverage-v8');
        }
        if (/provider\s*:\s*['"]istanbul['"]/i.test(content)) {
            usedDeps.push('@vitest/coverage-istanbul');
        }

        // Filter to only return deps that are actually in the deps array
        return usedDeps;

    } catch (error) {
        // If we can't read the file, fall back to basic checks
        console.warn(`Could not read vitest config ${filePath}:`, error);
        return deps.filter(dep => dep === 'vitest' || dep.startsWith('@vitest/'));
    }
};
export default parseVitest;
