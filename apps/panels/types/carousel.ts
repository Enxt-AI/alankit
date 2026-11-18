/**
 * CarouselMedia type definitions for the CMS panel.
 */

export interface CarouselMedia {
  id: string;
  title: string;
  description?: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF';
  mediaUrl: string;
  thumbnailUrl?: string | null;
  linkUrl?: string | null;
  linkType?: 'STOCK' | 'ARTICLE' | 'NEWS' | 'URL' | 'NONE' | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCarouselMediaDto {
  title?: string;
  description?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'GIF';
  mediaUrl: string;
  thumbnailUrl?: string;
  linkUrl?: string;
  linkType?: 'STOCK' | 'ARTICLE' | 'NEWS' | 'URL' | 'NONE';
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateCarouselMediaDto extends Partial<CreateCarouselMediaDto> {}
