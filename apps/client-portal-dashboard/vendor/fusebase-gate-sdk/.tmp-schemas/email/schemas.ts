type LocalSchemaRef = Readonly<{ $ref: string }>;

export const EmailSchemas = {
  OrgEmailSendRequestContract: {
    $ref: "#/components/schemas/OrgEmailSendRequest",
  },
  OrgEmailSendResponseContract: {
    $ref: "#/components/schemas/OrgEmailSendResponse",
  },
} as const satisfies Record<string, LocalSchemaRef>;
