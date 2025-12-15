import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './AdminAllocationsPage.css'

interface AllocationRecord {
  id: number
  amount: number
  percent: number | null
  status: string | null
  expired_at: string | null
  created_at: string | null
  user_email: string
  users_id?: number | null
  coin_symbol?: string | null
  coin_name?: string | null
}

const STORAGE_KEY = 'spotlight_user'

interface StoredUser {
  email: string
  type?: string
}

const AdminAllocationsPage = () => {
  const navigate = useNavigate()
  const [allocations, setAllocations] = useState<AllocationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closingAllocationId, setClosingAllocationId] = useState<number | null>(null)

  const fetchAllocations = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('spotlights_allocations')
        .select(
          `id, amount, percent, status, expired_at, created_at, users_id,
           user:spotlights_users(email),
           coin:spotlights(symbol, name)`
        )
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      const mapped = (data ?? []).map((item: any) => ({
        id: item.id,
        amount: Number(item.amount ?? 0),
        percent: item.percent !== null ? Number(item.percent) : null,
        status: item.status ?? null,
        expired_at: item.expired_at,
        created_at: item.created_at,
        users_id: item.users_id ?? null,
        user_email: item.user?.email ?? '—',
        coin_symbol: item.coin?.symbol ?? null,
        coin_name: item.coin?.name ?? null
      }))

      setAllocations(mapped)
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить аллокации.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAccess = async () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed: StoredUser | null = JSON.parse(stored)
          if (parsed?.type === 'admin' || parsed?.type === 'superadmin') {
            // Для superadmin - повний доступ
            if (parsed?.type === 'superadmin') {
              fetchAllocations()
              return
            }

            // Для admin - перевіряємо, чи є адміни з ref_id
            if (parsed?.type === 'admin') {
              const { data: userData } = await supabase
                .from('users')
                .select('ref_id, isAdmin')
                .eq('isAdmin', true)
                .not('ref_id', 'is', null)
                .limit(1)

              // Якщо є хоча б один адмін з ref_id, перенаправляємо на trading
              if (userData && userData.length > 0) {
                navigate('/admin/trading', { replace: true })
                return
              }

              // Якщо немає адмінів з ref_id, дозволяємо доступ
              fetchAllocations()
              return
            }
          }
        }
      } catch (parseError) {
        console.error('Не удалось прочитать данные пользователя', parseError)
      }

      navigate('/', { replace: true })
    }

    checkAccess()
  }, [navigate])

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString('ru-RU')
    } catch (err) {
      return value
    }
  }

  const formatStatus = (status?: string | null) => {
    switch ((status ?? '').toLowerCase()) {
      case 'pending':
        return 'В обработке'
      case 'active':
        return 'Активна'
      case 'closed':
        return 'Завершена'
      case 'cancelled':
      case 'canceled':
        return 'Отменена'
      default:
        return '—'
    }
  }

  const closeAllocation = async (allocation: AllocationRecord) => {
    if (!allocation.users_id) {
      setError('Не удалось получить ID пользователя для алокации.')
      return
    }

    setClosingAllocationId(allocation.id)
    setError(null)

    try {
      const amountValue = Number(allocation.amount ?? 0)
      const { data: userRow, error: userError } = await supabase
        .from('spotlights_users')
        .select('id, email, balance')
        .eq('id', allocation.users_id)
        .maybeSingle()

      if (userError || !userRow) {
        throw new Error('Не удалось получить пользователя для алокации')
      }

      const percentValue = Number(allocation.percent ?? 0)
      const bonus = amountValue * (percentValue / 100)
      const total = amountValue + bonus
      const newBalance = Number((Number(userRow.balance ?? 0) + total).toFixed(2))

      const { error: balanceError } = await supabase
        .from('spotlights_users')
        .update({ balance: newBalance })
        .eq('id', userRow.id)

      if (balanceError) {
        throw new Error('Не удалось обновить баланс пользователя')
      }

      const { error: closeError } = await supabase
        .from('spotlights_allocations')
        .update({ status: 'closed' })
        .eq('id', allocation.id)

      if (closeError) {
        throw new Error('Не удалось закрыть алокацию')
      }

      // Update local storage if needed
      if (typeof window !== 'undefined') {
        try {
          const storedRaw = window.localStorage.getItem(STORAGE_KEY)
          if (storedRaw) {
            const parsed = JSON.parse(storedRaw)
            if (parsed?.email === userRow.email) {
              const updatedStored = { ...parsed, balance: newBalance }
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStored))
            }
          }
        } catch (storageError) {
          console.error('Не удалось обновить локальный баланс пользователя', storageError)
        }
      }

      // Refresh allocations list
      await fetchAllocations()
    } catch (err: any) {
      console.error('Ошибка закрытия алокации', err)
      setError(err.message || 'Не удалось закрыть алокацию.')
    } finally {
      setClosingAllocationId(null)
    }
  }

  return (
    <div className="admin-allocations-page">
      <div className="admin-allocations-card">
        <div className="admin-allocations-header">
          <div>
            <h1>Аллокации пользователей</h1>
            <p>Список созданных аллокаций с суммами, процентами и временем экспирации монеты</p>
          </div>
          <div className="admin-allocations-actions">
            <button className="admin-allocations-refresh" onClick={fetchAllocations} disabled={loading}>
              {loading ? 'Обновление...' : 'Обновить'}
            </button>
            <button className="admin-allocations-back" onClick={() => navigate('/admin')}>
              ← К админ-панели
            </button>
          </div>
        </div>

        {error && <div className="admin-allocations-error">{error}</div>}

        <div className="admin-allocations-table-wrapper">
          <table className="admin-allocations-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Монета</th>
                <th>Сумма</th>
                <th>Процент</th>
                <th>Монета экспирирует</th>
                <th>Статус</th>
                <th>Создано</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-allocations-empty">
                    Аллокации отсутствуют
                  </td>
                </tr>
              ) : (
                allocations.map((allocation) => {
                  const isActive = (allocation.status ?? '').toLowerCase() === 'active'
                  const isClosing = closingAllocationId === allocation.id
                  return (
                  <tr key={allocation.id}>
                    <td>{allocation.user_email}</td>
                    <td>{allocation.coin_symbol || allocation.coin_name || `Монета #${allocation.id}`}</td>
                    <td>{allocation.amount.toFixed(2)} USDT</td>
                    <td>{allocation.percent !== null ? `${allocation.percent.toFixed(2)}%` : '—'}</td>
                    <td>{formatDate(allocation.expired_at)}</td>
                    <td>
                      <span
                        className={`admin-allocation-status admin-allocation-status--${
                          (allocation.status ?? 'unknown').toLowerCase()
                        }`}
                      >
                        {formatStatus(allocation.status)}
                      </span>
                    </td>
                    <td>{formatDate(allocation.created_at)}</td>
                      <td>
                        {isActive ? (
                          <button
                            className="admin-allocation-close-btn"
                            onClick={() => closeAllocation(allocation)}
                            disabled={isClosing || loading}
                            title="Закрити алокацію вручну"
                          >
                            {isClosing ? 'Закриття...' : 'Закрити'}
                          </button>
                        ) : (
                          <span className="admin-allocation-no-action">—</span>
                        )}
                      </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminAllocationsPage
