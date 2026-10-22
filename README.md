# Alex Agyei Agyeman

Static portfolio site. It is meant to deploy on Vercel Hobby with no build step: the site root is this folder.

Serve it locally with any static file server (ES modules need HTTP, not `file://`):

```bash
python3 -m http.server 4173
```

Then open http://127.0.0.1:4173/

## Placeholder domain

Canonical, Open Graph, Twitter, JSON-LD, `robots.txt`, and `sitemap.xml` use `https://alex-agyeman.vercel.app/` until Vercel assigns the real URL. Update that host in:

- `index.html`
- `robots.txt`
- `sitemap.xml`

## Privacy

The phone number and home neighborhood from the CV are not published. PDFs are gitignored so the source CV is not committed.

## 3D bundle

`js/scene.bundle.js` is `js/scene.js` bundled with Three.js 0.170.0 (MIT). See the comment at the top of `js/scene.js` for the rebuild command. The license is in `vendor/three.LICENSE`.

Syne, Outfit, and JetBrains Mono are self-hosted under the SIL Open Font License. Copies of the license are in `assets/fonts/`.
