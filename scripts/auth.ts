import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { main } from "../src/auth.js";
export * from "../src/auth.js";
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
