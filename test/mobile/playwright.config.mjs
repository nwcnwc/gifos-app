import { defineConfig, devices } from '@playwright/test';

const pixel = devices['Pixel 7'];

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8765',
    hasTouch: true,
    isMobile: true,
    defaultBrowserType: 'chromium',
  },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    cwd: '../..',
    port: 8765,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'iphone-se', use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' } },
    { name: 'iphone-15', use: { ...devices['iPhone 15'], defaultBrowserType: 'chromium' } },
    { name: 'pixel-7', use: { ...pixel, defaultBrowserType: 'chromium' } },
    {
      name: 'android-360',
      use: {
        ...pixel,
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 2,
        userAgent: pixel.userAgent,
        defaultBrowserType: 'chromium',
      },
    },
  ],
});
