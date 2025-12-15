import { useEffect, useMemo, useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './DepositsPage.css'

const STORAGE_KEY = 'spotlight_user'

interface StoredUser {
  email: string
  type?: string
  balance?: number | string | null
}

interface DepositRecord {
  email: string
  amount: string | null
  created_at?: string
}

const DepositsPage = () => {
  const navigate = useNavigate()
  const [deposits, setDeposits] = useState<DepositRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [balanceEmail, setBalanceEmail] = useState<string | null>(null)
  const [balanceInput, setBalanceInput] = useState('')
  const [balanceError, setBalanceError] = useState('')
  const [balanceStatus, setBalanceStatus] = useState('')
  const [balanceLoading, setBalanceLoading] = useState(false)

  const parseBalanceValue = (value: unknown): number | null => {
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

  const fetchDeposits = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('spotlights_deposits')
        .select('email, amount, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDeposits(data ?? [])
    } catch (err: any) {
      console.error('Ошибка загрузки депозитов', err)
      setError(err.message || 'Не удалось загрузить депозиты.')
    } finally {
      setLoading(false)
    }
  }

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
    } catch (err) {
      console.error('Не удалось прочитать данные пользователя', err)
    }

    navigate('/', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!initialized) return
    fetchDeposits()
  }, [initialized])

  const filteredDeposits = useMemo(() => {
    const value = searchValue.trim().toLowerCase()
    if (!value) return deposits
    return deposits.filter((item) => item.email.toLowerCase().includes(value))
  }, [deposits, searchValue])

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString('ru-RU')
    } catch (err) {
      return value
    }
  }

  const openBalanceModal = async (email: string) => {
    setBalanceEmail(email)
    setBalanceError('')
    setBalanceStatus('')
    setBalanceInput('')
    setBalanceLoading(true)
    setBalanceModalOpen(true)
    try {
      const { data, error } = await supabase
        .from('spotlights_users')
        .select('balance')
        .eq('email', email)
        .maybeSingle()

      if (error) throw error
      const balanceValue = parseBalanceValue(data?.balance)
      setBalanceInput(balanceValue !== null ? balanceValue.toString() : '0')
    } catch (err: any) {
      console.error('Не удалось получить баланс пользователя', err)
      setBalanceError(err.message || 'Не удалось получить текущий баланс.')
    } finally {
      setBalanceLoading(false)
    }
  }

  const closeBalanceModal = () => {
    setBalanceModalOpen(false)
    setBalanceEmail(null)
    setBalanceError('')
    setBalanceStatus('')
    setBalanceInput('')
    setBalanceLoading(false)
  }

  const handleBalanceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!balanceEmail) return

    const normalized = balanceInput.replace(',', '.').trim()
    if (!normalized) {
      setBalanceError('Введите значение баланса.')
      return
    }

    const numeric = parseFloat(normalized)
    if (Number.isNaN(numeric)) {
      setBalanceError('Введите корректное числовое значение баланса.')
      return
    }

    setBalanceError('')
    setBalanceStatus('')
    setBalanceLoading(true)
    try {
      const { error } = await supabase
        .from('spotlights_users')
        .update({ balance: numeric })
        .eq('email', balanceEmail)

      if (error) throw error

      setBalanceStatus('Баланс успешно обновлён.')
      setBalanceLoading(false)
      fetchDeposits()

      if (typeof window !== 'undefined') {
        const storedRaw = window.localStorage.getItem(STORAGE_KEY)
        if (storedRaw) {
          try {
            const parsed: StoredUser = JSON.parse(storedRaw)
            if (parsed?.email === balanceEmail) {
              const updated = { ...parsed, balance: numeric }
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            }
          } catch (storageError) {
            console.error('Не удалось обновить локальные данные пользователя', storageError)
          }
        }
      }

      setTimeout(() => {
        closeBalanceModal()
      }, 1200)
    } catch (err: any) {
      console.error('Ошибка обновления баланса', err)
      setBalanceError(err.message || 'Не удалось обновить баланс.')
      setBalanceLoading(false)
    }
  }

  return (
    <div className="deposits-page">
      <div className="deposits-card">
        <div className="deposits-header">
          <div>
            <h1>Заявки на пополнение</h1>
            <p>Список депозитов, созданных пользователями Spotlight</p>
          </div>
          <div className="deposits-header-actions">
            <button className="deposits-subtle-button" onClick={() => navigate('/admin')}>
              ← К админ-панели
            </button>
            <button className="deposits-subtle-button" onClick={() => navigate('/withdrawals')}>
              Заявки на вывод
            </button>
            <button className="deposits-primary-button" onClick={() => navigate('/topup')}>
              Пополнить
            </button>
          </div>
        </div>

        <div className="deposits-actions">
          <input
            className="deposits-search"
            type="search"
            placeholder="Поиск по email"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <button className="deposits-subtle-button" onClick={fetchDeposits} disabled={loading}>
            Обновить
          </button>
        </div>

        {error && <div className="deposits-error">{error}</div>}

        <div className="deposits-content">
          {loading ? (
            <div className="deposits-loading">Загрузка...</div>
          ) : filteredDeposits.length === 0 ? (
            <div className="deposits-empty">Депозиты не найдены</div>
          ) : (
            <div className="deposits-grid">
              {filteredDeposits.map((deposit, index) => (
                <div className="deposits-card-item" key={`${deposit.email}-${deposit.created_at ?? index}`}>
                  <div className="deposits-card-section">
                    <span className="deposits-card-label">Email</span>
                    <span className="deposits-card-value">{deposit.email}</span>
                  </div>
                  <div className="deposits-card-section">
                    <span className="deposits-card-label">Сумма</span>
                    <span className="deposits-card-value">{deposit.amount ?? '—'} USDT</span>
                  </div>
                  <div className="deposits-card-section">
                    <span className="deposits-card-label">Создано</span>
                    <span className="deposits-card-value">{formatDate(deposit.created_at)}</span>
                  </div>
                  <button
                    className="deposits-action-button"
                    type="button"
                    onClick={() => openBalanceModal(deposit.email)}
                  >
                    Изменить баланс
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {balanceModalOpen && (
        <div className="balance-modal-overlay" onClick={closeBalanceModal}>
          <div className="balance-modal" onClick={(event) => event.stopPropagation()}>
            <div className="balance-modal-header">
              <h2>Изменить баланс</h2>
              <button className="balance-close" type="button" onClick={closeBalanceModal}>
                ×
              </button>
            </div>
            <p className="balance-email">{balanceEmail}</p>
            <form className="balance-form" onSubmit={handleBalanceSubmit}>
              <label htmlFor="balanceInput">Баланс (USDT)</label>
              <input
                id="balanceInput"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Введите баланс"
                value={balanceInput}
                onChange={(event) => setBalanceInput(event.target.value)}
                disabled={balanceLoading}
              />
              {balanceError && <p className="balance-error">{balanceError}</p>}
              {balanceStatus && <p className="balance-success">{balanceStatus}</p>}
              <button type="submit" className="balance-submit" disabled={balanceLoading}>
                {balanceLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DepositsPage
