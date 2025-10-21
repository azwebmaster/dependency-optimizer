import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceDetector } from './workspaceDetector.js';

describe('WorkspaceDetector', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-detector-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should detect standalone package as non-workspace', async () => {
    // Create a simple package.json without workspaces
    const packageJson = {
      name: 'standalone-package',
      version: '1.0.0'
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await WorkspaceDetector.detectWorkspace(tempDir);
    
    expect(result.isWorkspaceMember).toBe(false);
    expect(result.workspaceType).toBe(null);
    expect(result.rootPath).toBe(tempDir);
    expect(result.memberPackages).toEqual([tempDir]);
  });

  it('should detect npm workspace', async () => {
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
      version: '1.0.0'
    };

    await fs.writeFile(
      path.join(packageADir, 'package.json'),
      JSON.stringify(packageAJson, null, 2)
    );

    // Test from root
    const rootResult = await WorkspaceDetector.detectWorkspace(tempDir);
    expect(rootResult.isWorkspaceMember).toBe(false);
    expect(rootResult.workspaceType).toBe('npm');
    expect(rootResult.rootPath).toBe(tempDir);
    expect(rootResult.memberPackages.length).toBeGreaterThanOrEqual(2);

    // Test from workspace member
    const memberResult = await WorkspaceDetector.detectWorkspace(packageADir);
    expect(memberResult.isWorkspaceMember).toBe(true);
    expect(memberResult.workspaceType).toBe('npm');
    expect(memberResult.rootPath).toBe(tempDir);
  });

  it('should detect pnpm workspace', async () => {
    // Create pnpm-workspace.yaml
    const pnpmWorkspaceContent = `packages:
  - 'packages/*'`;

    await fs.writeFile(
      path.join(tempDir, 'pnpm-workspace.yaml'),
      pnpmWorkspaceContent
    );

    // Create root package.json
    const rootPackageJson = {
      name: 'pnpm-monorepo',
      version: '1.0.0'
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
      version: '1.0.0'
    };

    await fs.writeFile(
      path.join(packageADir, 'package.json'),
      JSON.stringify(packageAJson, null, 2)
    );

    // Test from root
    const rootResult = await WorkspaceDetector.detectWorkspace(tempDir);
    expect(rootResult.isWorkspaceMember).toBe(false);
    expect(rootResult.workspaceType).toBe('pnpm');
    expect(rootResult.rootPath).toBe(tempDir);

    // Test from workspace member
    const memberResult = await WorkspaceDetector.detectWorkspace(packageADir);
    expect(memberResult.isWorkspaceMember).toBe(true);
    expect(memberResult.workspaceType).toBe('pnpm');
    expect(memberResult.rootPath).toBe(tempDir);
  });

  it('should traverse up directory tree to find workspace root', async () => {
    // Create root package.json with workspaces
    const rootPackageJson = {
      name: 'monorepo',
      workspaces: ['packages/*']
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2)
    );

    // Create nested directory structure
    const packagesDir = path.join(tempDir, 'packages');
    const packageADir = path.join(packagesDir, 'package-a');
    const nestedDir = path.join(packageADir, 'src', 'components');
    await fs.mkdir(nestedDir, { recursive: true });

    const packageAJson = {
      name: 'package-a',
      version: '1.0.0'
    };

    await fs.writeFile(
      path.join(packageADir, 'package.json'),
      JSON.stringify(packageAJson, null, 2)
    );

    // Test from deeply nested directory
    const result = await WorkspaceDetector.detectWorkspace(nestedDir);
    expect(result.isWorkspaceMember).toBe(true);
    expect(result.workspaceType).toBe('npm');
    expect(result.rootPath).toBe(tempDir);
  });
});

