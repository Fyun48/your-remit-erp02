import { router } from '../trpc'
import { healthRouter } from './health'
import { workShiftRouter } from './workShift'

export const appRouter = router({
  health: healthRouter,
  workShift: workShiftRouter,
})

export type AppRouter = typeof appRouter
