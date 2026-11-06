# @onetaskgraph/ui

React components for showing [onetaskgraph](https://github.com/nickderobertis/onetaskgraph) tasks.
Task bodies come from trackers and agents, so everything here treats them as untrusted.

```sh
npm install @onetaskgraph/ui
```

```tsx
import { TaskCard, TaskSourceLink } from "@onetaskgraph/ui";
import "@onetaskgraph/ui/styles.css";

<TaskCard
  title="Ship it"
  badges={<span>Critical</span>}
  meta="Source: github"
  links={<TaskSourceLink url="https://github.com/o/r/issues/1" label="#1" />}
  actions={<button type="button">Complete</button>}
  body="**Ready** for a decision: https://example.org/plan"
  clamp={4}
/>;
```

## `TaskMarkdown({ source, clamp? })`

Renders GitHub-flavoured markdown. Raw HTML shows as its text and never as HTML. A link keeps its target only for `http`, `https` and `mailto`, and opens in a new tab; any other link, a relative one included, shows as its text. An image is never fetched: it shows as a link to its source under its alt text, or the word `image`, on the same rule.

`clamp` is a number of lines, and never more than that height. A body that fits shows exactly as it does unclamped; a longer one shows the same first lines and ends in an ellipsis. A table in it keeps its rows and cells and is cut above an ellipsis on the last line, which takes measuring in the browser, so a server render with no JavaScript clips such a table without one.

Blocks have no vertical gap between them, clamped or not, which is what keeps those first lines in the same place: headings are bold at the text's size, and a paragraph following a paragraph is indented.

## `TaskSourceLink({ url, label, ...anchor attributes })` and `taskSourceProvider(url)`

A link opening in a new tab, on the same protocol rule, named `Open <provider> issue <label>` unless you pass `aria-label`. `taskSourceProvider` answers `"GitHub"` or `"Linear"` by exact hostname, and `"tracker"` for anything else, an unparsable URL included.

## `TaskCard({ title, body?, badges?, meta?, links?, actions?, clamp?, children?, ...article attributes })`

An `article` labelled by its title heading: badges, title and actions on one row; meta; links; the body through `TaskMarkdown`; then `children`. The actions take their own row when the card is under 560 CSS px wide. That is a container query on the card, so give the card a width from its parent: as an auto-width flex row item it would collapse.

## Styling

`styles.css` classes start `otg-`, and font and colour inherit from the page. Theme with `--otg-accent`, `--otg-border` and `--otg-muted` on any ancestor; each has a default.

`react` and `react-dom` are peer dependencies. Releases and their notes are on the
[releases page](https://github.com/nickderobertis/onetaskgraph-ui/releases).
