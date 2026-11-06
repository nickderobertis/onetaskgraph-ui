// The page the browser journey drives. The journey copies this into its outside consumer and
// bundles it there, so these imports resolve only to the tarball npm installed.
import { TaskCard, TaskMarkdown, TaskSourceLink } from "@onetaskgraph/ui";
import "@onetaskgraph/ui/styles.css";
import { createRoot } from "react-dom/client";

const LONG_URL = `https://github.com/nickderobertis/onetaskgraph-ui/issues/42?${"trail=unbroken-".repeat(14)}end`;

// One paragraph, so its lines are the same distance apart clamped and unclamped.
const LONG_PARAGRAPH =
  "The rollout reached every region overnight and nothing in the error budget moved, but the " +
  "operator who approves the next stage asked whether the retention window applies to archived " +
  "runs as well as live ones, and the design says nothing about that. Until somebody decides, " +
  "the migration keeps both copies, which costs storage in each region and leaves the old " +
  "reader in place for another release, so the decision has a price that grows by the week and " +
  "an owner who has not yet been named anywhere in the plan or its follow-ups.";

const SHORT_PARAGRAPH = "Two short sentences. They fit well inside four lines.";

const SHORT_BLOCKS = "One short paragraph.\n\nAnother after it.";

const SHORT_TABLE = "| Region | State |\n| --- | --- |\n| us-east | done |";

/** A paragraph of exactly this many lines, whatever the width. */
const HARD_LINES = (count) =>
  Array.from({ length: count }, (_, line) => `Line ${line + 1}`).join("  \n");

const RICH_BODY = `# A heading larger than the text

A paragraph with \`inline code\`.

---

\`\`\`
block code
\`\`\`

- A list item
- Another list item

A last paragraph.`;

const MIXED_BODY = `Decide how the **rollout** continues, per [the plan](https://example.org/plan).

- Keep the old reader for one more release
- Drop the archive copy once every region has moved
- Tell the operators before the window closes

A final paragraph nobody reaches when the card is clamped to four lines.`;

const TABLE_BODY = `| Region | State | Owner |
| --- | --- | --- |
| us-east | done | ana |
| eu-west | done | ben |
| ap-south | waiting | cam |
| us-west | waiting | dee |
| sa-east | waiting | eli |
| af-south | waiting | fay |
| me-central | waiting | gus |
| ca-central | waiting | hal |`;

const WORKLOAD = [
  {
    title: "Approve the rollout design for the retention window",
    meta: "Source: github · blocks 3 runs",
    body: `The design is ready for a decision.\n\n- Keep archived runs for 30 days\n- Drop them after the window closes\n- Tell the operators first\n\nSee ${LONG_URL} for the thread.`,
  },
  {
    title: `A title long enough to wrap several times over in a narrow card because ${"nobody-stopped-to-break-this-".repeat(6)}heading`,
    meta: "Source: linear · waiting 2 days",
    body: "**Bold** words, `inline code` and ~~struck~~ words sit in one short paragraph.",
  },
  {
    title: "Rotate the tracker credential",
    meta: `A long meta line naming ${"every-source-this-task-was-synced-from-".repeat(6)}and more, then wrapping on spaces as well as it can`,
    body: `Bare URL on its own line:\n\n${LONG_URL}`,
  },
  {
    title: "Review the failed node",
    meta: "Source: tracker",
    clamp: 4,
    body: `${LONG_PARAGRAPH}\n\n- The list after it\n- Stays out of view`,
  },
  {
    title: "Fill in the migration table",
    meta: "Source: github",
    body: `${TABLE_BODY}\n\n\`\`\`\nconst unbrokenLine = "${"abcdefghij".repeat(30)}";\n\`\`\``,
  },
  {
    title: "Tick off the launch checklist",
    meta: "Source: linear",
    clamp: 4,
    body: `- [x] Announce the window\n- [ ] Move the last region\n- [ ] Delete the archive copy\n- [ ] Close ${LONG_URL}\n- [ ] Write it up`,
  },
];

function CardSlots({ id, ...card }) {
  return (
    <TaskCard
      badges={<span data-slot="badges">Critical</span>}
      actions={
        <span data-slot="actions">
          <button type="button">Complete</button> <button type="button">Dismiss</button>
        </span>
      }
      links={<TaskSourceLink url="https://github.com/o/r/issues/42" label={`#${id}`} />}
      data-card={id}
      {...card}
    />
  );
}

function Section({ name, width, children }) {
  return (
    <section data-section={name} style={width ? { width: `${width}px` } : undefined}>
      {children}
    </section>
  );
}

function Rendering({ name, source, clamp, style }) {
  return (
    <div data-rendering={name} style={style}>
      <TaskMarkdown source={source} {...(clamp ? { clamp } : {})} />
    </div>
  );
}

/** The same body clamped to four lines and whole, for the journey to compare. */
function Pair({ name, source, style }) {
  return (
    <>
      <Rendering name={`${name}-clamped`} source={source} clamp={4} style={style} />
      <Rendering name={`${name}-unclamped`} source={source} style={style} />
    </>
  );
}

function App() {
  return (
    <main>
      <Section name="workload">
        {WORKLOAD.map((card, index) => (
          <CardSlots key={card.title} id={`workload-${index}`} {...card} />
        ))}
      </Section>
      <Section name="widths">
        {[800, 560, 559, 400].map((width) => (
          <div key={width} style={{ width: `${width}px` }}>
            <CardSlots id={`width-${width}`} title={`A card ${width} wide`} body="A short body." />
          </div>
        ))}
      </Section>
      <Section name="clamp" width={480}>
        <Pair name="long" source={LONG_PARAGRAPH} />
        <Pair name="short" source={SHORT_PARAGRAPH} />
        <Pair name="blocks" source={SHORT_BLOCKS} />
        {/* Above the tables: their rows have fractional heights, and a bullet painted at a fractional
            position antialiases differently, which would pass for a fourth line that differs. */}
        <Pair name="rich" source={RICH_BODY} style={{ lineHeight: 1.5 }} />
        <Pair name="short-table" source={SHORT_TABLE} />
        <Pair name="mixed" source={MIXED_BODY} />
        <Pair name="table" source={TABLE_BODY} />
        <Pair name="text-then-table" source={`A line before the table.\n\n${TABLE_BODY}`} />
        <Pair name="long-then-table" source={`${LONG_PARAGRAPH}\n\n${TABLE_BODY}`} />
        <Pair name="four-then-table" source={`${HARD_LINES(4)}\n\n${TABLE_BODY}`} />
        <Pair name="three-then-table" source={`${HARD_LINES(3)}\n\n${TABLE_BODY}`} />
        <Pair name="four-blocks" source={"One.\n\nTwo.\n\nThree.\n\nFour."} />
        <Rendering name="bold" source="**The same words**" />
        <Rendering name="regular" source="The same words" />
        <Rendering
          name="untrusted"
          source={`<script>window.pwned = "script"</script>

<img src="/remote/raw.png" onerror="window.pwned = 'onerror'">

<a href="#" onclick="window.pwned = 'onclick'">inline onclick</a>

![tracking pixel](${window.location.origin}/remote/markdown.png)

[![badge](${window.location.origin}/remote/linked.png)](https://example.org/linked)`}
        />
      </Section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
