# Fusebase Gate SDK

TypeScript SDK for Fusebase Gate APIs - Generated from contract introspection.

## Installation

```bash
npm install @internal/fusebase-gate-sdk
```

## Usage

```typescript
import { createClient, TokensApi, HealthApi } from "@internal/fusebase-gate-sdk";

// Create client
const client = createClient({
  baseUrl: "https://api.example.com",
  auth: {
    type: "bearer",
    token: "your-token-here",
  },
});

// Use API classes
const tokensApi = new TokensApi(client);
const healthApi = new HealthApi(client);

// Call methods
const token = await tokensApi.createToken({
  body: {
    scopes: [{ type: "org", id: "org-id" }],
    permissions: ["dashboard.read"],
  },
});
```

## API Classes

- `TokensApi` - Token management
- `HealthApi` - Health and liveness checks
- Other API classes are generated from registered contracts

## Types

All TypeScript types are exported from the package:

```typescript
import type { CreateTokenRequestContract, TokenResponseContract } from "@internal/fusebase-gate-sdk";
```
