import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DependencyScanner } from './scanner.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('DependencyScanner', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dep-scanner-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create scanner with default options', () => {
    const scanner = new DependencyScanner();
    expect(scanner).toBeDefined();
  });

  it('should scan a simple package', async () => {
    // Create a test package.json
    const packageJson = {
      name: 'test-package',
      dependencies: {
        'unused-dep': '1.0.0'
      }
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create a simple JS file that doesn't use the dependency
    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      'console.log("Hello world");'
    );

    const scanner = new DependencyScanner();
    const results = await scanner.scan(tempDir);

    expect(results).toHaveLength(1);
    expect(results[0].packageName).toBe('test-package');
    expect(results[0].packagePath).toBe(tempDir);
    expect(results[0].unusedDependencies).toEqual([
      { name: 'unused-dep', type: 'dependencies' }
    ]);
  });

  it('should handle packages without package.json', async () => {
    // Create a directory without package.json
    const scanner = new DependencyScanner();
    const results = await scanner.scan(tempDir);

    expect(results).toHaveLength(1);
    expect(results[0].packageName).toBeUndefined();
    expect(results[0].unusedDependencies).toEqual([]);
  });

  it('should support fix option', async () => {
    const packageJson = {
      name: 'test-package',
      dependencies: {
        'unused-dep': '1.0.0',
        'used-dep': '1.0.0'
      }
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create a JS file that uses one dependency
    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      'const usedDep = require("used-dep");\nconsole.log("Using:", usedDep);'
    );

    const scanner = new DependencyScanner({ fix: true });
    const results = await scanner.scan(tempDir);

    // Should have fixed some dependencies
    expect(results[0].fixedDependencies).toBeDefined();
    expect(results[0].fixedDependencies!.length).toBeGreaterThan(0);

    // Verify package.json was updated - should only have dependencies that weren't fixed
    const updatedContent = await fs.readFile(path.join(tempDir, 'package.json'), 'utf-8');
    const updatedPackageJson = JSON.parse(updatedContent);
    const remainingDeps = Object.keys(updatedPackageJson.dependencies || {});
    expect(remainingDeps.length).toBeLessThan(2); // Should have removed at least one
  });

  it('should detect workspace packages', async () => {
    // Create root package.json with workspaces
    const rootPackageJson = {
      name: 'monorepo',
      workspaces: ['packages/*']
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2)
    );

    // Create packages directory and a workspace package
    const packagesDir = path.join(tempDir, 'packages');
    const packageADir = path.join(packagesDir, 'package-a');
    await fs.mkdir(packageADir, { recursive: true });

    const packageAJson = {
      name: 'package-a',
      dependencies: {
        'unused-in-a': '1.0.0'
      }
    };

    await fs.writeFile(
      path.join(packageADir, 'package.json'),
      JSON.stringify(packageAJson, null, 2)
    );

    await fs.writeFile(
      path.join(packageADir, 'index.js'),
      'console.log("Package A");'
    );

    const scanner = new DependencyScanner();
    const results = await scanner.scan(tempDir);

    // Should only scan the root package now (no recursive scanning)
    expect(results.length).toBe(1);
    
    const rootResult = results[0];
    expect(rootResult.packageName).toBe('monorepo');
    expect(rootResult.unusedDependencies).toEqual([]);
  });
});