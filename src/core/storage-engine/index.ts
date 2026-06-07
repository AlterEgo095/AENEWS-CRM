// ============================================================
// AENEWS Enterprise OS — Storage Engine
// File storage abstraction layer.
//
// Architecture:
//   Buffer | File
//     ↓ upload()
//   StorageEngine
//     ↓ provider adapter
//   [ local | S3 | GCS | Azure ]
//     ↓
//   File model (Prisma) — metadata & ownership
//   Local filesystem — actual bytes (MVP)
//
// MVP uses local filesystem storage.  The provider interface is
// designed so S3 / GCS / Azure adapters can be swapped in
// later without changing the public API.
// ============================================================

import { db } from '@/lib/db';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ============================================================
// Types
// ============================================================

export type StorageProvider = 'local' | 's3' | 'gcs' | 'azure';

export type StorageVisibility = 'public' | 'private';

/** Stored file record returned by the engine. */
export interface StorageFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  path: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

/** Options for file upload operations. */
export interface StorageOptions {
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  visibility?: StorageVisibility;
}

/** Stats returned by getStats(). */
export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, number>;
}

// ============================================================
// Custom Errors
// ============================================================

export class FileNotFoundError extends Error {
  constructor(public readonly fileId: string) {
    super(`File "${fileId}" not found.`);
    this.name = 'FileNotFoundError';
  }
}

export class FileUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileUploadError';
  }
}

export class FileDeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileDeleteError';
  }
}

// ============================================================
// MIME type mapping
// ============================================================

const MIME_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.yaml': 'application/x-yaml',
  '.yml': 'application/x-yaml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.ts': 'application/typescript',
  '.tsx': 'application/typescript',
  '.jsx': 'application/javascript',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
};

// ============================================================
// StorageEngine
// ============================================================

export class StorageEngine {
  private provider: StorageProvider = 'local';
  private basePath = path.join(process.cwd(), '.data', 'uploads');
  private _initialized = false;

  // ===========================================================
  // Initialisation
  // ===========================================================

  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Ensure upload directory exists
    await mkdir(this.basePath, { recursive: true });

    this._initialized = true;
    console.log(
      `[StorageEngine] Initialized — provider=${this.provider}, basePath=${this.basePath}`,
    );
  }

  // ===========================================================
  // Upload
  // ===========================================================

  /**
   * Upload a file.  Accepts both Node.js Buffer and Web File objects.
   * Persists the file to the configured storage provider and records
   * metadata in the File DB model.
   */
  async upload(
    file: Buffer | File,
    filename: string,
    tenantId: string,
    userId: string,
    options?: StorageOptions,
  ): Promise<StorageFile> {
    if (!this._initialized) await this.initialize();

    // ── Read file into Buffer ─────────────────────────────────
    let buffer: Buffer;
    if (Buffer.isBuffer(file)) {
      buffer = file;
    } else {
      const webFile = file as globalThis.File;
      buffer = Buffer.from(await webFile.arrayBuffer());
    }
    const size = buffer.length;

    // ── Generate stable ID and storage path ───────────────────
    const id = crypto.randomUUID();
    const ext = path.extname(filename).toLowerCase();
    const safeFilename = `${id}${ext}`;
    const relativePath = path.join(tenantId, safeFilename);
    const fullPath = path.join(this.basePath, relativePath);

    // ── Write to local filesystem ────────────────────────────
    try {
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, buffer);
    } catch (error) {
      throw new FileUploadError(
        `Failed to write file to disk: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // ── Determine MIME type ─────────────────────────────────
    const mimeType =
      MIME_TYPE_MAP[ext] ?? (file instanceof File ? file.type : 'application/octet-stream');

    // ── Build the URL ───────────────────────────────────────
    const visibility = options?.visibility ?? 'private';
    const url = visibility === 'public'
      ? `/uploads/${relativePath}`
      : `/files/${id}`;

    // ── Persist metadata to DB ───────────────────────────────
    const record = await db.file.create({
      data: {
        id,
        tenantId,
        userId,
        name: filename,
        mimeType,
        size,
        url,
        path: relativePath,
        entityType: options?.entityType ?? null,
        entityId: options?.entityId ?? null,
      },
    });

    console.log(
      `[StorageEngine] Uploaded "${filename}" (${this.formatBytes(size)}) as "${id}".`,
    );
    return this.toStorageFile(record);
  }

  // ===========================================================
  // Download
  // ===========================================================

  /**
   * Download a file by ID.  Returns the raw file contents as a Buffer.
   */
  async download(fileId: string): Promise<Buffer> {
    const record = await db.file.findUnique({ where: { id: fileId } });
    if (!record || !record.path) {
      throw new FileNotFoundError(fileId);
    }

    const fullPath = path.join(this.basePath, record.path);
    return readFile(fullPath);
  }

  // ===========================================================
  // Delete
  // ===========================================================

  /**
   * Delete a file by ID.
   * Removes both the DB record and the physical file on disk.
   */
  async delete(fileId: string): Promise<void> {
    const record = await db.file.findUnique({ where: { id: fileId } });
    if (!record) return;

    // ── Remove from filesystem (best-effort) ────────────────
    if (record.path) {
      try {
        const fullPath = path.join(this.basePath, record.path);
        await unlink(fullPath);
      } catch {
        // File may already be deleted from disk — continue with DB cleanup
      }
    }

    // ── Remove from DB ───────────────────────────────────────
    await db.file.delete({ where: { id: fileId } });
    console.log(`[StorageEngine] Deleted file "${fileId}".`);
  }

  // ===========================================================
  // Get
  // ===========================================================

  /**
   * Get file metadata by ID (without the file contents).
   */
  async get(fileId: string): Promise<StorageFile | null> {
    const record = await db.file.findUnique({ where: { id: fileId } });
    return record ? this.toStorageFile(record) : null;
  }

  // ===========================================================
  // List
  // ===========================================================

  /**
   * List files for a tenant, optionally filtered by entity type / ID.
   */
  async list(
    tenantId: string,
    filter?: { entityType?: string; entityId?: string },
  ): Promise<StorageFile[]> {
    const where: Record<string, any> = { tenantId };
    if (filter?.entityType) where.entityType = filter.entityType;
    if (filter?.entityId) where.entityId = filter.entityId;

    const records = await db.file.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toStorageFile(r));
  }

  // ===========================================================
  // Signed URL
  // ===========================================================

  /**
   * Generate a time-limited signed URL for file access.
   *
   * For MVP (local provider), this returns a token-authenticated URL.
   * In production with S3 / GCS / Azure, this would delegate to
   * the cloud provider's signed URL generation.
   */
  async getSignedUrl(fileId: string, expiresIn: number = 3600): Promise<string> {
    const record = await db.file.findUnique({ where: { id: fileId } });
    if (!record) {
      throw new FileNotFoundError(fileId);
    }

    const expires = Date.now() + expiresIn * 1000;
    const payload = JSON.stringify({ fileId, expires });
    const token = Buffer.from(payload).toString('base64url');

    return `${record.url}?token=${token}&expires=${expires}`;
  }

  // ===========================================================
  // Stats
  // ===========================================================

  /**
   * Get aggregate storage statistics across all tenants.
   */
  async getStats(): Promise<StorageStats> {
    const files = await db.file.findMany({
      select: { mimeType: true, size: true },
    });

    let totalSize = 0;
    const byType: Record<string, number> = {};

    for (const file of files) {
      totalSize += file.size;
      const category = this.categoriseMimeType(file.mimeType);
      byType[category] = (byType[category] ?? 0) + 1;
    }

    return {
      totalFiles: files.length,
      totalSize,
      byType,
    };
  }

  // ===========================================================
  // Private helpers
  // ===========================================================

  /** Map a Prisma File record to the domain StorageFile type. */
  private toStorageFile(record: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    url: string;
    path: string | null;
    entityType: string | null;
    entityId: string | null;
  }): StorageFile {
    return {
      id: record.id,
      name: record.name,
      mimeType: record.mimeType,
      size: record.size,
      url: record.url,
      path: record.path ?? '',
      entityType: record.entityType ?? undefined,
      entityId: record.entityId ?? undefined,
    };
  }

  /** Classify a MIME type into a high-level category. */
  private categoriseMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (
      mimeType.startsWith('text/') ||
      mimeType.includes('json') ||
      mimeType.includes('xml') ||
      mimeType.includes('markdown') ||
      mimeType.includes('yaml')
    ) {
      return 'document';
    }
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gz')) {
      return 'archive';
    }
    if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('powerpoint')) {
      return 'document';
    }
    return 'other';
  }

  /** Human-readable byte formatting. */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
}

// ============================================================
// Singleton accessor
// ============================================================

let _storageEngine: StorageEngine | null = null;

export function getStorageEngine(): StorageEngine {
  if (!_storageEngine) {
    _storageEngine = new StorageEngine();
  }
  return _storageEngine;
}
