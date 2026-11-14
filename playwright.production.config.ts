import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir:'./tests/production',timeout:120000,workers:1,
  use:{baseURL:process.env.PRODUCTION_URL || 'http://127.0.0.1:4173/metaRemove/',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'},headless:true},
  ...(!process.env.PRODUCTION_URL ? {webServer:{command:'node tests/serve-build.mjs',url:'http://127.0.0.1:4173/metaRemove/',timeout:15000}} : {}),
})
