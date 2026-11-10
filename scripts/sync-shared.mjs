// Copies the shared rules into the Edge Functions so browser and server can never disagree.
// Run automatically by `npm run build` and the tests; never edit the copies by hand.
import fs from 'node:fs';
const pairs = [
  ['src/lib/pricing.ts', 'supabase/functions/_shared/pricing.ts'],
  ['src/lib/forms/contact.ts', 'supabase/functions/_shared/contact-rules.ts'],
  ['src/features/invoices/model.ts', 'supabase/functions/_shared/invoice-model.ts'],
];
for (const [from, to] of pairs) {
  const src = fs.readFileSync(from, 'utf8');
  fs.writeFileSync(to, `// GENERATED from ${from} by scripts/sync-shared.mjs — do not edit here.\n${src}`);
}
console.log('shared rules synced');
