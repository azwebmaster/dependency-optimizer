import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Test utilities for creating temporary files and mock data
 */
export class TestUtils {
  private static tempFiles: string[] = [];

  /**
   * Create a temporary bun.lock file with given content
   */
  static async createTempBunLock(content: string): Promise<string> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bun-lock-test-'));
    const lockPath = path.join(tempDir, 'bun.lock');

    await fs.promises.writeFile(lockPath, content);
    this.tempFiles.push(tempDir);

    return lockPath;
  }

  /**
   * Load a test fixture file
   */
  static loadFixture(fixtureName: string): string {
    const fixturePath = path.join(__dirname, 'fixtures', fixtureName);
    return fs.readFileSync(fixturePath, 'utf-8');
  }

  /**
   * Create a temporary bun.lock file from a fixture
   */
  static async createTempBunLockFromFixture(fixtureName: string): Promise<string> {
    const content = this.loadFixture(fixtureName);
    return this.createTempBunLock(content);
  }

  /**
   * Create a temporary pnpm-lock.yaml file with given content
   */
  static async createTempPnpmLock(content: string): Promise<string> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pnpm-lock-test-'));
    const lockPath = path.join(tempDir, 'pnpm-lock.yaml');

    await fs.promises.writeFile(lockPath, content);
    this.tempFiles.push(tempDir);

    return lockPath;
  }

  /**
   * Create a temporary pnpm-lock.yaml file from a fixture
   */
  static async createTempPnpmLockFromFixture(fixtureName: string): Promise<string> {
    const content = this.loadFixture(fixtureName);
    return this.createTempPnpmLock(content);
  }

  /**
   * Create a simple bun.lock with minimal data
   */
  static createSimpleBunLock(): string {
    return JSON.stringify({
      lockfileVersion: 1,
      workspaces: {
        "": {
          name: "simple-test",
          dependencies: {
            "test-package": "^1.0.0"
          },
          devDependencies: {}
        }
      },
      packages: {
        "test-package": [
          "test-package@1.0.0",
          "https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz",
          {
            dependencies: {}
          },
          "sha512-example"
        ]
      }
    }, null, 2);
  }

  /**
   * Create a bun.lock with duplicates for testing
   */
  static createBunLockWithDuplicates(): string {
    return JSON.stringify({
      lockfileVersion: 1,
      workspaces: {
        "": {
          name: "duplicate-test",
          dependencies: {
            "app-a": "^1.0.0",
            "app-b": "^1.0.0"
          },
          devDependencies: {}
        }
      },
      packages: {
        "app-a": [
          "app-a@1.0.0",
          "https://registry.npmjs.org/app-a/-/app-a-1.0.0.tgz",
          {
            dependencies: {
              "common-lib": "^1.0.0"
            }
          },
          "sha512-example1"
        ],
        "app-b": [
          "app-b@1.0.0",
          "https://registry.npmjs.org/app-b/-/app-b-1.0.0.tgz",
          {
            dependencies: {
              "common-lib": "^2.0.0"
            }
          },
          "sha512-example2"
        ],
        "common-lib": [
          "common-lib@1.0.0",
          "https://registry.npmjs.org/common-lib/-/common-lib-1.0.0.tgz",
          {
            dependencies: {}
          },
          "sha512-example3"
        ],
        "app-b/common-lib": [
          "common-lib@2.0.0",
          "https://registry.npmjs.org/common-lib/-/common-lib-2.0.0.tgz",
          {
            dependencies: {}
          },
          "sha512-example4"
        ],
        "app-a/common-lib": [
          "common-lib@1.0.0",
          "https://registry.npmjs.org/common-lib/-/common-lib-1.0.0.tgz",
          {
            dependencies: {}
          },
          "sha512-example3"
        ]
      }
    }, null, 2);
  }

  /**
   * Create malformed JSON for testing error handling
   */
  static createMalformedBunLock(): string {
    return `{
      "lockfileVersion": 1,
      "workspaces": {
        "": {
          "name": "malformed-test",
          "dependencies": {
            "test-package": "^1.0.0",
          }
        }
      },
      "packages": {
        "test-package": [
          "test-package@1.0.0",
          "https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz",
          {
            dependencies: {}
          },
          "sha512-example"
        ]
      }
    }`;
  }
}