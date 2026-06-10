// ============================================================
// AENEWS Enterprise OS — Marketplace Engine (PHASE OMEGA)
// Publishing, installing, reviewing, and managing plugins
// via an in-memory marketplace with full package lifecycle.
// ============================================================

// ============================================================
// Types
// ============================================================

export interface PluginPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  author: string;
  publisher: string;
  category: string;
  tags: string[];
  license: string;
  signature: string;
  checksum: string;
  size: number;
  downloads: number;
  rating: number;
  reviews: number;
  publishedAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'deprecated' | 'removed';
}

export interface MarketplaceListing {
  package: PluginPackage;
  installed: boolean;
  updateAvailable: boolean;
  compatible: boolean;
}

export interface Review {
  id: string;
  packageId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface InstallResult {
  success: boolean;
  packageId: string;
  version: string;
  pluginId: string;
  errors?: string[];
}

export interface MarketplaceStats {
  totalPackages: number;
  totalDownloads: number;
  totalReviews: number;
  categories: string[];
  publishers: string[];
}

// ============================================================
// Internal install tracking
// ============================================================

interface InstallationRecord {
  packageId: string;
  tenantId: string;
  version: string;
  installedAt: Date;
}

// ============================================================
// MarketplaceEngine
// ============================================================

export class MarketplaceEngine {
  private packages: Map<string, PluginPackage> = new Map();
  private reviews: Map<string, Review[]> = new Map();
  private installs: Map<string, InstallationRecord[]> = new Map();

  constructor() {
    console.info('[MarketplaceEngine] Initialized — PHASE OMEGA Marketplace');
  }

  // ============================================================
  // PUBLISH — Register a new plugin package
  // ============================================================

  publish(pkg: Partial<PluginPackage>): PluginPackage {
    if (!pkg.id) throw new Error('[MarketplaceEngine] Package must have an id');
    if (!pkg.slug) throw new Error('[MarketplaceEngine] Package must have a slug');
    if (!pkg.version) throw new Error('[MarketplaceEngine] Package must have a version');
    if (!pkg.name) throw new Error('[MarketplaceEngine] Package must have a name');

    if (this.packages.has(pkg.id)) {
      throw new Error(`[MarketplaceEngine] Package with id "${pkg.id}" already exists`);
    }

    const now = new Date();

    const fullPackage: PluginPackage = {
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      version: pkg.version,
      description: pkg.description ?? '',
      author: pkg.author ?? 'unknown',
      publisher: pkg.publisher ?? 'unknown',
      category: pkg.category ?? 'uncategorized',
      tags: pkg.tags ?? [],
      license: pkg.license ?? 'MIT',
      signature: pkg.signature ?? '',
      checksum: pkg.checksum ?? '',
      size: pkg.size ?? 0,
      downloads: pkg.downloads ?? 0,
      rating: pkg.rating ?? 0,
      reviews: pkg.reviews ?? 0,
      publishedAt: pkg.publishedAt ?? now,
      updatedAt: pkg.updatedAt ?? now,
      status: pkg.status ?? 'published',
    };

    this.packages.set(pkg.id, fullPackage);
    this.reviews.set(pkg.id, []);

    console.info(`[MarketplaceEngine] Published "${fullPackage.slug}" v${fullPackage.version}`);
    return fullPackage;
  }

  // ============================================================
  // INSTALL — Install a package for a tenant
  // ============================================================

  install(packageId: string, tenantId: string): InstallResult {
    const pkg = this.packages.get(packageId);

    if (!pkg) {
      return { success: false, packageId, version: '', pluginId: '', errors: ['Package not found'] };
    }

    if (pkg.status === 'removed' || pkg.status === 'deprecated') {
      return {
        success: false,
        packageId,
        version: pkg.version,
        pluginId: pkg.id,
        errors: [`Package is ${pkg.status} and cannot be installed`],
      };
    }

    const tenantKey = `${tenantId}:${packageId}`;
    const existingInstalls = this.installs.get(tenantKey) ?? [];

    if (existingInstalls.length > 0) {
      return {
        success: false,
        packageId,
        version: pkg.version,
        pluginId: pkg.id,
        errors: ['Package is already installed for this tenant'],
      };
    }

    const record: InstallationRecord = {
      packageId,
      tenantId,
      version: pkg.version,
      installedAt: new Date(),
    };

    this.installs.set(tenantKey, [record]);

    // Increment download count
    pkg.downloads++;
    pkg.updatedAt = new Date();

    console.info(`[MarketplaceEngine] Installed "${pkg.slug}" v${pkg.version} for tenant "${tenantId}"`);

    return {
      success: true,
      packageId,
      version: pkg.version,
      pluginId: pkg.id,
    };
  }

