KaTeX 0.19.0, distributed under the included MIT license.

These files are copied without modification from the pinned npm package.
The renderer, stylesheet, and fonts are served locally with the site.

To refresh them after changing the pinned package version:

```sh
npm ci
npm run vendor:katex
```

Update `KATEX_VERSION` in `js/bench.js` at the same time; it loads these files
and is the `?v=` cache-buster for them.
See [KaTeX documentation](https://katex.org/docs/options) for renderer options.
