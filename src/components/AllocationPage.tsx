import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateCoinSchedule } from '../lib/coinSchedule'
import './AllocationPage.css'

const STORAGE_KEY = 'spotlight_user'

interface SpotlightRecord {
  id: number
  symbol?: string | null
  name?: string | null
  position?: number | null
}

interface UserState {
  id: number
  email: string
  balance: number
}

const AllocationPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [coins, setCoins] = useState<SpotlightRecord[]>([])
  const [selectedCoin, setSelectedCoin] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [currentUser, setCurrentUser] = useState<UserState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const coinSchedule = useMemo(() => generateCoinSchedule({ eventCount: 40 }), [])
  const activePositions = useMemo(
    () => new Set(coinSchedule.initialState.active.map((coin) => coin.id)),
    [coinSchedule]
  )

  useEffect(() => {
    const fetchCoins = async () => {
      const { data, error: fetchError } = await supabase
        .from('spotlights')
        .select('id, symbol, name, position')
        .order('position', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      const items = data ?? []
      setCoins(items)

      const paramCoinId = Number(searchParams.get('coinId'))
      const paramCoin = items.find((item) => item.id === paramCoinId)
      const paramCoinActive = paramCoin && activePositions.has(Number(paramCoin.position))

      if (paramCoinActive) {
        setSelectedCoin(paramCoin.id)
        return
      }

      const firstActive = items.find((item) => activePositions.has(Number(item.position)))
      if (firstActive) {
        setSelectedCoin(firstActive.id)
        return
      }

      if (items.length > 0) {
        setSelectedCoin(items[0].id)
      }
    }

    fetchCoins()
  }, [searchParams, activePositions])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedRaw = window.localStorage.getItem(STORAGE_KEY)
    if (!storedRaw) return

    try {
      const parsed: { email?: string } | null = JSON.parse(storedRaw)
      if (!parsed?.email) return

      ;(async () => {
        const { data, error: userError } = await supabase
          .from('spotlights_users')
          .select('id, email, balance')
          .eq('email', parsed.email)
          .maybeSingle()

        if (!userError && data) {
          setCurrentUser({
            id: data.id,
            email: data.email ?? parsed.email,
            balance: Number(data.balance ?? 0)
          })
        }
      })()
    } catch (parseError) {
      console.error('Failed to parse stored user data', parseError)
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUser) {
      setError('Необходимо войти в систему.')
      return
    }
    if (!selectedCoin) {
      setError('Выберите монету.')
      return
    }

    const coinRecord = coins.find((coin) => coin.id === selectedCoin)
    const position = coinRecord?.position
    if (!coinRecord || !activePositions.has(Number(position))) {
      setError('Выбранная монета сейчас неактивна.')
      return
    }

    const normalized = amount.replace(',', '.').trim()
    if (!normalized) {
      setError('Введите сумму аллокации.')
      return
    }

    const numericAmount = parseFloat(normalized)
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError('Введите корректную сумму больше 0.')
      return
    }

    if (numericAmount > currentUser.balance) {
      setError('Недостаточно средств на балансе.')
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const { data: userRow, error: userError } = await supabase
        .from('spotlights_users')
        .select('id, balance, email')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (userError || !userRow) {
        throw new Error(userError?.message || 'Не удалось получить данные пользователя')
      }

      if ((userRow.balance ?? 0) < numericAmount) {
        throw new Error('Недостаточно средств на балансе.')
      }

      const updatedBalance = Number(((userRow.balance ?? 0) - numericAmount).toFixed(2))

      const { error: balanceError } = await supabase
        .from('spotlights_users')
        .update({ balance: updatedBalance })
        .eq('id', userRow.id)

      if (balanceError) {
        throw new Error(balanceError.message)
      }

      const activeCoin = activePositions.has(Number(coinRecord.position))
        ? coinSchedule.initialState.active.find((coin) => coin.id === Number(coinRecord.position))
        : undefined

      const expiredAt = activeCoin?.expiresAt ?? null

      const { error: allocationError } = await supabase.from('spotlights_allocations').insert({
        users_id: userRow.id,
        coin_id: selectedCoin,
        amount: numericAmount,
        expired_at: expiredAt ?? null
      })

      if (allocationError) {
        throw new Error(allocationError.message)
      }

      setCurrentUser({ ...currentUser, balance: updatedBalance })

      if (typeof window !== 'undefined') {
        try {
          const storedRaw = window.localStorage.getItem(STORAGE_KEY)
          if (storedRaw) {
            const parsed = JSON.parse(storedRaw)
            if (parsed?.email === currentUser.email) {
              const updatedStored = { ...parsed, balance: updatedBalance }
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStored))
            }
          }
        } catch (storageError) {
          console.error('Failed to update stored user', storageError)
        }

        window.dispatchEvent(
          new CustomEvent('spotlight-balance-updated', {
            detail: { balance: updatedBalance, email: currentUser.email }
          })
        )
      }

      setAmount('')
      setSuccess('Аллокация успешно добавлена.')
    } catch (submitError: any) {
      setError(submitError.message || 'Не удалось выполнить операцию')
    } finally {
      setLoading(false)
    }
  }

  const activeCoins = coins.filter((coin) => activePositions.has(Number(coin.position)))

  return (
    <div className="allocation-page">
      <div className="allocation-card">
        <div className="allocation-header">
          <div>
            <h1>Добавить аллокацию</h1>
          </div>
          <button className="allocation-back" onClick={() => navigate(-1)}>
            ← Назад
          </button>
        </div>

        {!currentUser ? (
          <div className="allocation-warning">
            Войдите в систему, чтобы создавать аллокации.
          </div>
        ) : (
          <div className="allocation-balance">
            Доступный баланс: <strong>{currentUser.balance.toFixed(2)} USDT</strong>
          </div>
        )}

        <form className="allocation-form" onSubmit={handleSubmit}>
          <div className="allocation-field">
            <label htmlFor="allocationCoin">Монета</label>
            <select
              id="allocationCoin"
              value={selectedCoin ?? ''}
              onChange={(event) => setSelectedCoin(Number(event.target.value))}
              disabled={loading || activeCoins.length === 0}
            >
              {activeCoins.length === 0 && <option value="">Активные монеты отсутствуют</option>}
              {activeCoins.map((coin) => (
                <option key={coin.id} value={coin.id}>
                  {coin.symbol ? `${coin.symbol}` : coin.name || `Монета #${coin.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="allocation-field">
            <label htmlFor="allocationAmount">Сумма</label>
            <input
              id="allocationAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Например, 150"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={loading || !currentUser}
            />
          </div>

          {error && <div className="allocation-error">{error}</div>}
          {success && <div className="allocation-success">{success}</div>}

          <div className="allocation-actions">
            <button type="button" className="allocation-cancel" onClick={() => navigate(-1)} disabled={loading}>
              Отмена
            </button>
            <button type="submit" className="allocation-submit" disabled={loading || !currentUser || activeCoins.length === 0}>
              {loading ? 'Обработка...' : 'Подтвердить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AllocationPage
