import { Metadata } from 'next';
import { stocksApi } from './api-client';

export interface SeoMetadata {
  id: string;
  path: string;
  metaTitle?: string;
  metaDescription?: string;
  schemaMarkup?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  pageContent?: string;
}

export async function getSeoMetadataByPath(path: string): Promise<SeoMetadata | null> {
  try {
    const response = await stocksApi.get<SeoMetadata>(`/seo-metadata/public?path=${encodeURIComponent(path)}`);
    return response.data || null;
  } catch (error) {
    return null;
  }
}

interface DynamicFallback {
  title?: string;
  description?: string;
  image?: string;
}

export async function constructMetadata(
  path: string,
  dynamicFallback?: DynamicFallback
): Promise<Metadata> {
  const cmsSeo = await getSeoMetadataByPath(path);
  
  if (cmsSeo && (cmsSeo.metaTitle || cmsSeo.metaDescription)) {
    return {
      title: cmsSeo.metaTitle || dynamicFallback?.title || 'UnlistedStox',
      description: cmsSeo.metaDescription || dynamicFallback?.description,
      alternates: {
        canonical: path,
      },
      openGraph: {
        title: cmsSeo.ogTitle || cmsSeo.metaTitle || dynamicFallback?.title || 'UnlistedStox',
        description: cmsSeo.ogDescription || cmsSeo.metaDescription || dynamicFallback?.description,
        images: cmsSeo.ogImage ? [{ url: cmsSeo.ogImage }] : dynamicFallback?.image ? [{ url: dynamicFallback.image }] : undefined,
      },
      twitter: {
        card: (cmsSeo.twitterCard as any) || 'summary_large_image',
        title: cmsSeo.twitterTitle || cmsSeo.metaTitle || dynamicFallback?.title || 'UnlistedStox',
        description: cmsSeo.twitterDescription || cmsSeo.metaDescription || dynamicFallback?.description,
        images: cmsSeo.twitterImage ? [cmsSeo.twitterImage] : dynamicFallback?.image ? [dynamicFallback.image] : undefined,
      }
    };
  }

  if (dynamicFallback) {
    return {
      title: dynamicFallback.title,
      description: dynamicFallback.description,
      alternates: {
        canonical: path,
      },
      openGraph: {
        title: dynamicFallback.title,
        description: dynamicFallback.description,
        images: dynamicFallback.image ? [{ url: dynamicFallback.image }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title: dynamicFallback.title,
        description: dynamicFallback.description,
        images: dynamicFallback.image ? [dynamicFallback.image] : undefined,
      }
    };
  }

  return {
    alternates: {
      canonical: path,
    },
  };
}
