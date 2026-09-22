import type { Metadata } from 'next';

export const SITE_NAME = 'Devvelocity';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://devvelocity.in').replace(
  /\/$/,
  '',
);
export const DEFAULT_TITLE = 'Modern Software Products & Digital Solutions | Devvelocity';
export const DEFAULT_DESCRIPTION =
  'Devvelocity builds modern software products, cloud platforms and digital solutions for organisations ready to simplify work and grow.';
// Keep the social card crawler-friendly: WhatsApp and other unfurl bots are
// substantially more reliable with a lightweight 1200x630 JPEG than a large
// source PNG. The versioned filename also invalidates previously cached cards.
export const SOCIAL_IMAGE_PATH = '/images/devvelocity-social-preview.jpg';
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

interface ISeoMetadataOptions {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  imagePath?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export function createSeoMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
  imagePath = SOCIAL_IMAGE_PATH,
  imageAlt = 'Devvelocity modern software products and digital solutions',
  imageWidth = SOCIAL_IMAGE_WIDTH,
  imageHeight = SOCIAL_IMAGE_HEIGHT,
}: ISeoMetadataOptions): Metadata {
  const canonicalPath = path === '/' ? '/' : path.replace(/\/$/, '');
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalPath,
      languages: { 'en-IN': canonicalPath, 'x-default': canonicalPath },
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    openGraph: {
      type: 'website',
      locale: 'en_IN',
      url: canonicalUrl,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: imagePath,
          width: imageWidth,
          height: imageHeight,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imagePath],
    },
  };
}

export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
