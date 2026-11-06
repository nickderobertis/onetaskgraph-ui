# Install journey

Installs the tarball the build produces into a consumer outside the repository, with npm, the way a user does. It needs the registry for the package's dependencies and peers, and nothing else. Never resolve the package through the workspace here.

`test/browser.test.ts` bundles `fixture/page.jsx` inside that consumer and drives it in Chromium; `install-browser` provisions the browser, with its system packages only under `CI`. Its font has one face on purpose, so bold can only be synthesized, and its screenshot comparisons are between elements of one page, never against stored images.