  // ============================================================
  // UNINSTALL — Remove a package from a tenant
  // ============================================================

  uninstall(packageId: string, tenantId: string): boolean {
    const pkg = this.packages.get(packageId);
    if (!pkg) return false;

    const tenantKey = `${tenantId}:${packageId}`;
    const existing = this.installs.get(tenantKey);

    if (!existing || existing.length === 0) return false;

    this.installs.delete(tenantKey);

    console.info(`[MarketplaceEngine] Uninstalled "${pkg.slug}" from tenant "${tenantId}"`);
    return true;
  }

  // ============================================================
  // UPDATE — Update a package to the latest version for a tenant
  // ============================================================

  update(packageId: string, tenantId: string): InstallResult {
    const pkg = this.packages.get(packageId);

    if (!pkg) {
      return { success: false, packageId, version: '', pluginId: '', errors: ['Package not found'] };
    }

    const tenantKey = `${tenantId}:${packageId}`;
    const existing = this.installs.get(tenantKey);

    if (!existing || existing.length === 0) {
      return {
        success: false,
        packageId,
        version: pkg.version,
        pluginId: pkg.id,
        errors: ['Package is not installed for this tenant'],
      };
    }

    const currentVersion = existing[0].version;

    if (currentVersion === pkg.version) {
      return {
        success: false,
        packageId,
        version: pkg.version,
        pluginId: pkg.id,
        errors: ['Already on the latest version'],
      };
    }

    // Update the install record
    this.installs.set(tenantKey, [
      {
        packageId,
        tenantId,
        version: pkg.version,
        installedAt: new Date(),
      },
    ]);

    pkg.downloads++;
    pkg.updatedAt = new Date();

    console.info(
      `[MarketplaceEngine] Updated "${pkg.slug}" from v${currentVersion} to v${pkg.version} for tenant "${tenantId}"`,
    );

    return {
      success: true,
      packageId,
      version: pkg.version,
      pluginId: pkg.id,
    };
  }

  // ============================================================
  // SEARCH — Find packages by query, category, and/or tags
  // ============================================================

