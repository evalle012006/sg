import NextAuth from "next-auth"
import SequelizeAdapter from "@next-auth/sequelize-adapter"
import { sequelize } from "./../../../models"
import CredentialsProvider from "next-auth/providers/credentials";
import { login } from "./../../../utilities/api/authentication";

const configInfo = {
    session: {
        strategy: 'jwt',
    },
    providers: [CredentialsProvider({
        name: "Credentials",
        type: 'credentials',
        async authorize(credentials, req) {
            const user = await login(credentials);
            if (!user) return null;

            // Return a plain serialisable object, NOT the Sequelize instance.
            // Sequelize instances have circular refs that cause JSON.stringify
            // to produce {} silently, losing all fields from the JWT.
            //
            // type comes from credentials (the login form field), not the
            // model — Guest rows have no type column. login() receives
            // credentials.type ('guest' | 'user') from the client.
            return {
                id:    user.id,
                email: user.email,
                type:  credentials.type,   // 'guest' | 'user' — from login form
                name:  user.first_name
                    ? `${user.first_name} ${user.last_name ?? ''}`.trim()
                    : user.email,
            };
        },
    }),
    ],
    adapter: SequelizeAdapter(sequelize),
    callbacks: {
        // Runs when the JWT is created or refreshed.
        // Copies id and type onto the token at sign-in so getToken() returns
        // them at the top level rather than buried in token.user.
        async jwt({ token, user }) {
            if (user) {
                token.id   = user.id;
                token.type = user.type;
            }
            return token;
        },
        // Runs when getServerSession() builds the session object.
        // Forwards id and type to session.user so both getToken() and
        // getServerSession() return consistent data.
        async session({ session, token }) {
            if (token) {
                session.user.id   = token.id;
                session.user.type = token.type;
            }
            return session;
        },
    },
}

export const authOptions = {
    ...configInfo,
}

export default NextAuth(configInfo)