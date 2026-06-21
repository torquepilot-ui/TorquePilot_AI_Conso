import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase() ?? "";
      return email === "torquepilot34@gmail.com" || email.endsWith("@gmail.com");
    },
    async session({ session, token }) {
      (session as unknown as Record<string, unknown>).dbUserId = token.dbUserId;
      return session;
    },
  },
};