  search(query: string, category?: string, tags?: string[]): MarketplaceListing[] {
    const q = query.toLowerCase().trim();
    const tagSet = new Set(tags ?? []);

    const results: MarketplaceListing[] = [];

    for (const pkg of this.packages.values()) {
      if (pkg.status === 'removed') continue;

      // Category filter
      if (category && pkg.category.toLowerCase() !== category.toLowerCase()) continue;

      // Tag filter — package must contain all requested tags
      if (tagSet.size > 0) {
        const pkgTags = new Set(pkg.tags.map(t => t.toLowerCase()));
        const hasAllTags = Array.from(tagSet).every(tag => pkgTags.has(tag.toLowerCase()));
        if (!hasAllTags) continue;
      }

      // Text search across name, slug, description, author
      if (q) {
        const haystack = `${pkg.name} ${pkg.slug} ${pkg.description} ${pkg.author}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }

      // Determine if installed (check any tenant — simplified)
      let installed = false;
      let updateAvailable = false;
      for (const [key, records] of this.installs.entries()) {
        if (records.length > 0 && records[0].packageId === pkg.id) {
          installed = true;
          if (records[0].version !== pkg.version) {
            updateAvailable = true;
          }
          break;
        }
      }

      const compatible = this.checkCompatibility(pkg.id, '1.0.0');

      results.push({ package: pkg, installed, updateAvailable, compatible });
    }

    // Sort by downloads descending, then rating descending
    results.sort((a, b) => {
      if (b.package.downloads !== a.package.downloads) {
        return b.package.downloads - a.package.downloads;
      }
      return b.package.rating - a.package.rating;
    });

    return results;
  }

  // ============================================================
  // GET PACKAGE — Retrieve a single package by ID
  // ============================================================

  getPackage(id: string): PluginPackage | undefined {
    return this.packages.get(id);
  }

  // ============================================================
  // GET CATEGORIES — List all unique categories
  // ============================================================

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const pkg of this.packages.values()) {
      if (pkg.status !== 'removed') {
        categories.add(pkg.category);
      }
    }
    return Array.from(categories).sort();
  }

  // ============================================================
  // ADD REVIEW — Submit a review for a package
  // ============================================================

  addReview(packageId: string, review: Omit<Review, 'id' | 'createdAt'>): Review {
    const pkg = this.packages.get(packageId);
    if (!pkg) throw new Error(`[MarketplaceEngine] Package "${packageId}" not found`);

    if (review.rating < 1 || review.rating > 5) {
      throw new Error('[MarketplaceEngine] Rating must be between 1 and 5');
    }

    const fullReview: Review = {
      id: `review_${packageId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      packageId,
      userId: review.userId,
      rating: review.rating,
      comment: review.comment,
      createdAt: new Date(),
    };

    const packageReviews = this.reviews.get(packageId) ?? [];
    packageReviews.push(fullReview);
    this.reviews.set(packageId, packageReviews);

    // Recalculate average rating
    pkg.reviews = packageReviews.length;
    const totalRating = packageReviews.reduce((sum, r) => sum + r.rating, 0);
    pkg.rating = Math.round((totalRating / packageReviews.length) * 100) / 100;
    pkg.updatedAt = new Date();

    console.info(
      `[MarketplaceEngine] Review added for "${pkg.slug}": ${review.rating}/5 by user "${review.userId}"`,
    );

    return fullReview;
  }

  // ============================================================
  // GET REVIEWS — Retrieve all reviews for a package
  // ============================================================

  getReviews(packageId: string): Review[] {
    return (this.reviews.get(packageId) ?? []).slice().sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  // ============================================================
  // RATE — Quick-rate a package (no comment)
  // ============================================================

  rate(packageId: string, rating: number): PluginPackage {
    const pkg = this.packages.get(packageId);
    if (!pkg) throw new Error(`[MarketplaceEngine] Package "${packageId}" not found`);

    if (rating < 1 || rating > 5) {
      throw new Error('[MarketplaceEngine] Rating must be between 1 and 5');
    }

    const totalScore = pkg.rating * pkg.reviews + rating;
    pkg.reviews++;
    pkg.rating = Math.round((totalScore / pkg.reviews) * 100) / 100;
    pkg.updatedAt = new Date();

    console.info(`[MarketplaceEngine] "${pkg.slug}" rated ${rating}/5 (avg: ${pkg.rating})`);
    return { ...pkg };
  }

  // ============================================================
  // CHECK COMPATIBILITY — Verify package works with a core version
  // ============================================================

  checkCompatibility(packageId: string, coreVersion: string): boolean {
    const pkg = this.packages.get(packageId);
    if (!pkg) return false;

    if (pkg.status === 'removed') return false;
    if (pkg.status === 'deprecated') return false;

    // Parse semver-ish: major.minor.patch
    const parseVersion = (v: string): [number, number, number] => {
      const parts = v.replace(/^v/, '').split('.').map(Number);
      return [
        isNaN(parts[0]) ? 0 : parts[0],
        isNaN(parts[1]) ? 0 : parts[1],
        isNaN(parts[2]) ? 0 : parts[2],
      ];
    };

    const core = parseVersion(coreVersion);
    // Assume package targets core >= 1.0.0 for published packages
    if (core[0] >= 1) return true;

    // For 0.x core versions, check if package is also 0.x
    const pkgVer = parseVersion(pkg.version);
    if (core[0] === 0 && pkgVer[0] === 0) return true;

    return false;
  }

  // ============================================================
  // GET STATS — Aggregate marketplace statistics
  // ============================================================

  getStats(): MarketplaceStats {
    let totalDownloads = 0;
    let totalReviews = 0;
    const categories = new Set<string>();
    const publishers = new Set<string>();

    for (const pkg of this.packages.values()) {
      totalDownloads += pkg.downloads;
      totalReviews += pkg.reviews;
      categories.add(pkg.category);
      publishers.add(pkg.publisher);
    }

    return {
      totalPackages: this.packages.size,
      totalDownloads,
      totalReviews,
      categories: Array.from(categories).sort(),
      publishers: Array.from(publishers).sort(),
    };
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: MarketplaceEngine | undefined;

export function getMarketplaceEngine(): MarketplaceEngine {
  if (!_instance) _instance = new MarketplaceEngine();
  return _instance;
}

export function resetMarketplaceEngine(): void {
  _instance = undefined;
}