import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir:'./tests/e2e',
  timeout:120000,
  workers:1,
  use:{baseURL:'http://127.0.0.1:5173',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'},headless:true},
  webServer:{command:'npm run dev -- --host 127.0.0.1',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
})
