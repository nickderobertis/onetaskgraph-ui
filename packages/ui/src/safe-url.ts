const LINKABLE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** The url as a browser would parse it, or undefined when it has no protocol of its own. */
export function parseAbsoluteUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/**
 * The url when a browser following it would stay on a linkable protocol, otherwise undefined.
 * It parses as the browser will, so case, tabs and newlines in a scheme cannot disguise one, and a
 * relative url, which has no protocol of its own to judge, is refused along with everything else.
 */
export function linkableUrl(url: string | undefined): string | undefined {
  const protocol = url === undefined ? undefined : parseAbsoluteUrl(url)?.protocol;
  return protocol !== undefined && LINKABLE_PROTOCOLS.has(protocol) ? url : undefined;
}

/** Opens in a new tab, leaving the opened page no handle on this one and no referrer. */
export const NEW_TAB_ATTRIBUTES = { target: "_blank", rel: "noopener noreferrer" } as const;
