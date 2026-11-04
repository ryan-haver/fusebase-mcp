import { chromium, type Browser } from "playwright";

/** Launch before publishing so a missing browser cannot turn a deployment into an unverifiable release. */
export async function openVerificationBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function verifyDashboardBrowser(browser: Browser, url: string, sourceHash: string): Promise<void> {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    if (!response?.ok()) throw new Error(`Dashboard returned HTTP ${response?.status() ?? "no response"}`);
    await page.getByRole("heading", { name: "FuseBase MCP", exact: true }).waitFor();
    const renderedHash = await page.getByTestId("dashboard").getAttribute("data-source-hash");
    if (renderedHash !== sourceHash) throw new Error("Rendered dashboard source does not match this release");
    await page.getByRole("button", { name: /Validation Suites/ }).click();
    await page.getByRole("heading", { name: "Recorded Validation Results" }).waitFor();
    if (errors.length) throw new Error(`Dashboard browser errors: ${errors.join("; ")}`);
  } finally { await page.close(); }
}
