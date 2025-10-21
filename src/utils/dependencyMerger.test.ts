import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DependencyMerger } from './dependencyMerger.js';
import type { WorkspaceInfo } from '../types.js';

describe('DependencyMerger', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dependency-merger-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should merge dependencies from workspace root', async () => {
    // Create workspace root package.json
    const rootPackageJson = {
      name: 'monorepo',
      dependencies: {
        'shared-dep': '^1.0.0',
        'root-only': '^2.0.0'
      },
      devDependencies: {
        'typescript': '^5.0.0',
        'jest': '^29.0.0'
      }
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2)
    );

    // Create workspace package
    const packageDir = path.join(tempDir, 'packages', 'package-a');
    await fs.mkdir(packageDir, { recursive: true });

    const packageJson = {
      name: 'package-a',
      version: '1.0.0',
      dependencies: {
        'shared-dep': '^1.1.0', // Different version - should take precedence
        'package-specific': '^3.0.0'
      },
      devDependencies: {
        'eslint': '^8.0.0'
      }
    };

    await fs.writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const workspaceInfo: WorkspaceInfo = {
      rootPath: tempDir,
      workspaceType: 'npm',
      memberPackages: [tempDir, packageDir],
      isWorkspaceMember: true
    };

    const result = await DependencyMerger.mergeDependenciesWithWorkspaceRoot(packageDir, workspaceInfo);

    expect(result.workspaceRoot).toBe(tempDir);
    expect(result.workspaceType).toBe('npm');
    
    // Check merged dependencies
    expect(result.mergedDeps.dependencies).toEqual({
      'shared-dep': '^1.1.0', // Package version takes precedence
      'root-only': '^2.0.0',  // From root
      'package-specific': '^3.0.0' // From package
    });

    expect(result.mergedDeps.devDependencies).toEqual({
      'typescript': '^5.0.0', // From root
      'jest': '^29.0.0',      // From root
      'eslint': '^8.0.0'      // From package
    });
  });

  it('should handle standalone package without workspace root', async () => {
    const packageJson = {
      name: 'standalone-package',
      version: '1.0.0',
      dependencies: {
        'some-dep': '^1.0.0'
      }
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const workspaceInfo: WorkspaceInfo = {
      rootPath: tempDir,
      workspaceType: null,
      memberPackages: [tempDir],
      isWorkspaceMember: false
    };

    const result = await DependencyMerger.mergeDependenciesWithWorkspaceRoot(tempDir, workspaceInfo);

    expect(result.workspaceRoot).toBe(tempDir);
    expect(result.workspaceType).toBe(null);
    expect(result.mergedDeps).toEqual(packageJson);
    expect(result.originalDeps).toEqual(packageJson);
    expect(result.rootDeps).toEqual(packageJson);
  });

  it('should get effective lock file path for workspace', async () => {
    // Create workspace root with lock file
    const rootPackageJson = {
      name: 'monorepo',
      workspaces: ['packages/*']
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2)
    );

    // Create a mock lock file
    await fs.writeFile(
      path.join(tempDir, 'package-lock.json'),
      '{"lockfileVersion": 1}'
    );

    // Create workspace package
    const packageDir = path.join(tempDir, 'packages', 'package-a');
    await fs.mkdir(packageDir, { recursive: true });

    const packageJson = {
      name: 'package-a',
      version: '1.0.0'
    };

    await fs.writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const workspaceInfo: WorkspaceInfo = {
      rootPath: tempDir,
      workspaceType: 'npm',
      memberPackages: [tempDir, packageDir],
      isWorkspaceMember: true
    };

    const lockFilePath = DependencyMerger.getEffectiveLockFilePath(packageDir, workspaceInfo);
    expect(lockFilePath).toBe(path.join(tempDir, 'package-lock.json'));
  });

  it('should get effective node_modules paths for workspace', async () => {
    // Create workspace root
    const rootPackageJson = {
      name: 'monorepo',
      workspaces: ['packages/*']
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2)
    );

    // Create workspace package
    const packageDir = path.join(tempDir, 'packages', 'package-a');
    await fs.mkdir(packageDir, { recursive: true });

    const packageJson = {
      name: 'package-a',
      version: '1.0.0'
    };

    await fs.writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const workspaceInfo: WorkspaceInfo = {
      rootPath: tempDir,
      workspaceType: 'npm',
      memberPackages: [tempDir, packageDir],
      isWorkspaceMember: true
    };

    const nodeModulesPaths = DependencyMerger.getEffectiveNodeModulesPaths(packageDir, workspaceInfo);
    expect(nodeModulesPaths).toContain(path.join(tempDir, 'node_modules'));
  });
});

