import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Serverless 環境優化設定
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    // 連線池設定（適合 Neon + Netlify serverless）
    datasourceUrl: process.env.DATABASE_URL,
  })
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

// 在開發環境和生產環境都保持單例，避免連線池耗盡
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
