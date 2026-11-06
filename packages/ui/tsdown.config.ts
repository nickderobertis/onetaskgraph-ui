import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  copy: [{ from: "src/styles.css", to: "dist" }],
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
});
