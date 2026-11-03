/** FuseBase's agent endpoint returns newline-delimited JSON followed by an end marker. */
export function parseAgentStream(raw: string, threadId: string): Record<string, unknown> {
  const marker = "[FULL]{}[!FULLEND]";
  const events: Array<{ type: string; content: unknown }> = [];
  let text = "";
  let completed = false;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (completed) throw new Error(`Agent stream contained data after completion (thread ${threadId})`);
    if (line.trim() === marker) {
      completed = true;
      continue;
    }
    let event: { t?: unknown; c?: unknown };
    try {
      event = JSON.parse(line);
    } catch {
      throw new Error(`Agent stream contained malformed JSON (thread ${threadId})`);
    }
    if (!event || typeof event.t !== "string") {
      throw new Error(`Agent stream contained an invalid event (thread ${threadId})`);
    }
    if (event.t === "error" || event.t === "aborted") {
      const reason = event.c && typeof event.c === "object" && "name" in event.c ? String(event.c.name) : event.t;
      throw new Error(`Agent execution failed: ${reason} (thread ${threadId})`);
    }
    if (event.t === "text") {
      if (typeof event.c !== "string") throw new Error(`Agent text event was not a string (thread ${threadId})`);
      text += event.c;
    } else {
      events.push({ type: event.t, content: event.c });
    }
  }
  if (!completed) throw new Error(`Agent stream ended before completion (thread ${threadId}); inspect the thread before retrying`);
  return { success: true, status: "completed", threadId, text, events };
}
