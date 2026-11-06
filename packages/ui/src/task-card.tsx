import { type HTMLAttributes, type ReactNode, useId } from "react";
import { TaskMarkdown } from "./task-markdown";

export type TaskCardProps = Omit<HTMLAttributes<HTMLElement>, "title" | "children"> & {
  title: ReactNode;
  /** Untrusted markdown, rendered through `TaskMarkdown`. */
  body?: string;
  badges?: ReactNode;
  meta?: ReactNode;
  links?: ReactNode;
  actions?: ReactNode;
  /** The number of body lines to show. */
  clamp?: number;
  children?: ReactNode;
};

/** A task as an `article` labelled by its title, whose actions follow the card's own width. */
export function TaskCard({
  title,
  body,
  badges,
  meta,
  links,
  actions,
  clamp,
  children,
  className,
  ...articleAttributes
}: TaskCardProps) {
  const titleId = useId();
  return (
    <article
      {...articleAttributes}
      aria-labelledby={titleId}
      className={className ? `otg-card ${className}` : "otg-card"}
    >
      <div className="otg-card__surface">
        <div className="otg-card__header">
          {badges != null && <div className="otg-card__badges">{badges}</div>}
          <h3 className="otg-card__title" id={titleId}>
            {title}
          </h3>
          {actions != null && <div className="otg-card__actions">{actions}</div>}
        </div>
        {meta != null && <div className="otg-card__meta">{meta}</div>}
        {links != null && <div className="otg-card__links">{links}</div>}
        {body ? <TaskMarkdown source={body} {...(clamp === undefined ? {} : { clamp })} /> : null}
        {children}
      </div>
    </article>
  );
}
