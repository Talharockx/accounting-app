/**
 * True when editor HTML has no visible text (e.g. empty Quill `<p><br></p>`).
 * Safe to use on the server (no DOM).
 */
export function isEffectivelyBlankRichText(html: string | null | undefined): boolean {
  if (html == null || typeof html !== "string") return true;
  const noTags = html.replace(/<[^>]*>/g, " ");
  const decoded = noTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/\u00a0/g, " ");
  return decoded.trim().length === 0;
}

/** Plain or legacy HTML body — treat as empty when there is no visible text. */
export function isBlankNote(s: string | null | undefined): boolean {
  return isEffectivelyBlankRichText(s);
}

/** Turn stored note body into plain text for read-only lists (legacy rich-text rows). */
export function noteToPlainText(body: string): string {
  let t = body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<\/p>/gi, "\n");
  t = t.replace(/<p[^>]*>/gi, "");
  t = t.replace(/<[^>]+>/g, "");
  return t
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}
