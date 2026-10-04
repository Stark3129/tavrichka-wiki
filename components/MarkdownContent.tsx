'use client';

import React from 'react';

/** Renders inline formatting: **bold**, *italic*, `code`. */
function renderInline(text: string): React.ReactNode[] {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-semibold text-[var(--text)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 text-xs font-mono text-cyan-600 dark:text-cyan-400"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function MarkdownContent({
  content,
  className = '',
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;

  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let paragraphLines: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      elements.push(
        <div key={`p-${elements.length}`} className="my-1.5 leading-relaxed">
          {paragraphLines.map((line, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <br />}
              {renderInline(line)}
            </React.Fragment>
          ))}
        </div>
      );
      paragraphLines = [];
    }
  }

  function flushList() {
    if (currentList) {
      const { type, items } = currentList;
      if (type === 'ul') {
        elements.push(
          <ul
            key={`ul-${elements.length}`}
            className="my-1.5 list-disc pl-5 space-y-0.5 leading-relaxed"
          >
            {items.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol
            key={`ol-${elements.length}`}
            className="my-1.5 list-decimal pl-5 space-y-0.5 leading-relaxed"
          >
            {items.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h4
          key={`h4-${elements.length}`}
          className="mt-2.5 mb-1 text-sm font-bold text-[var(--text)]"
        >
          {renderInline(line.slice(4))}
        </h4>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h3
          key={`h3-${elements.length}`}
          className="mt-3 mb-1 text-base font-bold text-[var(--text)]"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h2
          key={`h2-${elements.length}`}
          className="mt-3 mb-1 text-lg font-bold text-[var(--text)]"
        >
          {renderInline(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (currentList && currentList.type !== 'ul') flushList();
      if (!currentList) currentList = { type: 'ul', items: [] };
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (currentList && currentList.type !== 'ol') flushList();
      if (!currentList) currentList = { type: 'ol', items: [] };
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Regular text line
    flushList();
    paragraphLines.push(rawLine);
  }

  flushParagraph();
  flushList();

  return <div className={className}>{elements}</div>;
}
