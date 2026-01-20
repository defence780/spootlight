import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Pencil, Check, X, RefreshCw, RotateCcw, DollarSign, Search, Circle } from 'lucide-react'
import './WorkerUsersPage.css'

const STORAGE_KEY = 'spotlight_user'

interface StoredUser {
  email: string
  type?: string
}

interface WorkerUser {
  id: number
  created_at?: string
  chat_id?: string | number
  isAdmin?: boolean
  username?: string | null
  first_name?: string | null
  ref_id?: string | number | null
  balance?: number | string | null
  auto_win?: boolean | null
  is_trading_enable?: boolean
  spam?: boolean
  usdt_amount?: number | string | null
  rub_amount?: number | string | null
  verification_on?: boolean
  verification_needed?: boolean
  is_message_sending?: boolean
  comment?: string | null
  panel_disabled?: boolean
  worker_comment?: string | null
  trades?: Trade[]
  withdraws?: Withdraw[]
  deposits?: Deposit[]
}

interface Trade {
  id: number
  chat_id?: string | number
  created_at?: string
  amount?: number | string | null
  isActive?: boolean
  [key: string]: any
}

interface Withdraw {
  id: number
  chat_id?: string | number
  created_at?: string
  amount?: number | string | null
  status?: string | null
  isDone?: boolean
  network?: string | null
  address?: string | null
  [key: string]: any
}

interface Deposit {
  id: number
  chat_id?: string | number
  created_at?: string
  url?: string | null
  amount?: number | string | null
  currency?: string | null
  isPayed?: boolean
  [key: string]: any
}

const WorkerUsersPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { chatId } = useParams<{ chatId: string }>()
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<WorkerUser[]>([])
  const [workerInfo, setWorkerInfo] = useState<WorkerUser | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, { trades?: boolean; withdraws?: boolean; deposits?: boolean }>>({})
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
  const [editingField, setEditingField] = useState<{ userId: number; field: 'usdt_amount' | 'rub_amount' } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [savingField, setSavingField] = useState<{ userId: number; field: 'usdt_amount' | 'rub_amount' } | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [updatingSection, setUpdatingSection] = useState<{ userId: number; section: 'trades' | 'withdraws' | 'deposits' } | null>(null)
  const [updatingField, setUpdatingField] = useState<{ userId: number; field: string } | null>(null)
  const [returningWithdrawId, setReturningWithdrawId] = useState<number | null>(null)
  const [processingDepositId, setProcessingDepositId] = useState<number | null>(null)
  const [closingTradeId, setClosingTradeId] = useState<number | null>(null)
  const [updatingAutoWin, setUpdatingAutoWin] = useState<number | null>(null)
  const [sendingVerification, setSendingVerification] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [confirmSendTPModalOpen, setConfirmSendTPModalOpen] = useState(false)
  const [pendingTPUser, setPendingTPUser] = useState<{ userId: number; chatId: string | number } | null>(null)
  const fromTab = (location.state as { fromTab?: string } | null)?.fromTab

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

  const fetchWorkerUsers = async () => {
    if (!chatId) return

    setLoading(true)
    setError(null)
    try {
      // Отримуємо інформацію про воркера
      const { data: workerData, error: workerError } = await supabase
        .from('users')
        .select('id, chat_id, username, first_name, worker_comment')
        .eq('chat_id', chatId)
        .not('worker_comment', 'is', null)
        .maybeSingle()

      if (workerError) {
        console.error('Ошибка загрузки воркера', workerError)
      } else {
        setWorkerInfo(workerData)
      }

      // Отримуємо користувачів воркера
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, created_at, chat_id, isAdmin, username, first_name, ref_id, balance, auto_win, is_trading_enable, spam, usdt_amount, rub_amount, verification_on, verification_needed, is_message_sending, comment, panel_disabled, worker_comment')
        .eq('ref_id', chatId)
        .order('created_at', { ascending: false, nullsFirst: false })

      if (fetchError) {
        console.error('Supabase error:', fetchError)
        throw fetchError
      }

      const usersData = data || []

      // Завантажуємо трейди, виводи та депозити для кожного користувача
      const usersWithData = await Promise.all(
        usersData.map(async (user) => {
          if (!user.chat_id) {
            return { ...user, trades: [], withdraws: [], deposits: [] }
          }

          const [tradesResult, withdrawsResult, depositsResult] = await Promise.all([
            supabase
              .from('trades')
              .select('*')
              .eq('chat_id', user.chat_id)
              .order('created_at', { ascending: false }),
            supabase
              .from('withdraws')
              .select('*')
              .eq('chat_id', user.chat_id)
              .order('created_at', { ascending: false }),
            supabase
              .from('invoices')
              .select('*')
              .eq('chat_id', user.chat_id)
              .order('created_at', { ascending: false })
          ])

          return {
            ...user,
            trades: tradesResult.data || [],
            withdraws: withdrawsResult.data || [],
            deposits: depositsResult.data || []
          }
        })
      )

      setUsers(usersWithData)
    } catch (err: any) {
      console.error('Ошибка загрузки пользователей воркера', err)
      setError(err.message || 'Не удалось загрузить пользователей.')
    } finally {
      setLoading(false)
    }
  }

  const updateUserData = async (userId: number, chatId: string | number) => {
    setUpdatingUserId(userId)
    setError(null)

    try {
      // Оновлюємо дані користувача з таблиці users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('chat_id', chatId)
        .single()

      if (userError) {
        console.error('Ошибка загрузки данных пользователя', userError)
      }

      // Оновлюємо трейди, виводи та депозити
      const [tradesResult, withdrawsResult, depositsResult] = await Promise.all([
        supabase
          .from('trades')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false }),
        supabase
          .from('withdraws')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
      ])

      if (tradesResult.error) {
        console.error('Ошибка загрузки трейдов', tradesResult.error)
      }
      if (withdrawsResult.error) {
        console.error('Ошибка загрузки виводов', withdrawsResult.error)
      }
      if (depositsResult.error) {
        console.error('Ошибка загрузки депозитов', depositsResult.error)
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...(userData || user),
                id: userId,
                trades: tradesResult.data || [],
                withdraws: withdrawsResult.data || [],
                deposits: depositsResult.data || []
              }
            : user
        )
      )
    } catch (err: any) {
      console.error('Ошибка обновления данных пользователя', err)
      setError(err.message || 'Не удалось обновить данные пользователя.')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const startEditing = (userId: number, field: 'usdt_amount' | 'rub_amount', currentValue: number | string | null) => {
    setEditingField({ userId, field })
    setEditValue(currentValue ? String(currentValue) : '0.00')
  }

  const cancelEditing = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveBalance = async (userId: number, field: 'usdt_amount' | 'rub_amount') => {
    const user = users.find((u) => u.id === userId)
    if (!user || !user.chat_id) return

    const numericValue = parseFloat(editValue.replace(',', '.'))
    if (Number.isNaN(numericValue)) {
      setError('Введіть коректне числове значення.')
      setSuccessMessage(null)
      return
    }

    setSavingField({ userId, field })
    setError(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase
        .from('users')
        .update({ [field]: numericValue })
        .eq('chat_id', user.chat_id)

      if (error) throw error

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                [field]: numericValue
              }
            : u
        )
      )

      const fieldName = field === 'usdt_amount' ? 'USDT' : 'RUB'
      setSuccessMessage(`Баланс ${fieldName} успішно змінено!`)
      setEditingField(null)
      setEditValue('')

      // Автоматично приховати повідомлення через 3 секунди
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Ошибка обновления баланса', err)
      setError(err.message || 'Не удалось обновить баланс.')
      setSuccessMessage(null)
    } finally {
      setSavingField(null)
    }
  }

  const updateSection = async (userId: number, chatId: string | number, section: 'trades' | 'withdraws' | 'deposits') => {
    setUpdatingSection({ userId, section })
    setError(null)

    try {
      const tableName = section === 'trades' ? 'trades' : section === 'withdraws' ? 'withdraws' : 'invoices'
      const { data, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error(`Ошибка загрузки ${section}`, fetchError)
        throw fetchError
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                [section]: data || []
              }
            : user
        )
      )

      const sectionName = section === 'trades' ? 'Трейди' : section === 'withdraws' ? 'Виводи' : 'Депозити'
      setSuccessMessage(`${sectionName} успішно оновлено!`)
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error(`Ошибка обновления ${section}`, err)
      setError(err.message || `Не удалось обновить ${section}.`)
    } finally {
      setUpdatingSection(null)
    }
  }

  const updateUserField = async (userId: number, chatId: string | number, field: 'is_trading_enable' | 'verification_on' | 'verification_needed', value: boolean) => {
    setUpdatingField({ userId, field })
    setError(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase
        .from('users')
        .update({ [field]: value })
        .eq('chat_id', chatId)

      if (error) throw error

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                [field]: value
              }
            : u
        )
      )

      const fieldNames: Record<string, string> = {
        is_trading_enable: 'Трейдинг дозволено',
        verification_on: 'Показати верифікацію',
        verification_needed: 'Потрібна верифікація'
      }
      const action = value ? 'увімкнено' : 'вимкнено'
      setSuccessMessage(`${fieldNames[field]} ${action}!`)

      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Ошибка обновления поля', err)
      setError(err.message || 'Не удалось обновить поле.')
      setSuccessMessage(null)
    } finally {
      setUpdatingField(null)
    }
  }

  const returnWithdraw = async (userId: number, chatId: string | number, withdrawId: number, amount: number | string | null, currency?: string | null) => {
    setReturningWithdrawId(withdrawId)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!amount || Number.isNaN(Number(amount))) {
        throw new Error('Некоректна сума виводу')
      }

      const withdrawAmount = Number(amount)
      const currencyUpper = currency?.toUpperCase() || 'RUB'

      // Відправляємо запит на Supabase Edge Function
      const { error: functionError } = await supabase.functions.invoke('logic', {
        body: {
          chat_id: chatId,
          type: 'withdrawal_return',
          amount: withdrawAmount,
          currency: currencyUpper
        }
      })

      if (functionError) {
        throw functionError
      }

      // Отримуємо поточний баланс користувача
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('rub_amount')
        .eq('chat_id', chatId)
        .single()

      if (userError) throw userError

      const currentRubAmount = Number(userData?.rub_amount || 0)
      const newRubAmount = currentRubAmount + withdrawAmount

      // Оновлюємо баланс користувача та статус виводу
      const [updateUserResult, updateWithdrawResult] = await Promise.all([
        supabase
          .from('users')
          .update({ rub_amount: newRubAmount })
          .eq('chat_id', chatId),
        supabase
          .from('withdraws')
          .update({ isDone: true })
          .eq('id', withdrawId)
      ])

      if (updateUserResult.error) throw updateUserResult.error
      if (updateWithdrawResult.error) throw updateWithdrawResult.error

      // Оновлюємо локальний стан
      setUsers((prev) =>
        prev.map((user) => {
          if (user.id === userId) {
            return {
              ...user,
              rub_amount: newRubAmount,
              withdraws: user.withdraws?.map((w) =>
                w.id === withdrawId ? { ...w, isDone: true } : w
              ) || []
            }
          }
          return user
        })
      )

      setSuccessMessage(`Кошти успішно повернено на баланс користувача!`)
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Ошибка возврата вывода', err)
      setError(err.message || 'Не удалось вернуть средства.')
      setSuccessMessage(null)
    } finally {
      setReturningWithdrawId(null)
    }
  }

  const processDeposit = async (userId: number, chatId: string | number, depositId: number, amount: number | string | null, currency: string | null) => {
    setProcessingDepositId(depositId)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!amount || Number.isNaN(Number(amount))) {
        throw new Error('Некоректна сума депозиту')
      }

      const depositAmount = Number(amount)
      const currencyUpper = currency?.toUpperCase() || 'RUB'

      // Відправляємо запит на Supabase Edge Function
      const { error: functionError } = await supabase.functions.invoke('logic', {
        body: {
          chat_id: chatId,
          type: 'deposit',
          amount: depositAmount,
          currency: currencyUpper
        }
      })

      if (functionError) {
        throw functionError
      }

      // Отримуємо поточний баланс користувача
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('rub_amount, usdt_amount')
        .eq('chat_id', chatId)
        .single()

      if (userError) throw userError

      // Визначаємо поле для оновлення залежно від валюти
      const isUSDT = currencyUpper === 'USDT' || currencyUpper === 'USD'
      const currentBalance = isUSDT ? Number(userData?.usdt_amount || 0) : Number(userData?.rub_amount || 0)
      const newBalance = currentBalance + depositAmount

      const updateData = isUSDT
        ? { usdt_amount: newBalance }
        : { rub_amount: newBalance }

      // Оновлюємо баланс користувача та статус депозиту
      const [updateUserResult, updateDepositResult] = await Promise.all([
        supabase
          .from('users')
          .update(updateData)
          .eq('chat_id', chatId),
        supabase
          .from('invoices')
          .update({ isPayed: true })
          .eq('id', depositId)
      ])

      if (updateUserResult.error) throw updateUserResult.error
      if (updateDepositResult.error) throw updateDepositResult.error

      // Оновлюємо локальний стан
      setUsers((prev) =>
        prev.map((user) => {
          if (user.id === userId) {
            return {
              ...user,
              ...updateData,
              deposits: user.deposits?.map((d) =>
                d.id === depositId ? { ...d, isPayed: true } : d
              ) || []
            }
          }
          return user
        })
      )

      const currencyName = isUSDT ? 'USDT' : 'RUB'
      setSuccessMessage(`Кошти успішно зараховано на баланс ${currencyName}!`)
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Ошибка обработки депозита', err)
      setError(err.message || 'Не удалось зачислить средства.')
      setSuccessMessage(null)
    } finally {
      setProcessingDepositId(null)
    }
  }

  const closeTrade = async (userId: number, chatId: string | number, tradeId: number, amount: number | string | null, isWin: boolean) => {
    setClosingTradeId(tradeId)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!amount || Number.isNaN(Number(amount))) {
        throw new Error('Некоректна сума трейду')
      }

      const tradeAmount = Number(amount)
      let bonusAmount = 0
      let totalAmount = tradeAmount

      if (isWin) {
        // Якщо виграш - додаємо бонус 75%
        bonusAmount = tradeAmount * 0.75
        totalAmount = tradeAmount + bonusAmount
      }
      // Якщо програш - totalAmount залишається рівним tradeAmount (повертаємо тільки початкову суму)

      // Отримуємо поточний баланс користувача
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('usdt_amount')
        .eq('chat_id', chatId)
        .single()

      if (userError) throw userError

      const currentUsdtAmount = Number(userData?.usdt_amount || 0)
      const newUsdtAmount = currentUsdtAmount + totalAmount

      // Оновлюємо баланс користувача та статус трейду
      const [updateUserResult, updateTradeResult] = await Promise.all([
        supabase
          .from('users')
          .update({ usdt_amount: newUsdtAmount })
          .eq('chat_id', chatId),
        supabase
          .from('trades')
          .update({ isActive: false, isWin: isWin })
          .eq('id', tradeId)
      ])

      if (updateUserResult.error) throw updateUserResult.error
      if (updateTradeResult.error) throw updateTradeResult.error

      // Оновлюємо локальний стан
      setUsers((prev) =>
        prev.map((user) => {
          if (user.id === userId) {
            return {
              ...user,
              usdt_amount: newUsdtAmount,
              trades: user.trades?.map((t) =>
                t.id === tradeId ? { ...t, isActive: false, isWin: isWin } : t
              ) || []
            }
          }
          return user
        })
      )

      if (isWin) {
        setSuccessMessage(`Трейд успішно закрито як виграш! Нараховано ${totalAmount.toFixed(2)} USDT (${tradeAmount.toFixed(2)} + бонус ${bonusAmount.toFixed(2)})`)
      } else {
        setSuccessMessage(`Трейд успішно закрито як програш. Повернуто ${totalAmount.toFixed(2)} USDT`)
      }
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Ошибка закрытия трейда', err)
      setError(err.message || 'Не удалось закрыть трейд.')
      setSuccessMessage(null)
    } finally {
      setClosingTradeId(null)
    }
  }

  const updateAutoWin = async (userId: number, chatId: string | number, newValue: boolean | null) => {
    setUpdatingAutoWin(userId)
    setError(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase
        .from('users')
        .update({ auto_win: newValue })
        .eq('chat_id', chatId)

      if (error) throw error

      // Оновлюємо локальний стан
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId
            ? { ...user, auto_win: newValue }
            : user
        )
      )

      const statusText = newValue === true ? 'Перемога' : newValue === false ? 'Програш' : 'Казино'
      setSuccessMessage(`Статус auto_win успішно змінено на "${statusText}"`)
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Ошибка обновления auto_win', err)
      setError(err.message || 'Не удалось обновить auto_win.')
      setSuccessMessage(null)
    } finally {
      setUpdatingAutoWin(null)
    }
  }

  const sendVerification = async (userId: number, chatId: string | number, workerChatId: string | number) => {
    setSendingVerification(userId)
    setError(null)
    setSuccessMessage(null)
    setConfirmSendTPModalOpen(false)
    setPendingTPUser(null)

    try {
      const { error } = await supabase.functions.invoke('logic', {
        body: {
          chat_id: chatId,
          ref_id: workerChatId,
          type: 'verification'
        }
      })

      if (error) {
        throw error
      }

      setSuccessMessage('ТП успішно відправлено!')
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Ошибка отправки ТП', err)
      setError(err.message || 'Не удалось отправить ТП.')
      setSuccessMessage(null)
    } finally {
      setSendingVerification(null)
    }
  }

  const handleConfirmSendTP = () => {
    if (pendingTPUser && chatId) {
      sendVerification(pendingTPUser.userId, pendingTPUser.chatId, chatId)
    }
  }

  const handleCancelSendTP = () => {
    setConfirmSendTPModalOpen(false)
    setPendingTPUser(null)
  }

  useEffect(() => {
    if (!initialized || !chatId) return
    fetchWorkerUsers()
  }, [initialized, chatId])

  if (!initialized) {
    return null
  }

  return (
    <div className="worker-users-page">
      <div className="worker-users-card">
        <div className="worker-users-header">
          <div>
            <h1>Користувачі воркера</h1>
            {workerInfo && (
              <p>
                {workerInfo.first_name || 'Воркер'} {workerInfo.username && `(@${workerInfo.username})`}
              </p>
            )}
          </div>
          <div className="worker-users-actions">
            <button className="worker-users-back" onClick={() => navigate(`/admin/trading/${fromTab || 'workers'}`)}>
              ← Назад до Trading
            </button>
          </div>
        </div>

        {error && <div className="worker-users-error">{error}</div>}
        {successMessage && <div className="worker-users-success">{successMessage}</div>}

        <div className="worker-users-search-wrapper">
          <div className="worker-users-search">
            <Search size={20} className="worker-users-search-icon" />
            <input
              type="text"
              className="worker-users-search-input"
              placeholder="Пошук за username, ім'ям або chat_id..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="worker-users-search-clear"
                onClick={() => setSearchQuery('')}
                title="Очистити пошук"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="worker-users-content">
          {loading ? (
            <div className="worker-users-loading">Загрузка...</div>
          ) : users.length === 0 ? (
            <div className="worker-users-empty">
              <p>Користувачі не знайдені</p>
            </div>
          ) : (
            <div className="worker-users-grid">
              {users
                .filter((user) => {
                  if (!searchQuery.trim()) return true
                  const query = searchQuery.toLowerCase().trim()
                  const username = user.username?.toLowerCase() || ''
                  const firstName = user.first_name?.toLowerCase() || ''
                  const chatId = String(user.chat_id || '').toLowerCase()
                  return username.includes(query) || firstName.includes(query) || chatId.includes(query)
                })
                .map((user) => (
                <div key={user.id} className="worker-users-card-item">
                  <div className="worker-users-card-header">
                    <div className="worker-users-card-header-info">
                      <h3 className="worker-users-card-user-name">
                        {user.first_name || 'Користувач'} {user.username && `(@${user.username})`}
                      </h3>
                    </div>
                    <button
                      className="worker-users-refresh-btn"
                      onClick={() => user.chat_id && updateUserData(user.id, user.chat_id)}
                      disabled={updatingUserId === user.id}
                      title="Оновити дані користувача"
                    >
                      {updatingUserId === user.id ? 'Оновлення...' : 'Оновити'}
                    </button>
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">Ім'я</span>
                    <span className="worker-users-card-value">{user.first_name || '—'}</span>
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">Username</span>
                    <span className="worker-users-card-value">{user.username ? `@${user.username}` : '—'}</span>
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">Chat ID</span>
                    <span className="worker-users-card-value">{user.chat_id || '—'}</span>
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">USDT</span>
                    {editingField?.userId === user.id && editingField?.field === 'usdt_amount' ? (
                      <div className="worker-users-edit-wrapper">
                        <input
                          type="number"
                          step="0.01"
                          className="worker-users-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                        />
                        <button
                          className="worker-users-edit-btn worker-users-edit-btn--save"
                          onClick={() => saveBalance(user.id, 'usdt_amount')}
                          disabled={savingField?.userId === user.id && savingField?.field === 'usdt_amount'}
                          title="Зберегти"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="worker-users-edit-btn worker-users-edit-btn--cancel"
                          onClick={cancelEditing}
                          disabled={savingField?.userId === user.id && savingField?.field === 'usdt_amount'}
                          title="Відмінити"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="worker-users-value-wrapper">
                        <span className="worker-users-card-value">
                          {user.usdt_amount ? `${Number(user.usdt_amount).toFixed(2)}` : '0.00'}
                        </span>
                        <button
                          className="worker-users-edit-icon-btn"
                          onClick={() => startEditing(user.id, 'usdt_amount', user.usdt_amount ?? null)}
                          disabled={savingField?.userId === user.id && savingField?.field === 'usdt_amount'}
                          title="Редагувати USDT"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">RUB</span>
                    {editingField?.userId === user.id && editingField?.field === 'rub_amount' ? (
                      <div className="worker-users-edit-wrapper">
                        <input
                          type="number"
                          step="0.01"
                          className="worker-users-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                        />
                        <button
                          className="worker-users-edit-btn worker-users-edit-btn--save"
                          onClick={() => saveBalance(user.id, 'rub_amount')}
                          disabled={savingField?.userId === user.id && savingField?.field === 'rub_amount'}
                          title="Зберегти"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="worker-users-edit-btn worker-users-edit-btn--cancel"
                          onClick={cancelEditing}
                          disabled={savingField?.userId === user.id && savingField?.field === 'rub_amount'}
                          title="Відмінити"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="worker-users-value-wrapper">
                        <span className="worker-users-card-value">
                          {user.rub_amount ? `${Number(user.rub_amount).toFixed(2)}` : '0.00'}
                        </span>
                        <button
                          className="worker-users-edit-icon-btn"
                          onClick={() => startEditing(user.id, 'rub_amount', user.rub_amount ?? null)}
                          disabled={savingField?.userId === user.id && savingField?.field === 'rub_amount'}
                          title="Редагувати RUB"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">Трейдинг дозволено</span>
                    <div className="worker-users-toggle-wrapper">
                      <span className={`worker-users-badge ${user.is_trading_enable ? 'worker-users-badge--enabled' : 'worker-users-badge--disabled'}`}>
                        {user.is_trading_enable ? 'Так' : 'Ні'}
                      </span>
                      {user.chat_id && (
                        <button
                          className="worker-users-toggle-btn"
                          onClick={() => {
                            if (user.chat_id) {
                              updateUserField(user.id, user.chat_id, 'is_trading_enable', !user.is_trading_enable)
                            }
                          }}
                          disabled={updatingField?.userId === user.id && updatingField?.field === 'is_trading_enable'}
                          title={user.is_trading_enable ? 'Вимкнути трейдинг' : 'Увімкнути трейдинг'}
                        >
                          {updatingField?.userId === user.id && updatingField?.field === 'is_trading_enable' ? (
                            <RefreshCw size={14} className="spinning" />
                          ) : (
                            <Pencil size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">Показати верифікацію</span>
                    <div className="worker-users-toggle-wrapper">
                      <span className={`worker-users-badge ${user.verification_on ? 'worker-users-badge--enabled' : 'worker-users-badge--disabled'}`}>
                        {user.verification_on ? 'Увімкнено' : 'Вимкнено'}
                      </span>
                      {user.chat_id && (
                        <button
                          className="worker-users-toggle-btn"
                          onClick={() => {
                            if (user.chat_id) {
                              updateUserField(user.id, user.chat_id, 'verification_on', !user.verification_on)
                            }
                          }}
                          disabled={updatingField?.userId === user.id && updatingField?.field === 'verification_on'}
                          title={user.verification_on ? 'Вимкнути показ верифікації' : 'Увімкнути показ верифікації'}
                        >
                          {updatingField?.userId === user.id && updatingField?.field === 'verification_on' ? (
                            <RefreshCw size={14} className="spinning" />
                          ) : (
                            <Pencil size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">Потрібна верифікація</span>
                    <div className="worker-users-toggle-wrapper">
                      <span className={`worker-users-badge ${user.verification_needed ? 'worker-users-badge--enabled' : 'worker-users-badge--disabled'}`}>
                        {user.verification_needed ? 'Потрібно' : 'Не потрібно'}
                      </span>
                      {user.chat_id && (
                        <button
                          className="worker-users-toggle-btn"
                          onClick={() => {
                            if (user.chat_id) {
                              updateUserField(user.id, user.chat_id, 'verification_needed', !user.verification_needed)
                            }
                          }}
                          disabled={updatingField?.userId === user.id && updatingField?.field === 'verification_needed'}
                          title={user.verification_needed ? 'Вимкнути потребу верифікації' : 'Увімкнути потребу верифікації'}
                        >
                          {updatingField?.userId === user.id && updatingField?.field === 'verification_needed' ? (
                            <RefreshCw size={14} className="spinning" />
                          ) : (
                            <Pencil size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">Auto Win</span>
                    <div className="worker-users-is-win-wrapper">
                      {(() => {
                        const getAutoWinStatus = (autoWin: boolean | null | undefined) => {
                          if (autoWin === true) return { icon: <Check size={16} />, text: 'Перемога', color: '#22c55e' }
                          if (autoWin === false) return { icon: <X size={16} />, text: 'Програш', color: '#ef4444' }
                          return { icon: <Circle size={16} />, text: 'Казино', color: '#eab308' }
                        }
                        const autoWinStatus = getAutoWinStatus(user.auto_win ?? null)
                        return (
                          <button
                            className="worker-users-is-win-btn"
                            onClick={() => {
                              if (user.chat_id) {
                                const currentValue = user.auto_win ?? null
                                let newValue: boolean | null = null
                                if (currentValue === null) newValue = true
                                else if (currentValue === true) newValue = false
                                else newValue = null
                                updateAutoWin(user.id, user.chat_id, newValue)
                              }
                            }}
                            disabled={updatingAutoWin === user.id}
                            style={{ color: autoWinStatus.color }}
                            title={`Змінити статус: ${autoWinStatus.text}`}
                          >
                            {updatingAutoWin === user.id ? (
                              <RefreshCw size={16} className="spinning" />
                            ) : (
                              autoWinStatus.icon
                            )}
                            <span>{autoWinStatus.text}</span>
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="worker-users-card-section">
                    <span className="worker-users-card-label">Створено</span>
                    <span className="worker-users-card-value">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleString('uk-UA')
                        : '—'}
                    </span>
                  </div>
                  {user.chat_id && (
                    <div className="worker-users-card-section">
                      <button
                        className="worker-users-action-btn"
                        onClick={() => navigate(`/admin/trading/messages/${user.chat_id}`, { state: { fromTab: fromTab || 'messages' } })}
                        title="Написати повідомлення"
                        type="button"
                      >
                        Написати повідомлення
                      </button>
                      <button
                        className="worker-users-action-btn worker-users-action-btn--primary"
                        onClick={() => {
                          if (user.chat_id && chatId) {
                            setPendingTPUser({ userId: user.id, chatId: user.chat_id })
                            setConfirmSendTPModalOpen(true)
                          }
                        }}
                        disabled={sendingVerification === user.id}
                        title="Відправити ТП"
                      >
                        {sendingVerification === user.id ? (
                          <>
                            <RefreshCw size={16} className="spinning" />
                            <span>Відправка...</span>
                          </>
                        ) : (
                          <>
                            <span>Відправити ТП</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Трейди */}
                  <div className="worker-users-subsection">
                    <div className="worker-users-subsection-header-wrapper">
                      <button
                        className="worker-users-subsection-header"
                        onClick={() => {
                          setExpandedSections((prev) => ({
                            ...prev,
                            [user.id]: {
                              ...prev[user.id],
                              trades: !prev[user.id]?.trades
                            }
                          }))
                        }}
                        type="button"
                      >
                        <h3 className="worker-users-subsection-title">
                          Трейди ({user.trades?.length || 0})
                        </h3>
                        <span className="worker-users-subsection-arrow">
                          {expandedSections[user.id]?.trades ? '▲' : '▼'}
                        </span>
                      </button>
                      {user.chat_id && (
                        <button
                          className="worker-users-subsection-refresh-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (user.chat_id) {
                              updateSection(user.id, user.chat_id, 'trades')
                            }
                          }}
                          disabled={updatingSection?.userId === user.id && updatingSection?.section === 'trades'}
                          title="Оновити трейди"
                        >
                          <RefreshCw
                            size={16}
                            className={updatingSection?.userId === user.id && updatingSection?.section === 'trades' ? 'spinning' : ''}
                          />
                        </button>
                      )}
                    </div>
                    {expandedSections[user.id]?.trades && (
                      <div className="worker-users-subsection-content">
                        {user.trades && user.trades.length > 0 ? (
                          <div className="worker-users-subsection-grid">
                            {user.trades.map((trade) => {
                              const fieldLabels: Record<string, string> = {
                                token: 'Токен',
                                amount: 'Сума',
                                isActive: 'Активний',
                                isWin: 'Виграш',
                                duration: 'Тривалість',
                                trade_type: 'Тип трейду',
                                created_at: 'Створено',
                                updated_at: 'Оновлено'
                              }

                              return (
                                <div key={trade.id} className="worker-users-subsection-card">
                                  {Object.entries(trade).map(([key, value]) => {
                                    if (key === 'id' || key === 'chat_id') return null
                                    const label = fieldLabels[key] || key
                                    let displayValue: string = value !== null && value !== undefined ? String(value) : '—'

                                    // Спеціальна обробка для boolean полів
                                    if (key === 'isActive' || key === 'isWin') {
                                      displayValue = value === true || value === 'true' || String(value).toLowerCase() === 'true' ? 'Так' : 'Ні'
                                    }

                                    return (
                                      <div key={key} className="worker-users-subsection-item">
                                        <span className="worker-users-subsection-label">{label}:</span>
                                        <span className="worker-users-subsection-value">{displayValue}</span>
                                      </div>
                                    )
                                  })}
                                  {trade.isActive === true && user.chat_id && (
                                    <div className="worker-users-subsection-actions">
                                      <button
                                        className="worker-users-close-trade-btn worker-users-close-trade-btn--win"
                                        onClick={() => {
                                          if (user.chat_id) {
                                            closeTrade(user.id, user.chat_id, trade.id, trade.amount ?? null, true)
                                          }
                                        }}
                                        disabled={closingTradeId === trade.id}
                                        title="Закрити як виграш"
                                      >
                                        {closingTradeId === trade.id ? (
                                          <>
                                            <RefreshCw size={14} className="spinning" />
                                            <span>Закриття...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Check size={14} />
                                            <span>Виграш</span>
                                          </>
                                        )}
                                      </button>
                                      <button
                                        className="worker-users-close-trade-btn worker-users-close-trade-btn--loss"
                                        onClick={() => {
                                          if (user.chat_id) {
                                            closeTrade(user.id, user.chat_id, trade.id, trade.amount ?? null, false)
                                          }
                                        }}
                                        disabled={closingTradeId === trade.id}
                                        title="Закрити як програш"
                                      >
                                        {closingTradeId === trade.id ? (
                                          <>
                                            <RefreshCw size={14} className="spinning" />
                                            <span>Закриття...</span>
                                          </>
                                        ) : (
                                          <>
                                            <X size={14} />
                                            <span>Програш</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="worker-users-subsection-empty">Трейди відсутні</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Виводи */}
                  <div className="worker-users-subsection">
                    <div className="worker-users-subsection-header-wrapper">
                      <button
                        className="worker-users-subsection-header"
                        onClick={() => {
                          setExpandedSections((prev) => ({
                            ...prev,
                            [user.id]: {
                              ...prev[user.id],
                              withdraws: !prev[user.id]?.withdraws
                            }
                          }))
                        }}
                        type="button"
                      >
                        <h3 className="worker-users-subsection-title">
                          Виводи ({user.withdraws?.length || 0})
                        </h3>
                        <span className="worker-users-subsection-arrow">
                          {expandedSections[user.id]?.withdraws ? '▲' : '▼'}
                        </span>
                      </button>
                      {user.chat_id && (
                        <button
                          className="worker-users-subsection-refresh-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (user.chat_id) {
                              updateSection(user.id, user.chat_id, 'withdraws')
                            }
                          }}
                          disabled={updatingSection?.userId === user.id && updatingSection?.section === 'withdraws'}
                          title="Оновити виводи"
                        >
                          <RefreshCw
                            size={16}
                            className={updatingSection?.userId === user.id && updatingSection?.section === 'withdraws' ? 'spinning' : ''}
                          />
                        </button>
                      )}
                    </div>
                    {expandedSections[user.id]?.withdraws && (
                      <div className="worker-users-subsection-content">
                        {user.withdraws && user.withdraws.length > 0 ? (
                          <div className="worker-users-subsection-grid">
                            {user.withdraws.map((withdraw) => {
                              const withdrawFieldLabels: Record<string, string> = {
                                amount: 'Сума',
                                status: 'Статус',
                                network: 'Мережа',
                                address: 'Адреса',
                                isDone: 'Повернено',
                                created_at: 'Створено',
                                updated_at: 'Оновлено'
                              }

                              return (
                                <div key={withdraw.id} className="worker-users-subsection-card">
                                  {Object.entries(withdraw).map(([key, value]) => {
                                    if (key === 'id' || key === 'chat_id') return null
                                    const label = withdrawFieldLabels[key] || key
                                    let displayValue: string = value !== null && value !== undefined ? String(value) : '—'

                                    // Спеціальна обробка для boolean полів
                                    if (key === 'isDone') {
                                      displayValue = value === true || value === 'true' || String(value).toLowerCase() === 'true' ? 'Так' : 'Ні'
                                    }

                                    // Форматування дати
                                    if (key === 'created_at' || key === 'updated_at') {
                                      if (value) {
                                        try {
                                          displayValue = new Date(String(value)).toLocaleString('uk-UA')
                                        } catch {
                                          displayValue = String(value)
                                        }
                                      }
                                    }

                                    return (
                                      <div key={key} className="worker-users-subsection-item">
                                        <span className="worker-users-subsection-label">{label}:</span>
                                        <span className="worker-users-subsection-value">{displayValue}</span>
                                      </div>
                                    )
                                  })}
                                  {user.chat_id && (
                                    <div className="worker-users-subsection-actions">
                                      <button
                                        className="worker-users-return-btn"
                                        onClick={() => {
                                          if (user.chat_id) {
                                            returnWithdraw(user.id, user.chat_id, withdraw.id, withdraw.amount ?? null, withdraw.currency ?? null)
                                          }
                                        }}
                                        disabled={withdraw.isDone === true || returningWithdrawId === withdraw.id}
                                        title={withdraw.isDone ? 'Вивід вже повернено' : 'Повернути кошти на баланс'}
                                      >
                                        {returningWithdrawId === withdraw.id ? (
                                          <>
                                            <RefreshCw size={14} className="spinning" />
                                            <span>Повертаємо...</span>
                                          </>
                                        ) : (
                                          <>
                                            <RotateCcw size={14} />
                                            <span>Повернути</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="worker-users-subsection-empty">Виводи відсутні</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Депозити */}
                  <div className="worker-users-subsection">
                    <div className="worker-users-subsection-header-wrapper">
                      <button
                        className="worker-users-subsection-header"
                        onClick={() => {
                          setExpandedSections((prev) => ({
                            ...prev,
                            [user.id]: {
                              ...prev[user.id],
                              deposits: !prev[user.id]?.deposits
                            }
                          }))
                        }}
                        type="button"
                      >
                        <h3 className="worker-users-subsection-title">
                          Депозити ({user.deposits?.length || 0})
                        </h3>
                        <span className="worker-users-subsection-arrow">
                          {expandedSections[user.id]?.deposits ? '▲' : '▼'}
                        </span>
                      </button>
                      {user.chat_id && (
                        <button
                          className="worker-users-subsection-refresh-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (user.chat_id) {
                              updateSection(user.id, user.chat_id, 'deposits')
                            }
                          }}
                          disabled={updatingSection?.userId === user.id && updatingSection?.section === 'deposits'}
                          title="Оновити депозити"
                        >
                          <RefreshCw
                            size={16}
                            className={updatingSection?.userId === user.id && updatingSection?.section === 'deposits' ? 'spinning' : ''}
                          />
                        </button>
                      )}
                    </div>
                    {expandedSections[user.id]?.deposits && (
                      <div className="worker-users-subsection-content">
                        {user.deposits && user.deposits.length > 0 ? (
                          <div className="worker-users-subsection-grid">
                            {user.deposits.map((deposit) => (
                              <div key={deposit.id} className="worker-users-subsection-card">
                                <div className="worker-users-subsection-item">
                                  <span className="worker-users-subsection-label">URL:</span>
                                  <span className="worker-users-subsection-value">
                                    {deposit.url ? (
                                      <a
                                        href={deposit.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="worker-users-link"
                                      >
                                        {deposit.url}
                                      </a>
                                    ) : (
                                      '—'
                                    )}
                                  </span>
                                </div>
                                <div className="worker-users-subsection-item">
                                  <span className="worker-users-subsection-label">Сума:</span>
                                  <span className="worker-users-subsection-value">
                                    {deposit.amount !== null && deposit.amount !== undefined
                                      ? String(deposit.amount)
                                      : '—'}
                                  </span>
                                </div>
                                <div className="worker-users-subsection-item">
                                  <span className="worker-users-subsection-label">Валюта:</span>
                                  <span className="worker-users-subsection-value">
                                    {deposit.currency || '—'}
                                  </span>
                                </div>
                                <div className="worker-users-subsection-item">
                                  <span className="worker-users-subsection-label">Оплачено:</span>
                                  <span
                                    className={`worker-users-badge ${
                                      deposit.isPayed
                                        ? 'worker-users-badge--enabled'
                                        : 'worker-users-badge--disabled'
                                    }`}
                                  >
                                    {deposit.isPayed ? 'Так' : 'Ні'}
                                  </span>
                                </div>
                                {!deposit.isPayed && user.chat_id && (
                                  <div className="worker-users-subsection-actions">
                                    <button
                                      className="worker-users-process-deposit-btn"
                                      onClick={() => {
                                        if (user.chat_id) {
                                          processDeposit(user.id, user.chat_id, deposit.id, deposit.amount ?? null, deposit.currency ?? null)
                                        }
                                      }}
                                      disabled={processingDepositId === deposit.id}
                                      title="Зарахувати кошти на баланс"
                                    >
                                      {processingDepositId === deposit.id ? (
                                        <>
                                          <RefreshCw size={14} className="spinning" />
                                          <span>Обробка...</span>
                                        </>
                                      ) : (
                                        <>
                                          <DollarSign size={14} />
                                          <span>Зарахувати</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="worker-users-subsection-empty">Депозити відсутні</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Модальне вікно підтвердження відправки ТП */}
      {confirmSendTPModalOpen && (
        <div className="worker-users-modal-overlay" onClick={handleCancelSendTP}>
          <div className="worker-users-modal" onClick={(e) => e.stopPropagation()}>
            <div className="worker-users-modal-header">
              <h2>Підтвердження відправки ТП</h2>
              <button className="worker-users-modal-close" onClick={handleCancelSendTP} type="button">
                ×
              </button>
            </div>
            <div className="worker-users-modal-body">
              <p className="worker-users-modal-message">
                Ви впевнені, що хочете відправити ТП?
              </p>
              <div className="worker-users-modal-actions">
                <button
                  className="worker-users-modal-btn worker-users-modal-btn--cancel"
                  onClick={handleCancelSendTP}
                  type="button"
                >
                  Скасувати
                </button>
                <button
                  className="worker-users-modal-btn worker-users-modal-btn--confirm"
                  onClick={handleConfirmSendTP}
                  type="button"
                  disabled={sendingVerification === pendingTPUser?.userId}
                >
                  {sendingVerification === pendingTPUser?.userId ? 'Відправка...' : 'Підтвердити'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkerUsersPage

