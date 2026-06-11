// Electron Node (test:integration) uses resources/better_sqlite3.node; plain Node skips custom binding.
if (!process.versions.electron) {
  process.env.AV_TEST_SKIP_CUSTOM_SQLITE = '1'
}
