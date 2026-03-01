/**
 * Integration test for guide loader + MCP guide tools.
 */
import { loadGuideIndex, searchGuides, getGuideContent, listGuideSections } from "../src/guide-loader.js";

function assert(name: string, condition: boolean, detail?: string) {
    console.log(`  ${condition ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
    if (!condition) process.exitCode = 1;
}

async function main() {
    console.log("=== Guide Loader Tests ===\n");

    // Test 1: Load index
    const index = loadGuideIndex();
    assert("Index loads guides", index.length > 200, `${index.length} guides`);
    assert("Has 17+ sections", new Set(index.map(e => e.section)).size >= 17,
        `${new Set(index.map(e => e.section)).size} sections`);

    // Test 2: List sections
    const sections = listGuideSections();
    assert("listGuideSections returns 17", sections.length >= 17, `${sections.length} sections`);
    assert("basics section exists", sections.some(s => s.name === "basics"));
    assert("page-editor section exists", sections.some(s => s.name === "page-editor"));

    // Test 3: Search for "toggle"
    const toggleResults = searchGuides("toggle");
    assert("Search 'toggle' finds results", toggleResults.length > 0, `${toggleResults.length} results`);
    assert("Search 'toggle' includes toggles guide",
        toggleResults.some(r => r.slug === "toggles" || r.title.toLowerCase().includes("toggle")));

    // Test 4: Search for "table"
    const tableResults = searchGuides("table");
    assert("Search 'table' finds results", tableResults.length > 0, `${tableResults.length} results`);

    // Test 5: Search for "hint"
    const hintResults = searchGuides("hint");
    assert("Search 'hint' finds hint-object", hintResults.some(r => r.slug === "hint-object"));

    // Test 6: Get guide content
    const hintContent = getGuideContent("basics", "hint-object");
    assert("getGuideContent returns content", hintContent !== null && hintContent.length > 100,
        hintContent ? `${hintContent.length} chars` : "null");
    assert("Content includes 'Hint'", hintContent?.includes("Hint") ?? false);

    // Test 7: Get non-existent guide
    const missing = getGuideContent("fake-section", "nonexistent");
    assert("Non-existent guide returns null", missing === null);

    // Test 8: Search with limit
    const limited = searchGuides("page", 3);
    assert("Search limit works", limited.length <= 3, `${limited.length} results`);

    // Summary
    console.log(`\n=== Done ===`);
}

main().catch(console.error);
