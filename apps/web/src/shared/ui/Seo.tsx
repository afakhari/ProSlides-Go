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

type AttributeSnapshot = {
  element: Element;
  name: string;
  value: string | null;
};

const setAttribute = (
  selector: string,
  name: string,
  value?: string,
): AttributeSnapshot | null => {
  if (!value) return null;
  const element = document.querySelector(selector);
  if (!element) return null;

  const snapshot: AttributeSnapshot = {
    element,
    name,
    value: element.getAttribute(name),
  };
  element.setAttribute(name, value);
  return snapshot;
};

const restoreAttribute = (snapshot: AttributeSnapshot | null) => {
  if (!snapshot) return;
  if (snapshot.value === null) {
    snapshot.element.removeAttribute(snapshot.name);
    return;
  }
  snapshot.element.setAttribute(snapshot.name, snapshot.value);
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

    const snapshots = [
      setAttribute('meta[name="description"]', "content", description),
      setAttribute('meta[property="og:title"]', "content", ogTitle || title),
      setAttribute(
        'meta[property="og:description"]',
        "content",
        ogDescription || description,
      ),
      setAttribute(
        'meta[property="og:url"]',
        "content",
        ogUrl || canonical,
      ),
      setAttribute(
        'meta[name="twitter:title"]',
        "content",
        twitterTitle || title,
      ),
      setAttribute(
        'meta[name="twitter:description"]',
        "content",
        twitterDescription || description,
      ),
      setAttribute(
        'link[rel="canonical"]',
        "href",
        canonical || ogUrl,
      ),
    ];

    return () => {
      document.title = previousTitle;
      snapshots.forEach(restoreAttribute);
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
