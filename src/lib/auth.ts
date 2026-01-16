import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        qrToken: { label: 'QR Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
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

        // Check for QR login token
        if (credentials.qrToken) {
          const qrLoginToken = await prisma.qrLoginToken.findFirst({
            where: {
              employeeId: employee.id,
              status: 'AUTHENTICATED',
              expiresAt: { gt: new Date() },
            },
            orderBy: { authenticatedAt: 'desc' },
          })

          if (qrLoginToken) {
            // Mark token as used
            await prisma.qrLoginToken.update({
              where: { id: qrLoginToken.id },
              data: { status: 'USED' },
            })

            return {
              id: employee.id,
              email: employee.email,
              name: employee.name,
              employeeNo: employee.employeeNo,
              avatarUrl: employee.avatarUrl,
            }
          }
        }

        // Standard password authentication
        if (!credentials.password) {
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
          avatarUrl: employee.avatarUrl,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.employeeNo = (user as any).employeeNo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.avatarUrl = (user as any).avatarUrl
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).employeeNo = token.employeeNo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).avatarUrl = token.avatarUrl
      }
      return session
    },
  },
})
