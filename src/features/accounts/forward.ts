export type AuthHandler = (request: Request) => Promise<Response>;

export function forwardToAuth(
  handler: AuthHandler,
  request: Request,
  clientAddress: string,
): Promise<Response> {
  throw new Error(`not built yet (${typeof handler} ${request.url} ${clientAddress})`);
}
