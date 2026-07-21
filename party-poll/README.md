# The Party Poll

An audience poll for Justified Posteriors events. Guests enter a name, can add a selfie, answer four questions about the economics of AI, and see the room's answers update in the projector view.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server. Use **Open projector view** for the display screen.

## Validation

```bash
npm run build
```

## Hosting

The app targets Cloudflare Workers through vinext and uses D1 for live responses. `.openai/hosting.json` contains the existing Sites project and logical D1 binding. Publishing through a different Cloudflare account requires a successful Wrangler login and a D1 binding named `DB`.

The parent repository's Jekyll podcast site is independent of this subfolder.
