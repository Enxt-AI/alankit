/**
 * FAQ Types
 *
 * TypeScript interfaces for FAQ data structures based on backend API response
 */

export interface Faq {
  id: string;
  title: string;
  answer: string;
  category: 'Investing' | 'Support' | 'General';
  isActive: boolean;
  stockId?: string | null;
  stock?: {
    id: string;
    name: string;
    cin?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export type FaqCategory = 'Investing' | 'Support' | 'General';

export interface CreateFaqDto {
  title: string;
  answer: string;
  category: FaqCategory;
  isActive?: boolean;
  stockId?: string | null;
}

export interface UpdateFaqDto extends Partial<CreateFaqDto> {}