const DAY_MS = 24 * 60 * 60 * 1000

export type CoinStatus = 'active' | 'inactive'

export interface CoinState {
  id: number
  status: CoinStatus
  activatedAt?: string
  expiresAt?: string
}

export interface CoinEvent {
  index: number
  timestamp: string
  expiringCoin: number
  activatingCoin: number
  activationEndsAt: string
}

export interface CoinScheduleOptions {
  /**
   * Дата, з якої починається розклад.
   * Якщо не вказано, використовується поточний момент.
   */
  startDate?: Date
  /**
   * Загальна кількість монет.
   */
  totalCoins?: number
  /**
   * Кількість монет, що мають бути активними одночасно.
   */
  activeCoins?: number
  /**
   * Тривалість активності монети в днях.
   */
  activationDurationDays?: number
  /**
   * Скільки подій (експірацій/запусків) згенерувати.
   * За замовчуванням — одна повна ротація (totalCoins подій).
   */
  eventCount?: number
}

export interface CoinScheduleResult {
  metadata: {
    generatedAt: string
    stepHours: number
    activationDurationDays: number
    totalCoins: number
    activeCoins: number
  }
  initialState: {
    active: CoinState[]
    inactive: CoinState[]
  }
  events: CoinEvent[]
}

interface ActiveCoin {
  id: number
  activatedAt: Date
  expiresAt: Date
}

const toIso = (date: Date) => date.toISOString()

/**
 * Генерує циклічний розклад активації/деактивації монет.
 */
export const generateCoinSchedule = ({
  startDate = new Date(),
  totalCoins = 20,
  activeCoins = 15,
  activationDurationDays = 20,
  eventCount
}: CoinScheduleOptions = {}): CoinScheduleResult => {
  if (totalCoins <= 0) throw new Error('Total coins must be greater than 0')
  if (activeCoins <= 0) throw new Error('Active coins must be greater than 0')
  if (activeCoins >= totalCoins) throw new Error('Active coins must be less than total coins')

  const activationDurationMs = activationDurationDays * DAY_MS
  const stepMs = activationDurationMs / activeCoins
  const startTime = startDate.getTime()

  const active: ActiveCoin[] = Array.from({ length: activeCoins }, (_, index) => {
    const expiresAt = new Date(startTime + stepMs * (index + 1))
    const activatedAt = new Date(expiresAt.getTime() - activationDurationMs)
    return { id: index + 1, activatedAt, expiresAt }
  })

  const inactiveQueue: number[] = Array.from(
    { length: totalCoins - activeCoins },
    (_, index) => activeCoins + index + 1
  )

  const eventTotal = eventCount ?? totalCoins
  const events: CoinEvent[] = []

  const workingActive: ActiveCoin[] = active.map((coin) => ({ ...coin }))
  const workingQueue = [...inactiveQueue]

  for (let i = 0; i < eventTotal; i += 1) {
    workingActive.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
    const expiringCoin = workingActive.shift()

    if (!expiringCoin) {
      break
    }

    const eventTime = expiringCoin.expiresAt
    const activatingCoinId = workingQueue.shift() ?? expiringCoin.id
    const newActivatedAt = eventTime
    const newExpiresAt = new Date(eventTime.getTime() + activationDurationMs)

    events.push({
      index: i + 1,
      timestamp: toIso(eventTime),
      expiringCoin: expiringCoin.id,
      activatingCoin: activatingCoinId,
      activationEndsAt: toIso(newExpiresAt)
    })

    workingQueue.push(expiringCoin.id)
    workingActive.push({
      id: activatingCoinId,
      activatedAt: newActivatedAt,
      expiresAt: newExpiresAt
    })
  }

  return {
    metadata: {
      generatedAt: toIso(startDate),
      stepHours: stepMs / (60 * 60 * 1000),
      activationDurationDays,
      totalCoins,
      activeCoins
    },
    initialState: {
      active: active
        .slice()
        .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
        .map((coin) => ({
          id: coin.id,
          status: 'active',
          activatedAt: toIso(coin.activatedAt),
          expiresAt: toIso(coin.expiresAt)
        })),
      inactive: inactiveQueue.map((id) => ({
        id,
        status: 'inactive'
      }))
    },
    events
  }
}

