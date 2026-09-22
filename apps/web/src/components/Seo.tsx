import { useEffect } from "react";

type SeoProps = {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
};

const updateMeta = (selector: string, content?: string): string | null => {
  if (!content) return null;
  const element = document.querySelector<HTMLMetaElement>(selector);
  if (!element) return null;
  const previous = element.getAttribute("content");
  element.setAttribute("content", content);
  return previous;
};

const updateCanonical = (url?: string): string | null => {
  if (!url) return null;
  const element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) return null;
  const previous = element.getAttribute("href");
  element.setAttribute("href", url);
  return previous;
};

export default function Seo({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogUrl,
  twitterTitle,
  twitterDescription,
}: SeoProps) {
  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;

    const previous = {
      description: updateMeta('meta[name="description"]', description),
      ogTitle: updateMeta('meta[property="og:title"]', ogTitle || title),
      ogDescription: updateMeta(
        'meta[property="og:description"]',
        ogDescription || description,
      ),
      ogUrl: updateMeta('meta[property="og:url"]', ogUrl || canonical),
      twitterTitle: updateMeta('meta[name="twitter:title"]', twitterTitle || title),
      twitterDescription: updateMeta(
        'meta[name="twitter:description"]',
        twitterDescription || description,
      ),
      canonical: updateCanonical(canonical || ogUrl),
    };

    return () => {
      document.title = previousTitle;
      if (previous.description) updateMeta('meta[name="description"]', previous.description);
      if (previous.ogTitle) updateMeta('meta[property="og:title"]', previous.ogTitle);
      if (previous.ogDescription) {
        updateMeta('meta[property="og:description"]', previous.ogDescription);
      }
      if (previous.ogUrl) updateMeta('meta[property="og:url"]', previous.ogUrl);
      if (previous.twitterTitle) {
        updateMeta('meta[name="twitter:title"]', previous.twitterTitle);
      }
      if (previous.twitterDescription) {
        updateMeta('meta[name="twitter:description"]', previous.twitterDescription);
      }
      if (previous.canonical) updateCanonical(previous.canonical);
    };
  }, [
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogUrl,
    twitterTitle,
    twitterDescription,
  ]);

  return null;
}
