import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskPlaceholder } from "../src";

test("shows the task's title as text", () => {
  expect(renderToStaticMarkup(<TaskPlaceholder title="Ship it" />)).toBe(
    '<article class="otg-task">Ship it</article>',
  );
});

test("escapes markup in a title rather than rendering it", () => {
  const markup = renderToStaticMarkup(<TaskPlaceholder title="<script>" />);
  expect(markup).not.toContain("<script>");
  expect(markup).toContain("&lt;script&gt;");
});
