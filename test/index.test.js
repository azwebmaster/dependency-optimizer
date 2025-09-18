const DependencyOptimizer = require('../src/index.js');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('DependencyOptimizer', () => {
  let optimizer;
  let tempDir;

  beforeEach(async () => {
    optimizer = new DependencyOptimizer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dep-opt-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('should create instance', () => {
    expect(optimizer).toBeInstanceOf(DependencyOptimizer);
  });

  test('should find packages in current directory', async () => {
    // Create a mock package.json
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21'
      }
    };
    
    await fs.writeJson(path.join(tempDir, 'package.json'), packageJson);
    
    // Change to temp directory temporarily
    const originalCwd = process.cwd();
    process.chdir(tempDir);
    
    try {
      const packages = await optimizer.findPackages(false);
      expect(packages).toHaveLength(1);
      expect(packages[0].relativePath).toBe('.');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should detect specials based on files', async () => {
    // Create some config files
    await fs.writeFile(path.join(tempDir, 'webpack.config.js'), 'module.exports = {};');
    await fs.writeFile(path.join(tempDir, 'jest.config.js'), 'module.exports = {};');
    
    const specials = await optimizer.detectSpecials(tempDir);
    expect(specials.length).toBeGreaterThan(2); // Should include webpack and jest specials
  });

  test('should calculate directory size', async () => {
    // Create a test file
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    
    const size = await optimizer.getDirectorySize(tempDir);
    expect(size).toBeGreaterThan(0);
  });
});