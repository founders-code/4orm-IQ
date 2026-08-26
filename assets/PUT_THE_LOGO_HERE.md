# assets/logo.png

`index.html` looks for **`assets/logo.png?v=20260826`** in the navigation bar.

That file is deliberately **not** in this repository. Copy the real 4orm logo
into this folder as `logo.png` and it appears. Nothing else needs changing.

If the file is missing the page does not break and does not show a placeholder:
the brand element removes itself and the nav renders with links only. That is on
purpose. A generated, traced or recoloured stand-in for a brand mark is worse
than no mark at all, so the page will never draw one.

## Cache

`/assets/*` is served one year immutable by `vercel.json`. When you replace the
logo, bump the `?v=` date in `index.html` or browsers keep serving the old file.
