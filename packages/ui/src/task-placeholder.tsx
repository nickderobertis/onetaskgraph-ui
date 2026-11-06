export type TaskPlaceholderProps = {
  /** The task's title, shown as plain text. */
  title: string;
};

/** Holds the package's public shape until the task rendering lands. */
export function TaskPlaceholder({ title }: TaskPlaceholderProps) {
  return <article className="otg-task">{title}</article>;
}
