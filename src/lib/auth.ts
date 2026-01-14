import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const employee = await prisma.employee.findUnique({
          where: { email: credentials.email as string },
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              include: {
                company: true,
                department: true,
                position: true,
                role: true,
              },
            },
          },
        })

        if (!employee || !employee.isActive) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          employee.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          employeeNo: employee.employeeNo,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.employeeNo = (user as any).employeeNo
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).employeeNo = token.employeeNo
      }
      return session
    },
  },
})
