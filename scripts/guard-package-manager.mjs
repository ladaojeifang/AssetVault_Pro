/**
 * Block npm/yarn in this repo — they fight pnpm on Windows (EBUSY on electron).
 * Use: pnpm install
 */
const execpath = process.env.npm_execpath ?? ''
if (!execpath.replace(/\\/g, '/').includes('pnpm')) {
  console.error(`
[AssetVault Pro] Use pnpm only (not npm).

  pnpm install
  pnpm run dev

If install fails with EBUSY/EPERM on electron:
  1. Close AssetVault and all "pnpm dev" terminals
  2. Close Cursor (or run the next step in an external PowerShell)
  3. pnpm run clean:install

See scripts/clean-install.ps1
`)
  process.exit(1)
}
