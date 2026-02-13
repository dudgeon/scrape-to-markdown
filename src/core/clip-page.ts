import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export interface ClipResult {
  markdown: string;
  title: string;
  byline?: string;
  siteName?: string;
  excerpt?: string;
}

export interface PageData {
  html: string;
  url: string;
  title: string;
  selectedHtml?: string;
}

/**
 * Extract article content from raw page HTML and convert to markdown.
 * Runs in any context with DOM API (popup, content script, etc.).
 */
export function clipPage(data: PageData): ClipResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(data.html, 'text/html');

  // Fix relative URLs by setting the document base
  const base = doc.createElement('base');
  base.href = data.url;
  doc.head.prepend(base);

  const td = createTurndownService();

  // If user selected text, clip that instead of running Readability
  if (data.selectedHtml) {
    const markdown = td.turndown(data.selectedHtml);
    return { markdown, title: data.title };
  }

  const article = new Readability(doc).parse();

  if (!article || !article.content) {
    // Fallback: convert the full body
    const markdown = td.turndown(doc.body);
    return { markdown, title: data.title };
  }

  return {
    markdown: td.turndown(article.content),
    title: article.title || data.title,
    byline: article.byline || undefined,
    siteName: article.siteName || undefined,
    excerpt: article.excerpt || undefined,
  };
}

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
  });
  td.use(gfm);

  // --- Custom rules ---

  // <figure> with <figcaption>: render as image + italic caption
  td.addRule('figure', {
    filter: 'figure',
    replacement(_content, node) {
      const el = node as HTMLElement;
      const img = el.querySelector('img');
      const caption = el.querySelector('figcaption');
      const alt = img?.getAttribute('alt') || '';
      const src = img?.getAttribute('src') || '';
      const captionText = caption?.textContent?.trim() || '';

      let md = src ? `![${alt}](${src})` : '';
      if (captionText) {
        md += `\n_${captionText}_`;
      }
      return md ? `\n\n${md}\n\n` : '';
    },
  });

  // <video> and <source>: render as a link to the video
  td.addRule('video', {
    filter: 'video',
    replacement(_content, node) {
      const el = node as HTMLVideoElement;
      const src = el.src || el.querySelector('source')?.getAttribute('src') || '';
      const poster = el.getAttribute('poster');
      if (!src) return '';
      const label = poster ? `![Video](${poster})` : 'Video';
      return `\n\n[${label}](${src})\n\n`;
    },
  });

  // <iframe> (YouTube, Vimeo, etc.): render as a link
  td.addRule('iframe', {
    filter: 'iframe',
    replacement(_content, node) {
      const el = node as HTMLIFrameElement;
      const src = el.src || '';
      if (!src) return '';
      const title = el.title || 'Embedded content';
      return `\n\n[${title}](${src})\n\n`;
    },
  });

  return td;
}
