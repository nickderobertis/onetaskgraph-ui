# @onetaskgraph/ui rules

- The public API is `package.json`'s `exports`: the main entry, `./styles.css` and `./package.json`.
- The manifest names nothing from onepipeline, in any dependency field; `dependency-boundary` fails if it does. The dependency points the other way.
- Run, node and queue concerns stay out: nothing here knows what a human item is.
- `src/safe-url.ts` is the one protocol decision; every link and image goes through it.
- Exported props are a contract `onepipeline-ui` typechecks against: a departure is agreed with that consumer, not made here alone.
- CSS layout and clamping are proved in `ui-install-e2e`'s browser journey; the tests here see no layout.
