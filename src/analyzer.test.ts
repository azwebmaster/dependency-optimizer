import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeModulesAnalyzer } from './analyzer.js';
import { AnalyzeOptions } from './types.js';
import { TestUtils } from '../test/testUtils.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('NodeModulesAnalyzer', () => {
  let analyzer: NodeModulesAnalyzer;
  let mockOptions: AnalyzeOptions;
  let tempProjectPath: string;

  beforeEach(async () => {
    // Create a temporary project directory with package.json and lock file
    tempProjectPath = await TestUtils.createTempBunLockFromFixture('bun-with-prettier.lock.json');
    const projectDir = path.dirname(tempProjectPath);
    
    // Create package.json
    const packageJson = {
      name: 'test-project-with-prettier',
      dependencies: {
        commander: '^12.1.0',
        debug: '^4.4.3'
      },
      devDependencies: {
        '@changesets/cli': '^2.29.7',
        typescript: '^5.0.0'
      }
    };
    await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    mockOptions = {
      sizeThreshold: 10,
      depthThreshold: 5,
      json: false,
      includeDevDependencies: true,
      projectPath: projectDir
    };
    analyzer = new NodeModulesAnalyzer(mockOptions);
  });

  afterEach(async () => {
    // Clean up temporary files
    if (tempProjectPath) {
      const projectDir = path.dirname(tempProjectPath);
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  describe('isOnlyDevDependencyFromLockFile', () => {
    it('should return true for direct dev dependencies', async () => {
      const packageJson = {
        devDependencies: { typescript: '^5.0.0' },
        dependencies: {}
      };

      const result = await analyzer['isOnlyDevDependencyFromLockFile']('typescript', packageJson, {});
      expect(result).toBe(true);
    });

    it('should return false for direct production dependencies', async () => {
      const packageJson = {
        devDependencies: {},
        dependencies: { commander: '^12.1.0' }
      };

      const result = await analyzer['isOnlyDevDependencyFromLockFile']('commander', packageJson, {});
      expect(result).toBe(false);
    });

    it('should return true for transitive dev-only dependencies (prettier)', async () => {
      const packageJson = {
        devDependencies: { '@changesets/cli': '^2.29.7' },
        dependencies: {}
      };

      // Load the actual lock file data from fixture
      const lockFileContent = TestUtils.loadFixture('bun-with-prettier.lock.json');
      const lockData = JSON.parse(lockFileContent);

      const result = await analyzer['isOnlyDevDependencyFromLockFile']('prettier', packageJson, lockData);
      expect(result).toBe(true);
    });

    it('should return false for packages reachable through production dependencies', async () => {
      const packageJson = {
        devDependencies: { '@changesets/cli': '^2.29.7' },
        dependencies: { commander: '^12.1.0' }
      };

      // Load the actual lock file data from fixture
      const lockFileContent = TestUtils.loadFixture('bun-with-prettier.lock.json');
      const lockData = JSON.parse(lockFileContent);

      // commander is a production dependency, so it should not be considered dev-only
      const result = await analyzer['isOnlyDevDependencyFromLockFile']('commander', packageJson, lockData);
      expect(result).toBe(false);
    });
  });

  describe('findAllPathsToPackage', () => {
    it('should find paths from dev dependencies to prettier', () => {
      // Load the actual lock file data from fixture
      const lockFileContent = TestUtils.loadFixture('bun-with-prettier.lock.json');
      const lockData = JSON.parse(lockFileContent);

      const paths = analyzer['findAllPathsToPackage']('prettier', ['@changesets/cli'], lockData);
      expect(paths).toHaveLength(1);
      expect(paths[0]).toEqual(['@changesets/cli', '@changesets/apply-release-plan', 'prettier']);
    });

    it('should find paths from production dependencies', () => {
      // Load the actual lock file data from fixture
      const lockFileContent = TestUtils.loadFixture('bun-with-prettier.lock.json');
      const lockData = JSON.parse(lockFileContent);

      const paths = analyzer['findAllPathsToPackage']('commander', ['commander'], lockData);
      expect(paths).toHaveLength(1);
      expect(paths[0]).toEqual(['commander']);
    });

    it('should handle packages with no dependencies', () => {
      // Load the actual lock file data from fixture
      const lockFileContent = TestUtils.loadFixture('bun-with-prettier.lock.json');
      const lockData = JSON.parse(lockFileContent);

      const paths = analyzer['findAllPathsToPackage']('typescript', ['typescript'], lockData);
      expect(paths).toHaveLength(1);
      expect(paths[0]).toEqual(['typescript']);
    });
  });

  describe('integration tests with real lock file', () => {
    it('should correctly identify prettier as dev-only transitive dependency', async () => {
      // Set includeDevDependencies to false to test filtering
      mockOptions.includeDevDependencies = false;
      analyzer = new NodeModulesAnalyzer(mockOptions);

      // This should return false because prettier is only reachable through dev dependencies
      const result = await analyzer['shouldIncludePackage']('/test/node_modules/prettier', 'prettier');
      expect(result).toBe(false);
    });

    it('should correctly identify commander as production dependency', async () => {
      // Set includeDevDependencies to false to test filtering
      mockOptions.includeDevDependencies = false;
      analyzer = new NodeModulesAnalyzer(mockOptions);

      // This should return true because commander is a production dependency
      const result = await analyzer['shouldIncludePackage']('/test/node_modules/commander', 'commander');
      expect(result).toBe(true);
    });
  });
});