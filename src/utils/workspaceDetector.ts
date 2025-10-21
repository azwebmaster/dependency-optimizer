import * as fs from 'fs';
import * as path from 'path';
import { globby } from 'globby';
import type { PackageJson } from '../types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:workspace-detector');

export interface WorkspaceInfo {
  rootPath: string;
  workspaceType: 'npm' | 'yarn' | 'pnpm' | 'lerna' | null;
  memberPackages: string[];
  isWorkspaceMember: boolean;
}

export class WorkspaceDetector {
  /**
   * Detect if a given path is part of a workspace and return workspace information
   */
  static async detectWorkspace(projectPath: string): Promise<WorkspaceInfo> {
    debug('Detecting workspace for path: %s', projectPath);
    
    const workspaceRoot = await this.findWorkspaceRoot(projectPath);
    
    if (!workspaceRoot) {
      debug('No workspace root found, treating as standalone package');
      return {
        rootPath: projectPath,
        workspaceType: null,
        memberPackages: [projectPath],
        isWorkspaceMember: false
      };
    }

    debug('Found workspace root: %s', workspaceRoot);
    
    const workspaceType = await this.detectWorkspaceType(workspaceRoot);
    const memberPackages = await this.findWorkspaceMembers(workspaceRoot, workspaceType);
    
    const isWorkspaceMember = projectPath !== workspaceRoot;
    
    debug('Workspace info: type=%s, members=%d, isMember=%s', 
          workspaceType, memberPackages.length, isWorkspaceMember);

    return {
      rootPath: workspaceRoot,
      workspaceType,
      memberPackages,
      isWorkspaceMember
    };
  }

  /**
   * Traverse up directory tree to find workspace root
   */
  private static async findWorkspaceRoot(startPath: string): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
      debug('Checking for workspace indicators in: %s', currentPath);
      
      // Check for package.json with workspaces field
      const packageJsonPath = path.join(currentPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        try {
          const packageContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
          const packageJson: PackageJson = JSON.parse(packageContent);
          
          if (packageJson.workspaces) {
            debug('Found workspace configuration in package.json at: %s', currentPath);
            return currentPath;
          }
        } catch (error) {
          debug('Error reading package.json at %s: %O', currentPath, error);
        }
      }

      // Check for Lerna configuration
      const lernaPath = path.join(currentPath, 'lerna.json');
      if (await this.fileExists(lernaPath)) {
        debug('Found Lerna configuration at: %s', currentPath);
        return currentPath;
      }

      // Check for pnpm workspace configuration
      const pnpmWorkspacePath = path.join(currentPath, 'pnpm-workspace.yaml');
      if (await this.fileExists(pnpmWorkspacePath)) {
        debug('Found pnpm workspace configuration at: %s', currentPath);
        return currentPath;
      }

      // Move up one directory
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        break; // Reached root
      }
      currentPath = parentPath;
    }

    return null;
  }

  /**
   * Detect the type of workspace based on configuration files
   */
  private static async detectWorkspaceType(workspaceRoot: string): Promise<'npm' | 'yarn' | 'pnpm' | 'lerna' | null> {
    // Check for pnpm workspace
    const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
    if (await this.fileExists(pnpmWorkspacePath)) {
      return 'pnpm';
    }

    // Check for Lerna
    const lernaPath = path.join(workspaceRoot, 'lerna.json');
    if (await this.fileExists(lernaPath)) {
      return 'lerna';
    }

    // Check for yarn.lock (yarn workspaces)
    const yarnLockPath = path.join(workspaceRoot, 'yarn.lock');
    if (await this.fileExists(yarnLockPath)) {
      return 'yarn';
    }

    // Check for package-lock.json (npm workspaces)
    const npmLockPath = path.join(workspaceRoot, 'package-lock.json');
    if (await this.fileExists(npmLockPath)) {
      return 'npm';
    }

    // Check for bun.lock (bun workspaces)
    const bunLockPath = path.join(workspaceRoot, 'bun.lock');
    if (await this.fileExists(bunLockPath)) {
      return 'npm'; // Treat bun workspaces as npm-style
    }

    // If we found a workspace configuration but no lock file, default to npm
    // This handles test cases where we create workspaces without lock files
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    if (await this.fileExists(packageJsonPath)) {
      try {
        const packageContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
        const packageJson: PackageJson = JSON.parse(packageContent);
        
        if (packageJson.workspaces) {
          return 'npm'; // Default to npm for workspaces without lock files
        }
      } catch (error) {
        debug('Error reading package.json for workspace type detection: %O', error);
      }
    }

    return null;
  }

  /**
   * Find all workspace member packages
   */
  private static async findWorkspaceMembers(workspaceRoot: string, workspaceType: string | null): Promise<string[]> {
    const members: string[] = [workspaceRoot]; // Always include root

    try {
      if (workspaceType === 'pnpm') {
        // For pnpm, read pnpm-workspace.yaml
        const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
        const content = await fs.promises.readFile(pnpmWorkspacePath, 'utf-8');
        const patterns = this.parsePnpmWorkspacePatterns(content);
        
        for (const pattern of patterns) {
          const workspacePaths = await globby(pattern, {
            cwd: workspaceRoot,
            onlyDirectories: true,
            absolute: true
          });
          
          for (const workspacePath of workspacePaths) {
            if (await this.hasPackageJson(workspacePath) && !members.includes(workspacePath)) {
              members.push(workspacePath);
            }
          }
        }
      } else if (workspaceType === 'lerna') {
        // For Lerna, read lerna.json
        const lernaPath = path.join(workspaceRoot, 'lerna.json');
        const content = await fs.promises.readFile(lernaPath, 'utf-8');
        const lernaConfig = JSON.parse(content);
        
        if (lernaConfig.packages) {
          for (const pattern of lernaConfig.packages) {
            const workspacePaths = await globby(pattern, {
              cwd: workspaceRoot,
              onlyDirectories: true,
              absolute: true
            });
            
            for (const workspacePath of workspacePaths) {
              if (await this.hasPackageJson(workspacePath) && !members.includes(workspacePath)) {
                members.push(workspacePath);
              }
            }
          }
        }
      } else {
        // For npm/yarn workspaces, read package.json
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
        const packageJson: PackageJson = JSON.parse(content);
        
        let workspacePatterns: string[] = [];
        if (packageJson.workspaces) {
          if (Array.isArray(packageJson.workspaces)) {
            workspacePatterns = packageJson.workspaces;
          } else if (packageJson.workspaces.packages) {
            workspacePatterns = packageJson.workspaces.packages;
          }
        }
        
        for (const pattern of workspacePatterns) {
          const workspacePaths = await globby(pattern, {
            cwd: workspaceRoot,
            onlyDirectories: true,
            absolute: true
          });
          
          for (const workspacePath of workspacePaths) {
            if (await this.hasPackageJson(workspacePath) && !members.includes(workspacePath)) {
              members.push(workspacePath);
            }
          }
        }
      }
    } catch (error) {
      debug('Error finding workspace members: %O', error);
    }

    return members;
  }

  /**
   * Parse pnpm workspace patterns from pnpm-workspace.yaml content
   */
  private static parsePnpmWorkspacePatterns(content: string): string[] {
    const patterns: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // Remove quotes if present
        const pattern = trimmed.replace(/^['"]|['"]$/g, '');
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }

  /**
   * Check if a file exists
   */
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory has a package.json file
   */
  private static async hasPackageJson(dirPath: string): Promise<boolean> {
    const packageJsonPath = path.join(dirPath, 'package.json');
    return await this.fileExists(packageJsonPath);
  }
}

