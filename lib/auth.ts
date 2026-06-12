import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { DB_PATH, getUserByEmail, createUserOAuth } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.email) {
        const email = user.email.toLowerCase();
        const dbUser = getUserByEmail(DB_PATH, email) ?? createUserOAuth(DB_PATH, email);
        token.dbUserId = dbUser.id;
      }
      return token;
    },
  },
});
