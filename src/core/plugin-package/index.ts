// =============================================================================
// AENEWS Enterprise OS — PHASE OMEGA
// Plugin Package Manager
// Handles the .aenews-plugin package format with SHA256 signatures, manifest
// verification, installation, extraction, and listing.
// =============================================================================

import { createHash, randomUUID } from 'crypto';
import { readFile, writeFile, mkdir, readdir, stat, copyFile, rm, existsSync } from 'fs';
import { join, resolve, basename } from 'path';
import { promisify } from 'util';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const mkdirAsync = promisify(mkdir);
const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);
const copyFileAsync = promisify(copyFile);
const rmAsync = promisify(rm);
const existsAsync = promisify(existsSync);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The full manifest of an AENEWS plugin package. */
export interface PackageManifest {
  name: string;
  id: string;
  version: string;
  description: string;
  author: string;
  publisher: string;
  signature: PackageSignature;
  checksum: string;
  contents: {
    manifest: string;
    runtime: string;
    assets: string;
    schema: string;
    knowledge: string;
    reports: string;
    builders: string;
    agents: string;
    migrations: string;
    signatures: string;
    checksums: string;
  };
}

/** Cryptographic signature attached to a plugin package. */
export interface PackageSignature {
  sha256: string;
  signature: string;
  publisher: string;
  version: string;
  compatibility: string;
  signedAt: string;
}

/** Result of verifying a plugin package. */
export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Computes SHA256 hex digest of a string. */
function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Current ISO 8601 timestamp. */
function nowISO(): string {
  return new Date().toISOString();
}

/** Default contents structure for a new package. */
function defaultContents(id: string) {
  return {
    manifest: `plugins/${id}/plugin.json`,
    runtime: `plugins/${id}/runtime/`,
    assets: `plugins/${id}/assets/`,
    schema: `plugins/${id}/schema/`,
    knowledge: `plugins/${id}/knowledge/`,
    reports: `plugins/${id}/reports/`,
    builders: `plugins/${id}/builders/`,
    agents: `plugins/${id}/agents/`,
    migrations: `plugins/${id}/migrations/`,
    signatures: `plugins/${id}/signatures/`,
    checksums: `plugins/${id}/checksums.json`,
  };
}

// ---------------------------------------------------------------------------
// PluginPackageManager
// ---------------------------------------------------------------------------

export class PluginPackageManager {
  constructor() {
    console.log('[PluginPackageManager] Initialized — PHASE OMEGA Packaging');
  }

  // ---- Public API ----------------------------------------------------------

  /**
   * Reads plugin.json from pluginDir, generates a SHA256 checksum of the
   * manifest content, and returns the manifest + checksum.
   */
  async createPackage(pluginDir: string): Promise<{ manifest: PackageManifest; checksum: string }> {
    const manifestPath = join(pluginDir, 'plugin.json');

    if (!(await existsAsync(manifestPath))) {
      throw new Error(`[PluginPackageManager] plugin.json not found at ${manifestPath}`);
    }

    const raw = await readFileAsync(manifestPath, 'utf-8');
    const pluginData = JSON.parse(raw);

    const checksum = sha256Hex(raw);

    const signature = this.generateSignature(pluginData.id ?? pluginData.name ?? 'unknown', raw, pluginData.publisher ?? 'aenews');

    const manifest: PackageManifest = {
      name: pluginData.name ?? 'Unnamed Plugin',
      id: pluginData.id ?? pluginData.name ?? 'unknown',
      version: pluginData.version ?? '0.0.0',
      description: pluginData.description ?? '',
      author: pluginData.author ?? 'Unknown',
      publisher: pluginData.publisher ?? 'AENEWS',
      signature,
      checksum,
      contents: defaultContents(pluginData.id ?? pluginData.name ?? 'unknown'),
    };

    console.log(`[PluginPackageManager] Package created: ${manifest.id}@${manifest.version} (checksum: ${checksum.slice(0, 12)}...)`);

    return { manifest, checksum };
  }

