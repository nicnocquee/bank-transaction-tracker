/**
 * Validates the Authorization bearer token for cron endpoints.
 * @param authorizationHeader - Raw Authorization header value.
 * @param expectedSecret - Expected CRON_SECRET (defaults to env).
 * @returns True when the bearer token matches.
 */
export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  expectedSecret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!expectedSecret || !authorizationHeader) {
    return false;
  }
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return false;
  }
  return token === expectedSecret;
}
