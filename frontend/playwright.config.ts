import { defineConfig } from "@playwright/test";

const api = "http://127.0.0.1:4400";
const externalFrontend = process.env.BILLKU_TEST_BASE_URL;
const frontend = externalFrontend || "http://127.0.0.1:4401";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: frontend, serviceWorkers: "block" },
  webServer: externalFrontend ? undefined : [
    {
      name: "BillKu API",
      cwd: "..",
      command: "npx --no-install prisma db push --skip-generate && node prisma/seed-currencies.js && node dist/src/main.js",
      env: { PORT: "4400", NODE_ENV: "test", COOKIE_SECURE: "false" },
      url: `${api}/health`,
    },
    {
      name: "BillKu web",
      command: "npm run dev -- --hostname 127.0.0.1 --port 4401",
      env: { BACKEND_URL: api, NEXT_PUBLIC_API_URL: "/api/v1" },
      url: `${frontend}/register`,
    },
  ],
});
