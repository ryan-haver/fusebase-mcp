import * as fs from "fs";
const data: Array<{ step: string; url: string; method: string; status: number; responseBody: string; requestBody: string }> = JSON.parse(fs.readFileSync("data/db-crud-capture.json", "utf-8"));

let output = "";
const steps = new Map<string, typeof data>();
for (const req of data) {
    if (!steps.has(req.step)) steps.set(req.step, []);
    steps.get(req.step)!.push(req);
}

for (const [step, reqs] of steps) {
    const apiReqs = reqs.filter(r =>
        r.url.includes("dashboard-service") ||
        r.url.includes("/databases") ||
        r.url.includes("/dashboards") ||
        r.url.includes("/views") ||
        r.url.includes("/items") ||
        r.url.includes("/columns") ||
        r.url.includes("/representations") ||
        r.url.includes("/fields") ||
        r.url.includes("/schema") ||
        r.url.includes("/config")
    );
    if (apiReqs.length === 0) continue;

    output += `\n=== ${step} ===\n`;
    for (const r of apiReqs) {
        const u = new URL(r.url);
        const p = u.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "{uuid}");
        const w = ["POST", "PUT", "PATCH", "DELETE"].includes(r.method) ? " ⚡" : "";
        const ok = r.status < 400 ? "✅" : "❌";
        output += `  ${ok} ${r.method} ${r.status} ${p}${w}\n`;
        if (r.requestBody && r.method !== "GET") {
            output += `    ReqBody: ${r.requestBody.slice(0, 200)}\n`;
        }
        if (r.status < 400 && r.method !== "GET") {
            output += `    Resp: ${r.responseBody.slice(0, 300)}\n`;
        }
        if (r.status >= 400) {
            output += `    Err: ${r.responseBody.slice(0, 200)}\n`;
        }
    }
}

output += `\n\n=== ENDPOINT MAP ===\n`;
const endpointMap = new Map<string, { statuses: number[], steps: string[] }>();
for (const req of data) {
    const u = new URL(req.url);
    const p = u.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "{uuid}");
    if (!p.includes("dashboard-service") && !p.includes("/databases") && !p.includes("/dashboards") && !p.includes("/views") && !p.includes("/items") && !p.includes("/columns") && !p.includes("/representations")) continue;
    const key = `${req.method} ${p}`;
    if (!endpointMap.has(key)) endpointMap.set(key, { statuses: [], steps: [] });
    const e = endpointMap.get(key)!;
    e.statuses.push(req.status);
    if (!e.steps.includes(req.step)) e.steps.push(req.step);
}

for (const [ep, info] of [...endpointMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    const statuses = [...new Set(info.statuses)].join(",");
    const ok = info.statuses.some(s => s < 400) ? "✅" : "❌";
    output += `${ok} ${ep}  →  [${statuses}]\n`;
}

fs.writeFileSync("data/db-crud-analysis.txt", output);
console.log("Written to data/db-crud-analysis.txt");
