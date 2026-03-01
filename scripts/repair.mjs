import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, "../src/index.ts");
let content = fs.readFileSync(indexPath, "utf-8");

// The previous AST replacement literally wrote the string \n into the file, which TS sees as "Invalid Character"
// because it's not inside quotes, it's just raw syntax. E.g.: `offset: z.number(),\n    profile: z.string()`
// We need to replace the exact phrase `\n    profile: z.string` with an actual newline.

content = content.replace(/\\n\s*profile/g, '\n    profile');
fs.writeFileSync(indexPath, content, "utf-8");
console.log("Fixed literal newline strings.");
