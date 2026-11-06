import { expect, mock, test } from "bun:test";
import { act } from "react";
import { TaskCard } from "../src";
import { only, render } from "./render";

function fullCard(extra: object = {}) {
  return render(
    <TaskCard
      title="The title"
      body="**The body**"
      badges={<span id="badges">B</span>}
      meta={<span id="meta">M</span>}
      links={<span id="links">L</span>}
      actions={<button type="button">A</button>}
      {...extra}
    >
      <p id="children">C</p>
    </TaskCard>,
  );
}

test("every slot renders in the stated order", () => {
  const view = fullCard();
  const order = [...view.querySelectorAll("#badges, h3, button, #meta, #links, strong, #children")];
  expect(order.map((element) => element.textContent)).toEqual([
    "B",
    "The title",
    "A",
    "M",
    "L",
    "The body",
    "C",
  ]);
});

test("badges, title and actions share one row container", () => {
  const header = only(fullCard(), ".otg-card__header");
  expect(only(header, "#badges").textContent).toBe("B");
  expect(only(header, "h3").textContent).toBe("The title");
  expect(only(header, "button").textContent).toBe("A");
  expect(header.querySelector("#meta")).toBeNull();
});

test("the article is labelled by its title heading", () => {
  const view = fullCard();
  const article = only(view, "article");
  const heading = only(view, "h3");
  expect(heading.id).not.toBe("");
  expect(article.getAttribute("aria-labelledby")).toBe(heading.id);
  expect(document.getElementById(heading.id)?.textContent).toBe("The title");
});

test("two cards on a page are each labelled by their own title", () => {
  const view = render(
    <>
      <TaskCard title="First" />
      <TaskCard title="Second" />
    </>,
  );
  const names = [...view.querySelectorAll("article")].map(
    (article) =>
      document.getElementById(article.getAttribute("aria-labelledby") ?? "")?.textContent,
  );
  expect(names).toEqual(["First", "Second"]);
});

test("passed attributes reach the article and do not replace its own class", () => {
  const onClick = mock(() => {});
  const article = only(fullCard({ className: "mine", "data-task": "T-1", onClick }), "article");
  expect(article.classList.contains("mine")).toBe(true);
  expect(article.classList.contains("otg-card")).toBe(true);
  expect(article.getAttribute("data-task")).toBe("T-1");
  expect(article.hasAttribute("title")).toBe(false);
  act(() => article.click());
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("the body goes through TaskMarkdown with the clamp", () => {
  const root = only(fullCard({ clamp: 3 }), ".otg-markdown");
  expect(root.classList.contains("otg-markdown--clamped")).toBe(true);
  expect(only(root, "strong").textContent).toBe("The body");
});

test("a title alone renders no empty slot", () => {
  const view = render(<TaskCard title="Only" />);
  expect(view.querySelector(".otg-card__badges, .otg-card__actions")).toBeNull();
  expect(view.querySelector(".otg-card__meta, .otg-card__links, .otg-markdown")).toBeNull();
});
