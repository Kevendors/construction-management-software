import * as React from "react";

/**
 * Descriptions are stored as plain text, so emphasis uses a tiny markdown
 * subset: **wrapped in double asterisks** renders bold. Nothing else is
 * interpreted, and the text is still rendered as text — no HTML is ever parsed
 * out of user input, so there's nothing to inject.
 *
 * Line breaks are preserved by the caller's `whitespace-pre-wrap`, not here.
 */
export function richText(text: string): React.ReactNode {
  if (!text) return null;
  // [\s\S] rather than . so a bold run may span lines; lazy so that
  // "**a** and **b**" yields two runs instead of one.
  const parts = text.split(/(\*\*[\s\S]+?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

/**
 * Wrap a textarea's current selection in ** ** (or unwrap it if already bold).
 * Returns the new value, or null when nothing is selected.
 */
export function toggleBoldInTextarea(el: HTMLTextAreaElement): string | null {
  const { selectionStart: start, selectionEnd: end, value } = el;
  if (start === end) return null;
  const selected = value.slice(start, end);
  if (selected.startsWith("**") && selected.endsWith("**") && selected.length > 4) {
    return value.slice(0, start) + selected.slice(2, -2) + value.slice(end);
  }
  return value.slice(0, start) + "**" + selected + "**" + value.slice(end);
}
