-- Article SEO / answer-engine fields.
--
-- `slug` is nullable on purpose: existing articles keep working, and the web
-- layer falls back to slugify(title) when it is null. New articles get an
-- explicit slug from the CMS.
ALTER TABLE "Article" ADD COLUMN     "authorBio" TEXT,
ADD COLUMN     "authorName" TEXT,
ADD COLUMN     "authorRole" TEXT,
ADD COLUMN     "contentReviewedAt" TIMESTAMP(3),
ADD COLUMN     "keyFacts" JSONB,
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "summary" TEXT;

-- Per-article Q&A. Separate from `Faq`, which is stock-scoped.
CREATE TABLE "ArticleFaq" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleFaq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleFaq_articleId_idx" ON "ArticleFaq"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- AddForeignKey
ALTER TABLE "ArticleFaq" ADD CONSTRAINT "ArticleFaq_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
