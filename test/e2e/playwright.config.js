const path = require('path');

module.exports = {
  testDir: __dirname,
  testMatch: '*.spec.js',
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:8765',
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    cwd: path.join(__dirname, '../..'),
    port: 8765,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
};
