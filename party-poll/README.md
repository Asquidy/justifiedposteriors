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

The app runs on Cloudflare Workers (worker name `party-poll`) with a D1 database (`party-poll`, bound as `DB`) for live responses. The binding lives in `vite.config.ts`.

To deploy:

```bash
npm run build
npx wrangler deploy -c dist/server/wrangler.json
```

Requires Wrangler credentials with Workers Scripts and D1 permissions. Apply schema changes with `npx wrangler d1 execute party-poll --remote --file drizzle/<migration>.sql` (the API also creates the table on first use).

The parent repository's Jekyll podcast site is independent of this subfolder.
