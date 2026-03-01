import * as fs from "fs";
import * as path from "path";

import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, "../src/index.ts");
let content = fs.readFileSync(indexPath, "utf-8");

// Regex to find server.tool( "name", "desc", { ... }, async ({ ... }) => { ... } )
// We want to inject `profile: z.string().optional().describe("Agent profile for auth"),` into the schema
// And add `profile` to the destructured args
// And change `client.something` to `getClient(profile).something`

// This is complex to do with pure string replacement safely, so let's use a simpler approach:
// We'll match `async ({ args }) => {`
// And the Zod schemas map

const lines = content.split("\n");
let inTool = false;
let inSchema = false;
let inHandler = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^(\s*)server\.tool\(/)) {
        inTool = true;
        continue;
    }

    if (inTool && line.match(/^(\s*)(async )?\({/)) {
        // This is the beginning of the handler: async ({ workspaceId, ... }) => {
        // Insert profile into the destructured object
        lines[i] = line.replace(/\({([^}]*)}\)/, "({$1, profile})").replace(/,\s*profile/, ", profile");
        // Also, looking backwards we just passed the schema object closure `  },`
        // So let's insert the profile zod definition exactly two lines above or before the closing `  },`
        for (let j = i - 1; j >= 0; j--) {
            if (lines[j].trim() === "},") {
                lines.splice(j, 0, '    profile: z.string().optional().describe("Agent profile to use for auth"),');
                i++; // adjust since we added a line
                break;
            }
        }

        // Also insert `const client = getClient(profile);` immediately after the opening of the block
        if (lines[i].endsWith("{")) {
            lines.splice(i + 1, 0, '    const client = getClient(profile);');
            i++;
        } else {
            // It might be split across lines, very naive assumption here, we will refine
        }
    }
}

// Let's use a more robust regex-based global replace because the file is well formatted.

let newContent = content;

// 1. Add `profile` to the Zod schema
// Target: the end of the Zod object before the `  },` that precedes `async ({`
// Regex: `([\s\S]*?)(\s*)\},(\s*)async\s*\(\{\s*([^}]*)\s*\}\)\s*=>\s*\{`
newContent = newContent.replace(
    /(\s*)\},\s*async\s*\(\{\s*([^}]*)\s*\}\)\s*=>\s*\{/g,
    (match, p1, p2) => {
        const hasArgs = p2.trim().length > 0;
        const newArgs = hasArgs ? `${p2}, profile` : `profile`;
        return `,\n    profile: z.string().optional().describe("Agent profile to use for authentication"),${p1}}, async ({ ${newArgs} }) => {\n    const client = getClient(profile);`;
    }
);

// Special case for tools with no args initially: `{}, async () => {`
newContent = newContent.replace(
    /\{\},\s*async\s*\(\)\s*=>\s*\{/g,
    `{\n    profile: z.string().optional().describe("Agent profile to use for authentication"),\n  }, async ({ profile }) => {\n    const client = getClient(profile);`
);

fs.writeFileSync(indexPath, newContent, "utf-8");
console.log("Injected profile parameter into tools.");
