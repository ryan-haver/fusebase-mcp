import * as fs from "fs";
import { registerCoreTools } from "../src/tools/core-tools.js";
import { registerExtendedTools } from "../src/tools/extended-tools.js";

interface RegisteredTool {
  name: string;
  description?: string;
  schema?: any;
  tier: "core" | "extended";
}

const tools: RegisteredTool[] = [];

function createMockServer(tier: "core" | "extended") {
  return {
    tool: (name: string, ...args: any[]) => {
      let description: string | undefined;
      let schema: any;
      if (typeof args[0] === "string") {
        description = args[0];
        if (args.length >= 2 && typeof args[1] === "object") {
          schema = args[1];
        }
      } else if (typeof args[0] === "object") {
        schema = args[0];
      }
      tools.push({ name, description, schema, tier });
    },
  } as any;
}

// Register core
const mockCore = createMockServer("core");
registerCoreTools(mockCore, () => ({} as any), {
  enableExtendedTools: () => {},
  isExtendedToolsEnabled: () => false,
  setActiveProfile: () => {},
  getActiveProfile: () => undefined,
});

// Register extended
const mockExt = createMockServer("extended");
registerExtendedTools(mockExt, () => ({} as any));

console.log("=== TOTAL TOOL COUNTS ===");
const core = tools.filter((t) => t.tier === "core");
const extended = tools.filter((t) => t.tier === "extended");
console.log(`Core tools count: ${core.length}`);
console.log(`Extended tools count: ${extended.length}`);
console.log(`Total tools count: ${tools.length}`);

// Check for duplicates between core and extended
const coreNames = new Set(core.map((t) => t.name));
const duplicates = extended.filter((t) => coreNames.has(t.name)).map((t) => t.name);
console.log("\n=== DUPLICATE TOOLS ===");
console.log(duplicates.length > 0 ? duplicates : "None");

// Check parameter schemas and descriptions
console.log("\n=== PARAMETER SCHEMA AUDIT ===");
const missingProfile: string[] = [];
const missingParamDescriptions: { tool: string; param: string }[] = [];
const toolsWithoutDescription: string[] = [];

for (const t of tools) {
  if (!t.description || t.description.trim().length === 0) {
    toolsWithoutDescription.push(t.name);
  }

  const schema = t.schema || {};
  // Check if profile is supported (skip tools that are strictly local or meta)
  const isLocalMeta = ["list_agent_profiles", "switch_active_profile", "list_guide_sections"].includes(t.name);
  if (!schema.profile && !isLocalMeta) {
    missingProfile.push(t.name);
  }

  for (const [paramName, zField] of Object.entries<any>(schema)) {
    // Check if zod field has description
    if (zField && !zField.description) {
      missingParamDescriptions.push({ tool: t.name, param: paramName });
    }
  }
}

console.log(`Tools missing description: ${toolsWithoutDescription.length ? toolsWithoutDescription.join(", ") : "None"}`);
console.log(`Tools missing 'profile' parameter (${missingProfile.length}):\n  ${missingProfile.join(", ")}`);
console.log(`Parameters missing .describe() (${missingParamDescriptions.length}):`);
for (const p of missingParamDescriptions) {
  console.log(`  ${p.tool} -> ${p.param}`);
}

// Print all tool names categorized
console.log("\n=== CORE TOOL NAMES ===");
console.log(core.map((t) => t.name).join(", "));

// Deep audit: which client methods are called by multiple tools?
function findClientCalls(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const toolBlocks = content.split(/server\.tool\(/);
  const map: Record<string, string[]> = {};
  for (let i = 1; i < toolBlocks.length; i++) {
    const block = toolBlocks[i];
    const nameMatch = block.match(/^\s*["']([^"']+)["']/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const clientCalls = [...block.matchAll(/client\.([a-zA-Z0-9_]+)\(/g)].map((m) => m[1]);
    map[name] = clientCalls;
  }
  return map;
}

const coreCalls = findClientCalls("src/tools/core-tools.ts");
const extCalls = findClientCalls("src/tools/extended-tools.ts");
const allCalls = { ...coreCalls, ...extCalls };

const methodToTools: Record<string, string[]> = {};
for (const [tool, methods] of Object.entries(allCalls)) {
  for (const m of methods) {
    if (!methodToTools[m]) methodToTools[m] = [];
    methodToTools[m].push(tool);
  }
}

console.log("\n=== CLIENT METHODS CALLED BY MULTIPLE TOOLS ===");
for (const [method, toolList] of Object.entries(methodToTools)) {
  if (toolList.length > 1) {
    console.log(`Method '${method}' called by: ${toolList.join(", ")}`);
  }
}

// Parameter frequency and naming variations
const paramFreq: Record<string, string[]> = {};
for (const t of tools) {
  for (const p of Object.keys(t.schema || {})) {
    if (!paramFreq[p]) paramFreq[p] = [];
    paramFreq[p].push(t.name);
  }
}
console.log("\n=== ALL PARAMETER KEYS ===");
console.log(Object.keys(paramFreq).sort().join(", "));

// Check specific potential discrepancies
console.log("\n=== PARAMETER VARIATIONS ===");
console.log("pageId vs noteId:");
console.log("  pageId used by:", paramFreq["pageId"]?.length, "tools");
console.log("  noteId used by:", paramFreq["noteId"] || []);

console.log("folderId vs parentId:");
console.log("  folderId used by:", paramFreq["folderId"] || []);
console.log("  parentId used by:", paramFreq["parentId"] || []);

console.log("databaseId vs dashboardId vs sourceDbId:");
console.log("  databaseId used by:", paramFreq["databaseId"] || []);
console.log("  dashboardId used by:", paramFreq["dashboardId"]?.length, "tools");
console.log("  sourceDbId used by:", paramFreq["sourceDbId"] || []);

// Check README tool coverage
const readme = fs.readFileSync("README.md", "utf-8");
const readmeMatches = readme.match(/`([a-z0-9_]+)`/g) || [];
const readmeCodeBlocks = new Set(readmeMatches.map((m) => m.replace(/`/g, "")));
const missingFromReadme = tools.map((t) => t.name).filter((name) => !readmeCodeBlocks.has(name));
console.log("\n=== README TOOL COVERAGE ===");
if (missingFromReadme.length > 0) {
  console.log(`Tools missing from README (${missingFromReadme.length}):`);
  console.log(" ", missingFromReadme.join(", "));
} else {
  console.log(`  All ${tools.length} tools are explicitly documented in README.md!`);
}

// ─── Verdict ─────────────────────────────────────────────────────────
// Hard failures; 'profile' coverage above is informational only.
const problems: string[] = [];
if (duplicates.length) problems.push(`${duplicates.length} tool(s) registered in both tiers: ${duplicates.join(", ")}`);
if (toolsWithoutDescription.length) problems.push(`${toolsWithoutDescription.length} tool(s) without a description`);
if (missingParamDescriptions.length) problems.push(`${missingParamDescriptions.length} parameter(s) without .describe()`);
if (missingFromReadme.length) problems.push(`${missingFromReadme.length} tool(s) not documented in README.md`);

if (problems.length) {
  console.error(`\n❌ Audit failed:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✅ Audit passed");
