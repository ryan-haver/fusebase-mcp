import { registerSchemas, type SchemaLike } from "@fusebase-platform/contracts";
import { registerMcpRuntimeSchemas } from "@fusebase-platform/mcp";
import { serviceRuntimeSchemaDefs } from "./runtime-schema-defs.generated";
import { serviceRuntimeSchemaOverrides } from "./runtime-schema-overrides";

const runtimeSchemaDefs: Record<string, SchemaLike> = {
  ...serviceRuntimeSchemaDefs,
  ...serviceRuntimeSchemaOverrides,
};

export function registerServiceRuntimeSchemas(): void {
  registerSchemas(runtimeSchemaDefs);
  registerMcpRuntimeSchemas(runtimeSchemaDefs);
}
