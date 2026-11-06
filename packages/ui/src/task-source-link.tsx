import type { AnchorHTMLAttributes } from "react";
import { linkableUrl, NEW_TAB_ATTRIBUTES, parseAbsoluteUrl } from "./safe-url";

export type TaskSourceProvider = "GitHub" | "Linear" | "tracker";

const PROVIDERS_BY_HOSTNAME = new Map<string, TaskSourceProvider>([
  ["github.com", "GitHub"],
  ["linear.app", "Linear"],
]);

/** The tracker a task's url belongs to, by exact hostname: a url merely naming one is `tracker`. */
export function taskSourceProvider(url: string): TaskSourceProvider {
  return PROVIDERS_BY_HOSTNAME.get(parseAbsoluteUrl(url)?.hostname ?? "") ?? "tracker";
}

export type TaskSourceLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "target" | "rel" | "children"
> & {
  /** Where the task lives; it becomes the `href` only for http, https and mailto. */
  url: string;
  /** The task's id at its source, shown as the link's text. */
  label: string;
};

/** A link out to the tracker a task came from, opening in a new tab. */
export function TaskSourceLink({ url, label, ...anchorAttributes }: TaskSourceLinkProps) {
  const href = linkableUrl(url);
  return (
    <a
      aria-label={`Open ${taskSourceProvider(url)} issue ${label}`}
      {...anchorAttributes}
      href={href}
      {...NEW_TAB_ATTRIBUTES}
      className={["otg-source-link", anchorAttributes.className].filter(Boolean).join(" ")}
    >
      {label}
    </a>
  );
}
