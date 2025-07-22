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
            return await login(credentials);
        },
    }),
    ],
    adapter: SequelizeAdapter(sequelize)
}

export const authOptions = {
    ...configInfo,
}

export default NextAuth({
    ...configInfo,
})

