import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no Prisma / Node-only imports).
 * Used by middleware for session gatekeeping.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    /**
     * Copies the user id onto the JWT.
     */
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    /**
     * Exposes the user id on the session object.
     */
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    /**
     * Authorizes page access based on session cookie presence.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isPublic =
        pathname === "/login" ||
        pathname === "/register" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/register");

      if (pathname.startsWith("/api/") && !isPublic && !isLoggedIn) {
        return false;
      }
      if (!isLoggedIn && !isPublic && !pathname.startsWith("/api/")) {
        return false;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
