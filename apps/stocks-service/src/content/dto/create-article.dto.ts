import { IsString, IsOptional, IsBoolean, IsArray, IsInt, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

export class ArticleFaqDto {
  @IsString()
  @MaxLength(300)
  question: string;

  @IsString()
  @Transform(({ value }) => DOMPurify.sanitize(value))
  answer: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class CreateArticleDto {
  @IsString()
  // Colon, ampersand and parentheses are common in real headlines
  // ("Q&A: ...", "Pre-IPO (Unlisted) Shares") and were previously rejected.
  @Matches(/^[a-zA-Z0-9\s.,!?'"’\-:&()]+$/, { message: 'Title contains invalid characters' })
  title: string;

  @IsString()
  @Transform(({ value }) => DOMPurify.sanitize(value))
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  stockId?: string;

  // ---- SEO / answer-engine fields ----

  /**
   * URL slug. Optional: when omitted the service derives one from the title.
   * Lowercase alphanumerics separated by single hyphens.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers and single hyphens',
  })
  slug?: string;

  /** 120-150 word extractable answer shown above the article body. */
  @IsOptional()
  @IsString()
  summary?: string;

  /** [{ label, value }] rendered as the key-facts table. */
  @IsOptional()
  @IsArray()
  keyFacts?: Array<{ label: string; value: string }>;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  authorRole?: string;

  @IsOptional()
  @IsString()
  authorBio?: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;

  /** ISO date the copy was last reviewed (drives schema.org dateModified). */
  @IsOptional()
  @IsString()
  contentReviewedAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArticleFaqDto)
  faqs?: ArticleFaqDto[];
}
