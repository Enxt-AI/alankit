/**
 * Content Types
 * 
 * TypeScript types for News and Article content matching Prisma models
 */

/**
 * News Article Interface
 * Matches Prisma News model from schema.prisma
 */
export interface News {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Article Key Fact
 * A single label/value row rendered in the article's facts table.
 */
export interface ArticleKeyFact {
  label: string;
  value: string;
}

/**
 * Article FAQ
 * Per-article Q&A, distinct from the stock-scoped `Faq` model.
 */
export interface ArticleFaq {
  id: string;
  articleId: string;
  question: string;
  answer: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Article Interface
 * Matches Prisma Article model from schema.prisma
 */
export interface Article {
  id: string;
  title: string;
  /** Explicit URL slug. Null falls back to slugify(title) in the public app. */
  slug: string | null;
  /** 120-150 word extractable answer shown above the body. */
  summary: string | null;
  content: string;
  imageUrl: string | null;
  category: string | null;
  isActive: boolean;
  keyFacts: ArticleKeyFact[] | null;
  authorName: string | null;
  authorRole: string | null;
  authorBio: string | null;
  reviewedBy: string | null;
  contentReviewedAt: string | null;
  faqs?: ArticleFaq[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Content Item Union Type
 * Enables shared components for both news and articles
 */
export type ContentItem = News | Article;

// ============================================
// Admin DTOs for Content Management
// ============================================

/**
 * DTO for creating news articles (Admin)
 * Mirrors CreateNewsDto from backend
 */
export interface CreateNewsDto {
  title: string;
  content: string;
  imageUrl?: string;
  category?: string;
  isActive?: boolean;
}

/**
 * DTO for updating news articles (Admin)
 * All fields optional for partial updates
 */
export interface UpdateNewsDto {
  title?: string;
  content?: string;
  imageUrl?: string;
  category?: string;
  isActive?: boolean;
}

/**
 * DTO for creating articles (Admin)
 * Mirrors CreateArticleDto from backend
 */
export interface ArticleFaqDto {
  question: string;
  answer: string;
  order?: number;
}

export interface ArticleKeyFactDto {
  label: string;
  value: string;
}

export interface CreateArticleDto {
  title: string;
  content: string;
  imageUrl?: string;
  category?: string;
  isActive?: boolean;
  slug?: string;
  summary?: string;
  keyFacts?: ArticleKeyFactDto[];
  authorName?: string;
  authorRole?: string;
  authorBio?: string;
  reviewedBy?: string;
  contentReviewedAt?: string;
  faqs?: ArticleFaqDto[];
}

/**
 * DTO for updating articles (Admin)
 * All fields optional for partial updates
 */
export interface UpdateArticleDto {
  title?: string;
  content?: string;
  imageUrl?: string;
  category?: string;
  isActive?: boolean;
  slug?: string;
  summary?: string;
  keyFacts?: ArticleKeyFactDto[];
  authorName?: string;
  authorRole?: string;
  authorBio?: string;
  reviewedBy?: string;
  contentReviewedAt?: string;
  faqs?: ArticleFaqDto[];
}

// ============================================
// Static Pages Types
// ============================================

/**
 * Single performance metric for the About Us page stat cards.
 * Each metric displays a label, a value, and a change indicator.
 * Example: { label: "Annual Growth", value: "15%", change: "+3%" }
 */
export interface PerformanceMetric {
  label: string;
  value: string;
  change: string;
}

/**
 * Static Page Interface
 * Matches Prisma StaticPage model from schema.prisma
 */
export interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Performance metrics (About Us page only). Null for other pages. */
  performanceMetrics: PerformanceMetric[] | null;
  isActive: boolean;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for creating static pages (Admin)
 * Mirrors CreateStaticPageDto from backend
 */
export interface CreateStaticPageDto {
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive?: boolean;
  /** Optional performance metrics, up to 4 items (About Us page only). Null clears metrics. */
  performanceMetrics?: PerformanceMetric[] | null;
}

/**
 * DTO for updating static pages (Admin)
 * All fields optional for partial updates
 */
export interface UpdateStaticPageDto {
  slug?: string;
  title?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive?: boolean;
  /** Optional performance metrics, up to 4 items (About Us page only). Null clears metrics. */
  performanceMetrics?: PerformanceMetric[] | null;
}

// ============================================
// Audit and Versioning Types
// ============================================

/**
 * AuditLog Interface
 * Matches Prisma AuditLog model from schema.prisma
 */
export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  changes: Record<string, any>;
  metadata: Record<string, any> | null;
  timestamp: string;
}

/**
 * ContentVersion Interface
 * Matches Prisma ContentVersion model from schema.prisma
 */
export interface ContentVersion {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  content: Record<string, any>;
  changeType: string;
  changeNote: string | null;
  createdById: string;
  createdByEmail: string;
  createdByRole: string;
  createdAt: string;
}

/**
 * AuditLog Filters Interface
 */
export interface AuditLogFilters {
  entity?: string;
  adminId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Version History Filters Interface
 */
export interface VersionHistoryFilters {
  entityType?: string;
  entityId?: string;
  adminId?: string;
  limit?: number;
  offset?: number;
}
