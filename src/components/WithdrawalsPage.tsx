import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NETWORKS, NetworkKey } from '../constants/topupNetworks'
import './WithdrawalsPage.css'

const STORAGE_KEY = 'spotlight_user'

type WithdrawalStatus = 'pending' | 'completed' | 'rejected'

interface StoredUser {
  email: string
  type?: string
}

interface WithdrawalRecord {
  id: string
  email: string
  amount: number | string | null
  address: string | null
  network: string | null
  comment?: string | null
  status: WithdrawalStatus | null
  created_at?: string
}

const parseAmount = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(',', '.'))
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

const formatStatus = (status: WithdrawalStatus | null): string => {
  switch (status) {
    case 'completed':
      return 'Выполнено'
    case 'rejected':
      return 'Отклонено'
    case 'pending':
    default:
      return 'В ожидании'
  }
}

const WithdrawalsPage = () => {
  const navigate = useNavigate()
  const [initialized, setInitialized] = useState(false)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | 'all'>('all')
  const [updatingNetworkId, setUpdatingNetworkId] = useState<string | null>(null)
  const [openNetworkDropdownId, setOpenNetworkDropdownId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: StoredUser | null = JSON.parse(stored)
        if (parsed?.type === 'admin' || parsed?.type === 'superadmin') {
          setInitialized(true)
          return
        }
      }
    } catch (readError) {
      console.error('Не удалось прочитать данные пользователя', readError)
    }

    navigate('/', { replace: true })
  }, [navigate])

  const fetchWithdrawals = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('spotlights_withdrawals')
        .select('id, email, amount, address, network, comment, status, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setWithdrawals(data ?? [])
    } catch (err: any) {
      console.error('Ошибка загрузки заявок на вывод', err)
      setError(err.message || 'Не удалось загрузить заявки.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialized) return
    fetchWithdrawals()
  }, [initialized])

  const filteredWithdrawals = useMemo(() => {
    const value = searchValue.trim().toLowerCase()
    return withdrawals.filter((item) => {
      const matchesSearch =
        !value ||
        item.email.toLowerCase().includes(value) ||
        (item.address?.toLowerCase().includes(value) ?? false)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [withdrawals, searchValue, statusFilter])

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString('ru-RU')
    } catch (err) {
      return value
    }
  }

  const handleStatusChange = async (record: WithdrawalRecord, status: WithdrawalStatus) => {
    if (!record?.id) return

    try {
      const { error } = await supabase
        .from('spotlights_withdrawals')
        .update({ status })
        .eq('id', record.id)

      if (error) throw error

      setWithdrawals((prev) =>
        prev.map((item) => (item.id === record.id ? { ...item, status } : item))
      )

      if (status === 'rejected') {
        const amountValue = parseAmount(record.amount)
        if (amountValue !== null) {
          const { data: userRecord, error: fetchError } = await supabase
            .from('spotlights_users')
            .select('balance')
            .eq('email', record.email)
            .maybeSingle()

          if (fetchError) {
            console.error('Не удалось получить баланс пользователя', fetchError)
            setError('Заявка отклонена, но не удалось вернуть средства. Проверьте баланс вручную.')
          } else {
            const currentBalance = parseAmount(userRecord?.balance)
            const updatedBalance = Number(((currentBalance ?? 0) + amountValue).toFixed(2))

            const { error: balanceError } = await supabase
              .from('spotlights_users')
              .update({ balance: updatedBalance })
              .eq('email', record.email)

            if (balanceError) {
              console.error('Не удалось вернуть средства пользователю', balanceError)
              setError('Заявка отклонена, но не удалось вернуть средства. Проверьте баланс вручную.')
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Не удалось обновить статус заявки', err)
      setError(err.message || 'Не удалось обновить статус заявки.')
    }
  }

  const handleNetworkChange = async (record: WithdrawalRecord, newNetwork: NetworkKey) => {
    if (!record?.id || record.network === newNetwork) return

    setUpdatingNetworkId(record.id)
    setError(null)
    setOpenNetworkDropdownId(null)

    try {
      const { error } = await supabase
        .from('spotlights_withdrawals')
        .update({ network: newNetwork })
        .eq('id', record.id)

      if (error) throw error

      setWithdrawals((prev) =>
        prev.map((item) => (item.id === record.id ? { ...item, network: newNetwork } : item))
      )
    } catch (err: any) {
      console.error('Не удалось обновить сеть заявки', err)
      setError(err.message || 'Не удалось обновить сеть заявки.')
    } finally {
      setUpdatingNetworkId(null)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.withdrawals-network-dropdown')) {
        setOpenNetworkDropdownId(null)
      }
    }

    if (openNetworkDropdownId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [openNetworkDropdownId])

  return (
    <div className="withdrawals-page">
      <div className="withdrawals-card">
        <div className="withdrawals-header">
          <div>
            <h1>Заявки на вывод</h1>
            <p>Обрабатывайте запросы пользователей на вывод средств со счёта Spotlight</p>
          </div>
          <div className="withdrawals-header-actions">
            <button className="withdrawals-subtle-button" onClick={() => navigate('/admin')}>
              ← К админ-панели
            </button>
            <button className="withdrawals-primary-button" onClick={() => navigate('/deposits')}>
              Заявки на пополнение
            </button>
          </div>
        </div>

        <div className="withdrawals-actions">
          <input
            className="withdrawals-search"
            type="search"
            placeholder="Поиск по email или адресу"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <select
            className="withdrawals-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as WithdrawalStatus | 'all')}
          >
            <option value="all">Все статусы</option>
            <option value="pending">В ожидании</option>
            <option value="completed">Выполнено</option>
            <option value="rejected">Отклонено</option>
          </select>
          <button className="withdrawals-subtle-button" onClick={fetchWithdrawals} disabled={loading}>
            Обновить
          </button>
        </div>

        {error && <div className="withdrawals-error">{error}</div>}

        <div className="withdrawals-content">
          {loading ? (
            <div className="withdrawals-loading">Загрузка...</div>
          ) : (
            filteredWithdrawals.length === 0 ? (
              <div className="withdrawals-empty">Заявки на вывод не найдены</div>
            ) : (
              <div className="withdrawals-grid">
                {filteredWithdrawals.map((item) => {
                  const amount = parseAmount(item.amount)
                  return (
                    <div className="withdrawals-card-item" key={item.id}>
                      <div className="withdrawals-card-section">
                        <span className="withdrawals-card-label">Email</span>
                        <span className="withdrawals-card-value">{item.email}</span>
                      </div>
                      <div className="withdrawals-card-section">
                        <span className="withdrawals-card-label">Сумма</span>
                        <span className="withdrawals-card-value">
                          {amount !== null ? `${amount.toFixed(2)} USDT` : '—'}
                        </span>
                      </div>
                      <div className="withdrawals-card-section">
                        <span className="withdrawals-card-label">Сеть</span>
                        {(() => {
                          const isPending = item.status === 'pending' || item.status === null
                          const currentNetworkKey = item.network
                            ? (Object.keys(NETWORKS).find(
                                (key) => key.toLowerCase() === item.network?.toLowerCase()
                              ) as NetworkKey | undefined) || 'bsc'
                            : 'bsc'
                          
                          if (isPending) {
                            const isOpen = openNetworkDropdownId === item.id
                            return (
                              <div className="withdrawals-network-dropdown">
                                <button
                                  type="button"
                                  className="withdrawals-network-button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenNetworkDropdownId(isOpen ? null : item.id)
                                  }}
                                  disabled={updatingNetworkId === item.id}
                                  title="Змінити мережу виводу"
                                >
                                  <span>{NETWORKS[currentNetworkKey].label}</span>
                                  <span className="withdrawals-network-arrow">{isOpen ? '▲' : '▼'}</span>
                                </button>
                                {isOpen && (
                                  <div className="withdrawals-network-dropdown-list">
                                    {Object.entries(NETWORKS).map(([key, value]) => (
                                      <button
                                        key={key}
                                        type="button"
                                        className={`withdrawals-network-option ${
                                          key === currentNetworkKey ? 'withdrawals-network-option--active' : ''
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (key !== currentNetworkKey) {
                                            handleNetworkChange(item, key as NetworkKey)
                                          }
                                        }}
                                      >
                                        {value.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          }
                          
                          return (
                            <span className="withdrawals-card-value">
                              {item.network
                                ? (() => {
                                    const networkKey = Object.keys(NETWORKS).find(
                                      (key) => key.toLowerCase() === item.network?.toLowerCase()
                                    ) as NetworkKey | undefined
                                    return networkKey ? NETWORKS[networkKey].label : item.network.toUpperCase()
                                  })()
                                : '—'}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="withdrawals-card-section">
                        <span className="withdrawals-card-label">Адрес</span>
                        <span className="withdrawals-card-value withdrawals-card-address">{item.address ?? '—'}</span>
                      </div>
                      <div className="withdrawals-card-section">
                        <span className="withdrawals-card-label">Комментарий</span>
                        <span className="withdrawals-card-value">{item.comment || '—'}</span>
                      </div>
                      <div className="withdrawals-card-section">
                        <span className="withdrawals-card-label">Статус</span>
                        <span className={`withdrawals-status withdrawals-status--${item.status ?? 'pending'}`}>
                          {formatStatus(item.status ?? 'pending')}
                        </span>
                      </div>
                      <div className="withdrawals-card-section">
                        <span className="withdrawals-card-label">Создано</span>
                        <span className="withdrawals-card-value">{formatDate(item.created_at)}</span>
                      </div>
                      <div className="withdrawals-card-actions">
                        <button
                          className="withdrawals-action-button withdrawals-action-button--success"
                          type="button"
                          onClick={() => handleStatusChange(item, 'completed')}
                          disabled={item.status === 'completed'}
                        >
                          Выполнено
                        </button>
                        <button
                          className="withdrawals-action-button withdrawals-action-button--danger"
                          type="button"
                          onClick={() => handleStatusChange(item, 'rejected')}
                          disabled={item.status === 'rejected'}
                        >
                          Отклонено
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default WithdrawalsPage

