export interface OrgEmailSendRequestContract {
  subject: string;
  body: string;
  /**
   * Recipient user id or email.
   * Digit-only strings are treated as user ids.
   * Strings containing `@` are treated as emails.
   * The resolved user must already belong to the organization.
   */
  recipient: string;
  /**
   * Optional variables that the mail rendering layer may use.
   * Currently accepted for forward compatibility and not yet applied during sending.
   */
  variables?: Record<string, string>;
  /**
   * Optional link variables that the mail rendering layer may use.
   * Currently accepted for forward compatibility and not yet applied during sending.
   */
  links?: Record<string, string>;
}

export interface OrgEmailSendResponseContract {
  requestId: string;
  /**
   * Organization member user id accepted for delivery.
   */
  sentUserId: number;
  /**
   * Recipient email accepted for delivery when known.
   */
  sentEmail?: string;
}
