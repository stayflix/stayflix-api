module.exports = {
  apps: [
    {
      name: 'stayflix-api',
      script: 'dist/main.js',

      // ── Process settings ─────────────────────────────────────────────
      instances: 1,          // increase to 'max' to use all CPU cores (cluster mode)
      exec_mode: 'fork',     // use 'cluster' if instances > 1

      // ── Auto-restart ──────────────────────────────────────────────────
      watch: false,
      max_memory_restart: '512M',

      // ── Logging ───────────────────────────────────────────────────────
      out_file: '/var/log/stayflix-api/out.log',
      error_file: '/var/log/stayflix-api/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ── Environment ───────────────────────────────────────────────────
      // PM2 reads env vars from the OS environment (loaded from .env by
      // your shell profile or via dotenv in app). You can also hardcode
      // non-secret values here under env_production below.
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