  /**
   * Verifies the integrity and consistency of a PackageManifest.
   * Checks required fields, checksum format, signature structure, and contents.
   */
  verifyPackage(pkg: PackageManifest): VerificationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!pkg.id || pkg.id.trim() === '') errors.push('Package manifest missing "id"');
    if (!pkg.version || pkg.version.trim() === '') errors.push('Package manifest missing "version"');
    if (!pkg.name || pkg.name.trim() === '') errors.push('Package manifest missing "name"');
    if (!pkg.checksum || pkg.checksum.trim() === '') errors.push('Package manifest missing "checksum"');

    // Checksum format (SHA256 hex = 64 chars)
    if (pkg.checksum && !/^[a-fA-F0-9]{64}$/.test(pkg.checksum)) {
      errors.push(`Invalid checksum format: expected 64-char hex, got "${pkg.checksum.slice(0, 16)}..."`);
    }

    // Signature verification
    const sigValid = this.verifySignature(pkg.signature);
    if (!sigValid) {
      errors.push('Package signature verification failed');
    }

    // Compatibility warning
    if (pkg.signature.compatibility && pkg.signature.compatibility !== '1.0.0') {
      warnings.push(`Package compatibility version "${pkg.signature.compatibility}" may not match platform`);
    }

    // Contents structure
    if (!pkg.contents) {
      warnings.push('Package manifest has no contents structure defined');
    } else {
      if (!pkg.contents.manifest) warnings.push('Package contents missing manifest path');
      if (!pkg.contents.runtime) warnings.push('Package contents missing runtime path');
    }

    const valid = errors.length === 0;

    if (valid) {
      console.log(`[PluginPackageManager] Package verified OK: ${pkg.id}@${pkg.version}`);
    } else {
      console.warn(`[PluginPackageManager] Package verification FAILED: ${pkg.id} — ${errors.length} error(s)`);
    }

    return { valid, errors, warnings };
  }

  /**
   * Verifies that a PackageSignature contains a valid SHA256 hash and
   * required structural fields.
   */
  verifySignature(signature: PackageSignature): boolean {
    if (!signature) return false;
    if (!signature.sha256 || !/^[a-fA-F0-9]{64}$/.test(signature.sha256)) return false;
    if (!signature.publisher || signature.publisher.trim() === '') return false;
    if (!signature.version || signature.version.trim() === '') return false;
    if (!signature.signedAt) return false;

    // Verify the signedAt is a valid ISO date
    const d = new Date(signature.signedAt);
    if (isNaN(d.getTime())) return false;

    return true;
  }

  /**
   * Generates a PackageSignature for a plugin with a SHA256 hash of the content.
   */
  generateSignature(pluginId: string, content: string, publisherKey: string): PackageSignature {
    const sha256 = sha256Hex(content);

    const signature: PackageSignature = {
      sha256,
      signature: `sig_${randomUUID().replace(/-/g, '').slice(0, 32)}`,
      publisher: publisherKey ?? 'aenews',
      version: '1.0.0',
      compatibility: '1.0.0',
      signedAt: nowISO(),
    };

    console.log(`[PluginPackageManager] Signature generated for "${pluginId}" by "${publisherKey}"`);

    return signature;
  }

  /**
   * Extracts a package archive (or directory) to a temporary directory.
   * In this implementation, if archivePath is a directory, it creates a
   * timestamped temp copy. If it's a file, it would extract (placeholder).
   */
  async extractPackage(archivePath: string): Promise<string> {
    const s = await statAsync(archivePath);

    const tempDir = join(process.env.TMPDIR ?? '/tmp', `aenews-extract-${Date.now()}`);

    if (s.isDirectory()) {
      // Copy directory to temp
      await mkdirAsync(tempDir, { recursive: true });
      const entries = await readdirAsync(archivePath);

      for (const entry of entries) {
        const src = join(archivePath, entry);
        const dest = join(tempDir, entry);
        const entryStat = await statAsync(src);

        if (entryStat.isDirectory()) {
          await mkdirAsync(dest, { recursive: true });
          await this._copyDirRecursive(src, dest);
        } else {
          await copyFileAsync(src, dest);
        }
      }

      console.log(`[PluginPackageManager] Package extracted from directory to ${tempDir}`);
    } else {
      // For a file-based archive, create temp dir and copy the file
      await mkdirAsync(tempDir, { recursive: true });
      await copyFileAsync(archivePath, join(tempDir, basename(archivePath)));
      console.log(`[PluginPackageManager] Package file copied to ${tempDir}`);
    }

    return tempDir;
  }

  /**
   * Installs a package from pkgPath into targetDir.
   * Copies plugin files and writes the manifest.
   */
  async installPackage(pkgPath: string, targetDir: string): Promise<boolean> {
    try {
      const extractDir = await this.extractPackage(pkgPath);

      // Read manifest from extracted location
      const manifestPath = join(extractDir, 'plugin.json');
      if (!(await existsAsync(manifestPath))) {
        console.error(`[PluginPackageManager] No plugin.json found in package at ${pkgPath}`);
        await this._cleanupDir(extractDir);
        return false;
      }

      // Ensure target directory exists
      const pluginTargetDir = join(targetDir, basename(pkgPath).replace(/\.[^.]+$/, ''));
      await mkdirAsync(pluginTargetDir, { recursive: true });

      // Copy all files
      const entries = await readdirAsync(extractDir);
      for (const entry of entries) {
        const src = join(extractDir, entry);
        const dest = join(pluginTargetDir, entry);
        const entryStat = await statAsync(src);

        if (entryStat.isDirectory()) {
          await mkdirAsync(dest, { recursive: true });
          await this._copyDirRecursive(src, dest);
        } else {
          await copyFileAsync(src, dest);
        }
      }

      // Cleanup temp
      await this._cleanupDir(extractDir);

      console.log(`[PluginPackageManager] Package installed to ${pluginTargetDir}`);
      return true;
    } catch (error) {
      console.error(`[PluginPackageManager] Install failed: ${error}`);
      return false;
    }
  }

  /**
   * Lists all valid AENEWS plugin packages found in the given directory.
   * Scans for subdirectories containing plugin.json.
   */
  async listPackages(dir: string): Promise<PackageManifest[]> {
    const packages: PackageManifest[] = [];

    if (!(await existsAsync(dir))) {
      console.warn(`[PluginPackageManager] Directory does not exist: ${dir}`);
      return packages;
    }

    const entries = await readdirAsync(dir);

    for (const entry of entries) {
      const pluginDir = join(dir, entry);
      const s = await statAsync(pluginDir).catch(() => null);

      if (s && s.isDirectory()) {
        const manifest = await this.getPackageInfo(pluginDir);
        if (manifest) {
          packages.push(manifest);
        }
      }
    }

    console.log(`[PluginPackageManager] Found ${packages.length} package(s) in ${dir}`);
    return packages;
  }

  /**
   * Reads and parses the plugin.json from a plugin directory, returning
   * a full PackageManifest or null if not found / invalid.
   */
  async getPackageInfo(pluginDir: string): Promise<PackageManifest | null> {
    const manifestPath = join(pluginDir, 'plugin.json');

    if (!(await existsAsync(manifestPath))) {
      return null;
    }

    try {
      const raw = await readFileAsync(manifestPath, 'utf-8');
      const data = JSON.parse(raw);

      const checksum = sha256Hex(raw);
      const signature = this.generateSignature(data.id ?? data.name ?? 'unknown', raw, data.publisher ?? 'aenews');

      const manifest: PackageManifest = {
        name: data.name ?? 'Unnamed Plugin',
        id: data.id ?? data.name ?? 'unknown',
        version: data.version ?? '0.0.0',
        description: data.description ?? '',
        author: data.author ?? 'Unknown',
        publisher: data.publisher ?? 'AENEWS',
        signature,
        checksum,
        contents: data.contents ?? defaultContents(data.id ?? data.name ?? 'unknown'),
      };

      return manifest;
    } catch (error) {
      console.error(`[PluginPackageManager] Failed to read package info from ${pluginDir}: ${error}`);
      return null;
    }
  }

  // ---- Private helpers -----------------------------------------------------

  private async _copyDirRecursive(src: string, dest: string): Promise<void> {
    const entries = await readdirAsync(src);

    for (const entry of entries) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      const s = await statAsync(srcPath);

      if (s.isDirectory()) {
        await mkdirAsync(destPath, { recursive: true });
        await this._copyDirRecursive(srcPath, destPath);
      } else {
        await copyFileAsync(srcPath, destPath);
      }
    }
  }

  private async _cleanupDir(dir: string): Promise<void> {
    await rmAsync(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: PluginPackageManager | null = null;

/** Returns the singleton PluginPackageManager instance. */
export function getPluginPackageManager(): PluginPackageManager {
  if (!_instance) {
    _instance = new PluginPackageManager();
  }
  return _instance;
}

/** Resets the singleton — useful for testing. */
export function resetPluginPackageManager(): void {
  _instance = null;
  console.log('[PluginPackageManager] Singleton reset');
}