import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NETWORKS, NetworkKey } from '../constants/topupNetworks'
import './WithdrawPage.css'

const STORAGE_KEY = 'spotlight_user'

type SubmitStatus = 'idle' | 'success'
type WithdrawalStatus = 'pending' | 'completed' | 'rejected'

interface WithdrawalHistory {
  id: string
  amount: number | string | null
  address: string | null
  network: string | null
  comment?: string | null
  status: WithdrawalStatus | null
  created_at?: string
}

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

const WithdrawPage = () => {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [currentBalance, setCurrentBalance] = useState<number | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [network, setNetwork] = useState<NetworkKey>('bsc')
  const [comment, setComment] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false)
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const storedUser = window.localStorage.getItem(STORAGE_KEY)
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as { email?: string } | null
        if (parsed?.email) {
          setUserEmail(parsed.email)
          return
        }
      }
    } catch (error) {
      console.error('Не удалось прочитать данные пользователя', error)
    }

    navigate('/', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!userEmail) return

    const fetchBalance = async () => {
      setIsLoadingBalance(true)
      try {
        const { data, error } = await supabase
          .from('spotlights_users')
          .select('balance')
          .eq('email', userEmail)
          .maybeSingle()

        if (error) {
          throw error
        }

        const parsedBalance = parseBalanceValue(data?.balance)
        setCurrentBalance(parsedBalance)
      } catch (err) {
        console.error('Не удалось загрузить баланс пользователя', err)
        setCurrentBalance(null)
      } finally {
        setIsLoadingBalance(false)
      }
    }

    fetchBalance()
  }, [userEmail])

  const fetchWithdrawalHistory = async () => {
    if (!userEmail) return

    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('spotlights_withdrawals')
        .select('id, amount, address, network, comment, status, created_at')
        .eq('email', userEmail)
        .order('created_at', { ascending: false })

      if (error) throw error

      setWithdrawalHistory(data ?? [])
    } catch (err) {
      console.error('Не удалось загрузить историю выводов', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (showHistory && userEmail) {
      fetchWithdrawalHistory()
    }
  }, [showHistory, userEmail])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.withdraw-network-dropdown')) {
        setIsNetworkDropdownOpen(false)
      }
    }

    if (isNetworkDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isNetworkDropdownOpen])

  const resetForm = () => {
    setAmountInput('')
    setWalletAddress('')
    setComment('')
    setStatus('success')
    setTimeout(() => setStatus('idle'), 4000)
  }

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAmountInput(event.target.value)
    if (formError) setFormError(null)
  }

  const handleWalletChange = (event: ChangeEvent<HTMLInputElement>) => {
    setWalletAddress(event.target.value)
    if (formError) setFormError(null)
  }

  const handleCommentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setComment(event.target.value)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userEmail) {
      setFormError('Не удалось определить пользователя. Пожалуйста, войдите снова.')
      return
    }

    const normalizedAmount = amountInput.replace(',', '.').trim()
    if (!normalizedAmount) {
      setFormError('Введите сумму вывода.')
      return
    }

    const amountValue = parseFloat(normalizedAmount)
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setFormError('Введите корректную сумму больше 0.')
      return
    }

    if (currentBalance === null) {
      setFormError('Баланс недоступен. Обновите страницу и попробуйте снова.')
      return
    }

    if (amountValue > currentBalance) {
      setFormError('Сумма вывода превышает доступный баланс.')
      return
    }

    const trimmedAddress = walletAddress.trim()
    if (!trimmedAddress) {
      setFormError('Укажите адрес кошелька для вывода.')
      return
    }

    setFormError(null)
    setSubmitLoading(true)

    try {
      const { error } = await supabase.from('spotlights_withdrawals').insert({
        email: userEmail,
        amount: amountValue,
        address: trimmedAddress,
        network,
        comment: comment.trim() || null,
        status: 'pending'
      })

      if (error) {
        console.error('Ошибка сохранения заявки на вывод', error)
        setFormError('Не удалось отправить заявку. Попробуйте снова позже.')
        return
      }

      const updatedBalance = Number((currentBalance - amountValue).toFixed(2))

      const { error: updateError } = await supabase
        .from('spotlights_users')
        .update({ balance: updatedBalance })
        .eq('email', userEmail)

      if (updateError) {
        console.error('Не удалось обновить баланс пользователя', updateError)
        setFormError('Заявка создана, но не удалось обновить баланс. Попробуйте снова позже.')
      } else {
        setCurrentBalance(updatedBalance)
        try {
          if (typeof window !== 'undefined') {
            const storedRaw = window.localStorage.getItem(STORAGE_KEY)
            if (storedRaw) {
              const parsed = JSON.parse(storedRaw) as { email?: string; balance?: number; [key: string]: any }
              if (parsed?.email === userEmail) {
                const storedUpdated = { ...parsed, balance: updatedBalance }
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedUpdated))
              }
            }
          }
        } catch (storageError) {
          console.error('Не удалось обновить локальный баланс', storageError)
        }
      }

      resetForm()
      // Оновлюємо історію виводів, якщо вона відкрита
      if (showHistory) {
        fetchWithdrawalHistory()
      }
    } catch (submitError) {
      console.error('Неожиданная ошибка при создании заявки на вывод', submitError)
      setFormError('Произошла ошибка. Попробуйте снова позже.')
    } finally {
      setSubmitLoading(false)
    }
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

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString('ru-RU')
    } catch (err) {
      return value
    }
  }

  const formattedBalance =
    currentBalance !== null ? `${currentBalance.toFixed(2)} USDT` : isLoadingBalance ? 'Загрузка...' : '—'

  return (
    <div className="withdraw-page">
      <div className="withdraw-card">
        <div className="withdraw-header">
          <div>
            <h1>Заявка на вывод средств</h1>
            <p>Заполните форму, чтобы отправить заявку администратору платформы</p>
            {userEmail && <span className="withdraw-user">Ваш аккаунт: {userEmail}</span>}
            <span className="withdraw-balance">Доступный баланс: {formattedBalance}</span>
          </div>
          <button className="withdraw-back-button" onClick={() => navigate('/')}>
            ← Назад
          </button>
        </div>

        <form className="withdraw-form" onSubmit={handleSubmit} noValidate>
          <div className="withdraw-field">
            <label htmlFor="withdrawAmount">Сумма вывода</label>
            <div className="withdraw-input-wrapper">
              <input
                id="withdrawAmount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="Например, 150"
                value={amountInput}
                onChange={handleAmountChange}
                disabled={submitLoading}
              />
              <span className="withdraw-suffix">USDT</span>
            </div>
          </div>

          <div className="withdraw-field">
            <label htmlFor="withdrawNetwork">Сеть вывода</label>
            <div className="withdraw-network-dropdown">
              <button
                type="button"
                id="withdrawNetwork"
                className="withdraw-network-button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsNetworkDropdownOpen(!isNetworkDropdownOpen)
                }}
                disabled={submitLoading}
                title="Выберите сеть вывода"
              >
                <span>{NETWORKS[network].label}</span>
                <span className="withdraw-network-arrow">{isNetworkDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {isNetworkDropdownOpen && (
                <div className="withdraw-network-dropdown-list">
                {Object.entries(NETWORKS).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className={`withdraw-network-option ${
                        key === network ? 'withdraw-network-option--active' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setNetwork(key as NetworkKey)
                        setIsNetworkDropdownOpen(false)
                      }}
                    >
                    {value.label}
                    </button>
                ))}
              </div>
              )}
            </div>
          </div>

          <div className="withdraw-field">
            <label htmlFor="withdrawAddress">Адрес для получения</label>
            <input
              id="withdrawAddress"
              type="text"
              placeholder="Укажите адрес кошелька"
              value={walletAddress}
              onChange={handleWalletChange}
              disabled={submitLoading}
            />
            <p className="withdraw-hint">
              Убедитесь, что адрес соответствует выбранной сети. Отправка на неверный адрес может привести к потере
              средств.
            </p>
          </div>

          <div className="withdraw-field">
            <label htmlFor="withdrawComment">Комментарий (необязательно)</label>
            <textarea
              id="withdrawComment"
              placeholder="Дополнительные инструкции или реквизиты"
              value={comment}
              onChange={handleCommentChange}
              rows={3}
              disabled={submitLoading}
            />
          </div>

          {formError && <div className="withdraw-error">{formError}</div>}
          {status === 'success' && (
            <div className="withdraw-success">Заявка отправлена.</div>
          )}

          <div className="withdraw-actions">
            <button type="submit" className="withdraw-primary-button" disabled={submitLoading}>
              {submitLoading ? 'Отправка...' : 'Отправить заявку'}
            </button>
          </div>
        </form>

        <div className="withdraw-history-section">
          <button
            type="button"
            className="withdraw-history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            <span>{showHistory ? '▼' : '▶'}</span>
            <span>История выводов</span>
          </button>

          {showHistory && (
            <div className="withdraw-history-content">
              {historyLoading ? (
                <div className="withdraw-history-loading">Загрузка...</div>
              ) : withdrawalHistory.length === 0 ? (
                <div className="withdraw-history-empty">История выводов пуста</div>
              ) : (
                <div className="withdraw-history-list">
                  {withdrawalHistory.map((item) => {
                    const amount = parseBalanceValue(item.amount)
                    const networkKey = item.network
                      ? (Object.keys(NETWORKS).find(
                          (key) => key.toLowerCase() === item.network?.toLowerCase()
                        ) as NetworkKey | undefined)
                      : null
                    const networkLabel = networkKey ? NETWORKS[networkKey].label : item.network?.toUpperCase() || '—'

                    return (
                      <div key={item.id} className="withdraw-history-item">
                        <div className="withdraw-history-row">
                          <span className="withdraw-history-label">Сумма:</span>
                          <span className="withdraw-history-value">
                            {amount !== null ? `${amount.toFixed(2)} USDT` : '—'}
                          </span>
                        </div>
                        <div className="withdraw-history-row">
                          <span className="withdraw-history-label">Сеть:</span>
                          <span className="withdraw-history-value">{networkLabel}</span>
                        </div>
                        <div className="withdraw-history-row">
                          <span className="withdraw-history-label">Адрес:</span>
                          <span className="withdraw-history-value withdraw-history-address">
                            {item.address ?? '—'}
                          </span>
                        </div>
                        {item.comment && (
                          <div className="withdraw-history-row">
                            <span className="withdraw-history-label">Комментарий:</span>
                            <span className="withdraw-history-value">{item.comment}</span>
                          </div>
                        )}
                        <div className="withdraw-history-row">
                          <span className="withdraw-history-label">Статус:</span>
                          <span
                            className={`withdraw-history-status withdraw-history-status--${item.status ?? 'pending'}`}
                          >
                            {formatStatus(item.status ?? 'pending')}
                          </span>
                        </div>
                        <div className="withdraw-history-row">
                          <span className="withdraw-history-label">Дата:</span>
                          <span className="withdraw-history-value">{formatDate(item.created_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WithdrawPage

