import { router, publicProcedure } from '../trpc'

export const healthRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    // 檢查資料庫連線
    await ctx.prisma.$queryRaw`SELECT 1`
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }),
})
