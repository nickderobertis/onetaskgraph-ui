import type { CSSProperties, ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkableUrl, NEW_TAB_ATTRIBUTES } from "./safe-url";

export type TaskMarkdownProps = {
  /** Untrusted GitHub-flavoured markdown. */
  source: string;
  /** The number of lines to show, ending in an ellipsis when there are more. */
  clamp?: number;
};

type HastNode = {
  type: string;
  tagName?: string;
  children?: HastNode[];
  properties?: { alt?: unknown };
  value?: string;
};

/** Turns each image below a link into its alt text, since a link cannot hold another link. */
function imagesToText(node: HastNode): HastNode {
  if (node.tagName === "img") {
    return { type: "text", value: String(node.properties?.alt || "image") };
  }
  if (node.children) node.children = node.children.map(imagesToText);
  return node;
}

/** An image shows as a link to its source, so one already inside a link becomes that link's text. */
function rehypeFlattenLinkedImages() {
  const visit = (node: HastNode) => {
    if (node.tagName === "a") imagesToText(node);
    else node.children?.forEach(visit);
  };
  return visit;
}

function Link({ href, children }: { href: string | undefined; children: ReactNode }) {
  const target = linkableUrl(href);
  // With no target it stays an `a` with no href: HTML's placeholder for where a link would be.
  return (
    <a href={target} {...(target === undefined ? {} : NEW_TAB_ATTRIBUTES)}>
      {children}
    </a>
  );
}

const COMPONENTS: Components = {
  a: ({ href, children }) => <Link href={href}>{children}</Link>,
  // Rendering an img would fetch it, which tells whoever wrote the body who read it and when.
  img: ({ src, alt }) => (
    <Link href={typeof src === "string" ? src : undefined}>{alt || "image"}</Link>
  ),
};
const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeFlattenLinkedImages];

/**
 * Renders a task's markdown. Raw HTML in `source` shows as its text and never as HTML, a link or
 * image keeps its target only for http, https and mailto, and an image is never fetched.
 */
export function TaskMarkdown({ source, clamp }: TaskMarkdownProps) {
  const clamped = clamp !== undefined && Number.isInteger(clamp) && clamp > 0;
  const style: CSSProperties | undefined = clamped ? { WebkitLineClamp: clamp } : undefined;
  return (
    <div className={clamped ? "otg-markdown otg-markdown--clamped" : "otg-markdown"} style={style}>
      <Markdown
        components={COMPONENTS}
        rehypePlugins={REHYPE_PLUGINS}
        remarkPlugins={REMARK_PLUGINS}
      >
        {source}
      </Markdown>
    </div>
  );
}
