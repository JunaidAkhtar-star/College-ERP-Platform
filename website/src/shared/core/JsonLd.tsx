import { serializeJsonLd } from '@/shared/utils/seo';

interface IJsonLdProps {
  data: object;
}

/** Safely renders schema.org data for search-engine rich results. */
export default function JsonLd({ data }: IJsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
