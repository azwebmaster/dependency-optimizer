import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeModulesAnalyzer } from './analyzer.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('NodeModulesAnalyzer', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analyzer-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create analyzer with default options', () => {
    const analyzer = new NodeModulesAnalyzer();
    expect(analyzer).toBeDefined();
  });

  it('should handle missing node_modules', async () => {
    const analyzer = new NodeModulesAnalyzer();
    const result = await analyzer.analyze(tempDir);

    expect(result.totalPackages).toBe(0);
    expect(result.totalSize).toBe(0);
    expect(result.largePackages).toEqual([]);
    expect(result.deepPackages).toEqual([]);
  });

  it('should analyze simple node_modules structure', async () => {
    // Create mock node_modules with a simple package
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const packageDir = path.join(nodeModulesDir, 'test-package');
    await fs.mkdir(packageDir, { recursive: true });

    // Create package.json
    const packageJson = {
      name: 'test-package',
      version: '1.0.0'
    };
    await fs.writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create some files to give it size
    await fs.writeFile(path.join(packageDir, 'index.js'), 'console.log("test");');
    await fs.writeFile(path.join(packageDir, 'readme.md'), '# Test Package\n\nThis is a test.');

    const analyzer = new NodeModulesAnalyzer();
    const result = await analyzer.analyze(tempDir);

    expect(result.totalPackages).toBe(1);
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.nodeModulesPath).toBe(nodeModulesDir);
  });

  it('should detect large packages', async () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const packageDir = path.join(nodeModulesDir, 'large-package');
    await fs.mkdir(packageDir, { recursive: true });

    const packageJson = {
      name: 'large-package',
      version: '1.0.0'
    };
    await fs.writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create a large file (1MB threshold for test)
    const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
    await fs.writeFile(path.join(packageDir, 'large-file.js'), largeContent);

    const analyzer = new NodeModulesAnalyzer({ sizeThreshold: 1 }); // 1MB threshold
    const result = await analyzer.analyze(tempDir);

    expect(result.largePackages).toHaveLength(1);
    expect(result.largePackages[0].name).toBe('large-package');
    expect(result.largePackages[0].size).toBeGreaterThan(1024 * 1024);
  });

  it('should handle scoped packages', async () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const scopeDir = path.join(nodeModulesDir, '@test');
    const packageDir = path.join(scopeDir, 'scoped-package');
    await fs.mkdir(packageDir, { recursive: true });

    const packageJson = {
      name: '@test/scoped-package',
      version: '1.0.0'
    };
    await fs.writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    await fs.writeFile(path.join(packageDir, 'index.js'), 'module.exports = {};');

    const analyzer = new NodeModulesAnalyzer();
    const result = await analyzer.analyze(tempDir);

    expect(result.totalPackages).toBe(1);
    expect(result.totalSize).toBeGreaterThan(0);
  });

  it('should format sizes correctly', () => {
    const analyzer = new NodeModulesAnalyzer();

    expect(analyzer.formatSize(500)).toBe('500.0B');
    expect(analyzer.formatSize(1536)).toBe('1.5KB');
    expect(analyzer.formatSize(1024 * 1024)).toBe('1.0MB');
    expect(analyzer.formatSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5GB');
  });

  it('should support JSON output option', () => {
    const analyzer = new NodeModulesAnalyzer({ json: true });
    expect(analyzer).toBeDefined();
  });
});