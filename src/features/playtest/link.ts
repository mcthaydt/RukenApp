// An invite link's token: 128 random bits, as 22 characters of base64url (PlaytestLink_token_check).

export function newLinkToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/** The address a maker copies and sends: /p/<token>. */
export function linkPath(token: string): string {
  return `/p/${token}`;
}
