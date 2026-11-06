# @onetaskgraph/ui rules

- The public API is `package.json`'s `exports`: the main entry, `./styles.css` and `./package.json`.
- The manifest names nothing from onepipeline, in any dependency field; `dependency-boundary` fails if it does. The dependency points the other way.
- The current export is a placeholder; a later change replaces it with the task rendering.
