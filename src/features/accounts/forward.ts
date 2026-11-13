import { CLIENT_IP_HEADER, PUBLIC_ROUTE_HEADER } from "./auth.ts";

export type AuthHandler = (request: Request) => Promise<Response>;

/**
 * Hands a request for /api/auth/* to better-auth. better-auth rate-limits by client address, which
 * it reads from CLIENT_IP_HEADER. We set that header from SvelteKit's `getClientAddress()` and
 * overwrite whatever the client sent, so a visitor cannot choose their own rate-limit bucket.
 * It also marks the request as coming through the public route (PUBLIC_ROUTE_HEADER), which is how
 * better-auth knows to refuse a sign-up that skipped the sign-up form.
 */
export function forwardToAuth(
  handler: AuthHandler,
  request: Request,
  clientAddress: string,
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set(CLIENT_IP_HEADER, clientAddress);
  headers.set(PUBLIC_ROUTE_HEADER, "1");
  return handler(new Request(request, { headers }));
}
