import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { X, RotateCcw, RefreshCw, User, Check } from 'lucide-react'
import './AdminTradingPage.css'
import { DEFAULT_TRADING_TAB, TRADING_TABS, TradingTabKey } from '../types/trading'

const STORAGE_KEY = 'spotlight_user'

interface StoredUser {
  email: string
  type?: string
}

interface Worker {
  id: number
  created_at?: string
  chat_id?: string | number
  isAdmin?: boolean
  username?: string | null
  first_name?: string | null
  ref_id?: string | number | null
  balance?: number | string | null
  auto_win?: boolean
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
  usersCount?: number
}

interface NewEmployeeMessage {
  id?: number
  chat_id: number
  from: string
  to: string
  message: string
  step?: string | null
  created_at?: string
}

interface NewEmployeeApplication {
  id?: number
  chat_id: number
  username?: string | null
  first_name?: string | null
  isDone?: boolean
  created_at?: string
  messages?: NewEmployeeMessage[]
}

interface NewEmployeeChat {
  chatId: number
  messages: NewEmployeeMessage[]
  lastMessage: NewEmployeeMessage | null
  step: string | null
  firstUserMessage: NewEmployeeMessage | null
  username: string | null
  isDone: boolean
}

interface WorkerReport {
  id: number
  worker_chat_id: number
  closer_chat_id: number
  message_text: string
  message_type: string
  file_id?: string | null
  created_at: string
  read_at?: string | null
  status: 'unread' | 'read'
}

interface WorkerLead {
  id: number
  worker_chat_id: number
  closer_chat_id: number
  lead_name?: string | null
  lead_contact?: string | null
  lead_info?: string | null
  lead_status: 'new' | 'contacted' | 'converted' | 'lost' | 'rejected' | 'closed'
  created_at: string
  updated_at: string
  notes?: string | null
}

const AdminTradingPage = () => {
  const navigate = useNavigate()
  const { tab } = useParams<{ tab?: string }>()
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TradingTabKey>(DEFAULT_TRADING_TAB)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [deposits, setDeposits] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [returningWithdrawId, setReturningWithdrawId] = useState<number | null>(null)
  const [userInfo, setUserInfo] = useState<Record<string | number, any>>({})
  const [workerInfo, setWorkerInfo] = useState<Record<string | number, any>>({})
  const [processingDepositId, setProcessingDepositId] = useState<number | null>(null)
  const [withdrawalsByDay, setWithdrawalsByDay] = useState<Array<{ date: string; count: number }>>([])
  const [showWithdrawalsStats, setShowWithdrawalsStats] = useState(false)
  const [workerStats, setWorkerStats] = useState<Record<string | number, { withdrawals: number; deposits: number; trades: number }>>({})
  const [showWorkerStats, setShowWorkerStats] = useState(false)
  const [withdrawalsByWorker, setWithdrawalsByWorker] = useState<Array<{ workerId: string | number; workerName: string; workerUsername: string | null; workerComment: string | null; count: number }>>([])
  const [showWithdrawalsByWorkerStats, setShowWithdrawalsByWorkerStats] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [depositsByDay, setDepositsByDay] = useState<Array<{ date: string; count: number }>>([])
  const [showDepositsStats, setShowDepositsStats] = useState(false)
  const [selectedDepositDate, setSelectedDepositDate] = useState<string | null>(null)
  const [depositsUserInfo, setDepositsUserInfo] = useState<Record<string | number, any>>({})
  const [depositsWorkerInfo, setDepositsWorkerInfo] = useState<Record<string | number, any>>({})
  const [currentWorkersPage, setCurrentWorkersPage] = useState(1)
  const [currentWithdrawalsPage, setCurrentWithdrawalsPage] = useState(1)
  const [currentDepositsPage, setCurrentDepositsPage] = useState(1)
  const [currentTradesPage, setCurrentTradesPage] = useState(1)
  const [_currentMessagesPage, setCurrentMessagesPage] = useState(1)
  const [messages, setMessages] = useState<any[]>([])
  const [messagesUserInfo, setMessagesUserInfo] = useState<Record<string | number, any>>({})
  const [, setMessagesWorkerInfo] = useState<Record<string | number, any>>({})
  const [currentUserRefId, setCurrentUserRefId] = useState<string | number | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isHr, setIsHr] = useState(false)
  const [newEmployeeChats, setNewEmployeeChats] = useState<NewEmployeeApplication[]>([])
  const [currentNewEmployeePage, setCurrentNewEmployeePage] = useState(1)
  const [expandedMessages, setExpandedMessages] = useState<Record<string | number, boolean>>({})
  const [sendingApproval, setSendingApproval] = useState<Record<string | number, boolean>>({})
  const [newEmployeeFilter, setNewEmployeeFilter] = useState<'processed' | 'unprocessed'>('unprocessed')
  const [updatingStatus, setUpdatingStatus] = useState<Record<string | number, boolean>>({})
  const [payments, setPayments] = useState<any[]>([])
  const [currentPaymentsPage, setCurrentPaymentsPage] = useState(1)
  const [paymentSearch, setPaymentSearch] = useState('')
  const [closingTradeId, setClosingTradeId] = useState<number | null>(null)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any | null>(null)
  const [paymentFormData, setPaymentFormData] = useState({ closer: '', smm: '', amount: '', type: 'trading' as 'trading' | 'ico', platform: '', job: '' })
  const [paymentFormError, setPaymentFormError] = useState('')
  const [paymentFormLoading, setPaymentFormLoading] = useState(false)
  const [analyticsStats, setAnalyticsStats] = useState<Record<string | number, { reports: number; activeLeads: number; rejectedLeads: number; closedLeads: number }>>({})
  const [showReportsModal, setShowReportsModal] = useState<number | null>(null)
  const [showLeadsModal, setShowLeadsModal] = useState<number | null>(null)
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | 'active' | 'rejected' | 'closed'>('all')
  const [reports, setReports] = useState<WorkerReport[]>([])
  const [leads, setLeads] = useState<WorkerLead[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [loadingLeads, setLoadingLeads] = useState(false)
  const itemsPerPage = 10

  useEffect(() => {
    // Для hr завжди перенаправляємо на new-employee
    if (isHr && tab !== 'new-employee') {
      navigate('/admin/trading/new-employee', { replace: true })
      return
    }
    // Ensure route always reflects a valid trading tab
    if (tab && TRADING_TABS.includes(tab as TradingTabKey)) {
      const tabKey = tab as TradingTabKey
      setActiveTab(tabKey)
    } else {
      navigate(`/admin/trading/${DEFAULT_TRADING_TAB}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isHr])

  const handleTabChange = (nextTab: TradingTabKey) => {
    // Для hr дозволяємо тільки new-employee таб
    if (isHr && nextTab !== 'new-employee') {
      navigate('/admin/trading/new-employee', { replace: true })
      return
    }
    setActiveTab(nextTab)
    navigate(`/admin/trading/${nextTab}`)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAccess = async () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed: StoredUser | null = JSON.parse(stored)
          if (parsed?.type === 'admin' || parsed?.type === 'superadmin' || parsed?.type === 'hr') {
            // Для hr - доступ тільки до new-employee таба
            if (parsed?.type === 'hr') {
              setIsHr(true)
              setIsSuperAdmin(false)
              setCurrentUserRefId(null)
              setInitialized(true)
              // Перенаправляємо на new-employee таб, якщо не вже там
              if (tab !== 'new-employee') {
                navigate('/admin/trading/new-employee', { replace: true })
              }
              return
            }

            // Для superadmin - повний доступ без фільтрації за ref_id
            if (parsed?.type === 'superadmin') {
              setIsSuperAdmin(true)
              setIsHr(false)
              setCurrentUserRefId(null) // Не фільтруємо дані
              setInitialized(true)
              console.log('Superadmin detected, isSuperAdmin set to true')
              return
            }

            // Для admin - перевіряємо ref_id
            if (parsed?.type === 'admin') {
              // Отримуємо ref_id поточного користувача з таблиці spotlights_users
              const { data: currentUserInSpotlights } = await supabase
                .from('spotlights_users')
                .select('ref_id, email')
                .eq('type', 'admin')
                .eq('email', parsed?.email || '')
                .maybeSingle()

              // Якщо знайдено поточного користувача з ref_id
              if (currentUserInSpotlights?.ref_id) {
                // Встановлюємо ref_id для фільтрації воркерів, виводів, депозитів та трейдів
                setCurrentUserRefId(currentUserInSpotlights.ref_id)
              }

              setIsSuperAdmin(false)
              setIsHr(false)
              setInitialized(true)
              return
            }
          }
        }
      } catch (readError) {
        console.error('Не удалось прочитать данные пользователя', readError)
      }

      navigate('/', { replace: true })
    }

    checkAccess()
  }, [navigate])

  const fetchWorkers = async () => {
    console.log('[FETCH_WORKERS] Starting fetchWorkers')
    setLoading(true)
    setError(null)
    try {
      // Завантажуємо воркерів з users (як було раніше)
      let query = supabase
        .from('users')
        .select('id, created_at, chat_id, isAdmin, username, first_name, ref_id, balance, auto_win, is_trading_enable, spam, usdt_amount, rub_amount, verification_on, verification_needed, is_message_sending, comment, panel_disabled, worker_comment')
        .not('worker_comment', 'is', null)

      // Якщо користувач (spotlights_users) має ref_id такий самий як chat_id у воркера,
      // то показувати лише цього воркера
      if (currentUserRefId) {
        query = query.eq('chat_id', currentUserRefId)
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Supabase error:', fetchError)
        throw fetchError
      }

      const workersData = data || []

      // Підрахунок кількості користувачів для кожного воркера
      const workersWithCounts = await Promise.all(
        workersData.map(async (worker) => {
          if (!worker.chat_id) {
            return { ...worker, usersCount: 0 }
          }

          const { count, error: countError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('ref_id', worker.chat_id)

          if (countError) {
            console.error('Ошибка подсчета пользователей для воркера', worker.id, countError)
            return { ...worker, usersCount: 0 }
          }

          return { ...worker, usersCount: count || 0 }
        })
      )

      setWorkers(workersWithCounts)

      // Завантажуємо статистику для воркерів (як було раніше)
      if (workersWithCounts.length > 0) {
        const statsMap: Record<string | number, { withdrawals: number; deposits: number; trades: number }> = {}

        await Promise.all(
          workersWithCounts.map(async (worker) => {
            if (!worker.chat_id) return

            // Отримуємо всіх користувачів воркера
            const { data: workerUsers } = await supabase
              .from('users')
              .select('chat_id')
              .eq('ref_id', worker.chat_id)

            if (!workerUsers || workerUsers.length === 0) {
              statsMap[worker.chat_id] = { withdrawals: 0, deposits: 0, trades: 0 }
              return
            }

            const userChatIds = workerUsers.map((u) => u.chat_id).filter(Boolean)

            // Підраховуємо виводи
            const { count: withdrawalsCount } = await supabase
              .from('withdraws')
              .select('*', { count: 'exact', head: true })
              .in('chat_id', userChatIds)

            // Підраховуємо депозити
            const { count: depositsCount } = await supabase
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .in('chat_id', userChatIds)

            // Підраховуємо трейди
            const { count: tradesCount } = await supabase
              .from('trades')
              .select('*', { count: 'exact', head: true })
              .in('chat_id', userChatIds)

            statsMap[worker.chat_id] = {
              withdrawals: withdrawalsCount || 0,
              deposits: depositsCount || 0,
              trades: tradesCount || 0
            }
          })
        )

        setWorkerStats(statsMap)
      }

      // Завантажуємо статистику з closer-worker-analytics для клоузерів
      // Логіка: для кожного клоузера (з users) знаходимо його в analytics-users як клоузера,
      // і використовуємо його chat_id як closer_chat_id для запитів по лідах та звітах
      console.log('[ANALYTICS] Starting to load analytics stats for', workersWithCounts.length, 'closers')
      if (workersWithCounts.length > 0) {
        const analyticsStatsMap: Record<string | number, { reports: number; activeLeads: number; rejectedLeads: number; closedLeads: number }> = {}

        await Promise.all(
          workersWithCounts.map(async (worker) => {
            if (!worker.chat_id) {
              return
            }

            const closerChatId = Number(worker.chat_id)

            try {
              // Знаходимо клоузера в analytics-users (де role = 'closer')
              const { data: analyticsCloser, error: analyticsError } = await supabase
                .from('analytics-users')
                .select('chat_id, role')
                .eq('chat_id', closerChatId)
                .eq('role', 'closer')
                .maybeSingle()

              if (analyticsError) {
                console.error(`[ANALYTICS] Error fetching analytics closer ${closerChatId}:`, analyticsError)
              }

              // Якщо клоузер не знайдений в analytics-users, пропускаємо або використовуємо fallback
              if (!analyticsCloser) {
                console.log(`[ANALYTICS] Closer ${closerChatId} NOT found in analytics-users as closer`)
                
                // Для не-superadmin використовуємо currentUserRefId якщо він є
                if (!isSuperAdmin && currentUserRefId) {
                  // Використовуємо currentUserRefId як closer_chat_id
                  console.log(`[ANALYTICS] Using currentUserRefId as closer_chat_id: ${currentUserRefId}`)
                } else if (isSuperAdmin) {
                  // Для superadmin використовуємо chat_id клоузера навіть якщо його немає в analytics-users
                  console.log(`[ANALYTICS] Superadmin: using closer chat_id ${closerChatId} directly`)
                } else {
                  // Якщо клоузер не знайдений і немає currentUserRefId, пропускаємо
                  console.log(`[ANALYTICS] Skipping closer ${closerChatId} - not found in analytics-users and no currentUserRefId`)
                  analyticsStatsMap[closerChatId] = { reports: 0, activeLeads: 0, rejectedLeads: 0, closedLeads: 0 }
                  return
                }
              } else {
                console.log(`[ANALYTICS] Closer ${closerChatId} found in analytics-users`)
              }

              // Визначаємо closer_chat_id для фільтрації
              // Використовуємо chat_id клоузера (з users) як closer_chat_id
              const finalCloserChatId = analyticsCloser ? closerChatId : (isSuperAdmin ? closerChatId : (currentUserRefId ? Number(currentUserRefId) : null))
              
              if (!finalCloserChatId) {
                analyticsStatsMap[closerChatId] = { reports: 0, activeLeads: 0, rejectedLeads: 0, closedLeads: 0 }
                return
              }

              // Підраховуємо звіти для цього клоузера (всі звіти воркерів, які прив'язані до цього клоузера)
              const { count: reportsCount, error: reportsError } = await supabase
                .from('worker_reports')
                .select('*', { count: 'exact', head: true })
                .eq('closer_chat_id', finalCloserChatId)

              if (reportsError) {
                console.error(`[ANALYTICS] Error counting reports for closer ${finalCloserChatId}:`, reportsError)
              }

              // Підраховуємо активні ліди (new + contacted) для цього клоузера
              const { count: activeLeadsCount, error: activeLeadsError } = await supabase
                .from('worker_leads')
                .select('*', { count: 'exact', head: true })
                .eq('closer_chat_id', finalCloserChatId)
                .in('lead_status', ['new', 'contacted'])

              if (activeLeadsError) {
                console.error(`[ANALYTICS] Error counting active leads for closer ${finalCloserChatId}:`, activeLeadsError)
              }

              // Підраховуємо відмовлені ліди для цього клоузера
              const { count: rejectedLeadsCount, error: rejectedLeadsError } = await supabase
                .from('worker_leads')
                .select('*', { count: 'exact', head: true })
                .eq('closer_chat_id', finalCloserChatId)
                .eq('lead_status', 'rejected')

              if (rejectedLeadsError) {
                console.error(`[ANALYTICS] Error counting rejected leads for closer ${finalCloserChatId}:`, rejectedLeadsError)
              }

              // Підраховуємо закриті ліди для цього клоузера
              const { count: closedLeadsCount, error: closedLeadsError } = await supabase
                .from('worker_leads')
                .select('*', { count: 'exact', head: true })
                .eq('closer_chat_id', finalCloserChatId)
                .eq('lead_status', 'closed')

              if (closedLeadsError) {
                console.error(`[ANALYTICS] Error counting closed leads for closer ${finalCloserChatId}:`, closedLeadsError)
              }

              const stats = {
                reports: reportsCount || 0,
                activeLeads: activeLeadsCount || 0,
                rejectedLeads: rejectedLeadsCount || 0,
                closedLeads: closedLeadsCount || 0
              }

              // Зберігаємо з різними ключами для сумісності
              analyticsStatsMap[closerChatId] = stats
              analyticsStatsMap[String(closerChatId)] = stats
              if (worker.chat_id && worker.chat_id !== closerChatId && worker.chat_id !== String(closerChatId)) {
                analyticsStatsMap[worker.chat_id] = stats
              }

              console.log(`[ANALYTICS] Stats for closer ${closerChatId} (finalCloserChatId: ${finalCloserChatId}):`, stats)
              console.log(`[ANALYTICS] Found in analytics-users:`, !!analyticsCloser)
            } catch (err) {
              console.error(`[ANALYTICS] Error processing analytics for closer ${closerChatId}:`, err)
              analyticsStatsMap[closerChatId] = { reports: 0, activeLeads: 0, rejectedLeads: 0, closedLeads: 0 }
            }
          })
        )

        setAnalyticsStats(analyticsStatsMap)
        console.log('[ANALYTICS] Analytics stats loaded for all closers:', JSON.stringify(analyticsStatsMap, null, 2))
        console.log('[ANALYTICS] Total closers with stats:', Object.keys(analyticsStatsMap).length)
        console.log('[ANALYTICS] Closers chat_ids:', workersWithCounts.map(w => ({ chat_id: w.chat_id, id: w.id })))
      } else {
        console.log('[ANALYTICS] No closers to load stats for')
      }
    } catch (err: any) {
      console.error('Ошибка загрузки воркеров', err)
      setError(err.message || 'Не удалось загрузить воркеров.')
    } finally {
      setLoading(false)
    }
  }


  const fetchReports = async (closerChatId: number) => {
    setLoadingReports(true)
    setError(null)
    try {
      console.log('[FETCH_REPORTS] Fetching reports for closer_chat_id:', closerChatId)
      const { data, error } = await supabase
        .from('worker_reports')
        .select('*')
        .eq('closer_chat_id', closerChatId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[FETCH_REPORTS] Error fetching reports:', error)
        throw error
      }

      console.log('[FETCH_REPORTS] Reports fetched:', data?.length || 0, 'reports')
      console.log('[FETCH_REPORTS] Sample report:', data?.[0])
      setReports(data || [])
    } catch (err: any) {
      console.error('Ошибка загрузки звітів', err)
      setError(err.message || 'Не удалось загрузить звіти.')
    } finally {
      setLoadingReports(false)
    }
  }

  const fetchLeads = async (closerChatId: number, statusFilter: 'all' | 'active' | 'rejected' | 'closed' = 'all') => {
    setLoadingLeads(true)
    setError(null)
    try {
      console.log('[FETCH_LEADS] Fetching leads for closer_chat_id:', closerChatId, 'statusFilter:', statusFilter)
      let query = supabase
        .from('worker_leads')
        .select('*')
        .eq('closer_chat_id', closerChatId)

      if (statusFilter === 'active') {
        query = query.in('lead_status', ['new', 'contacted'])
      } else if (statusFilter === 'rejected') {
        query = query.eq('lead_status', 'rejected')
      } else if (statusFilter === 'closed') {
        query = query.eq('lead_status', 'closed')
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        console.error('[FETCH_LEADS] Error fetching leads:', error)
        throw error
      }

      console.log('[FETCH_LEADS] Leads fetched:', data?.length || 0, 'leads')
      console.log('[FETCH_LEADS] Sample lead:', data?.[0])
      setLeads(data || [])
    } catch (err: any) {
      console.error('Ошибка загрузки лідів', err)
      setError(err.message || 'Не удалось загрузить ліди.')
    } finally {
      setLoadingLeads(false)
    }
  }

  const handleViewReports = async (closerChatId: number) => {
    setShowReportsModal(closerChatId)
    await fetchReports(closerChatId)
  }

  const handleViewLeads = async (closerChatId: number, status: 'all' | 'active' | 'rejected' | 'closed' = 'all') => {
    setShowLeadsModal(closerChatId)
    setLeadStatusFilter(status)
    await fetchLeads(closerChatId, status)
  }


  const fetchWithdrawals = async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('withdraws')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      // Якщо є ref_id з spotlights_users, фільтруємо виводи
      // Показуємо тільки ті, де ref_id користувача (users) дорівнює ref_id з spotlights_users
      if (currentUserRefId) {
        // Отримуємо всіх користувачів з users, у яких ref_id дорівнює currentUserRefId
        const { data: usersWithRefId } = await supabase
          .from('users')
          .select('chat_id')
          .eq('ref_id', currentUserRefId)

        if (usersWithRefId && usersWithRefId.length > 0) {
          const chatIds = usersWithRefId.map((u) => u.chat_id).filter(Boolean)
          query = query.in('chat_id', chatIds)
        } else {
          // Якщо немає користувачів з таким ref_id, повертаємо порожній список
          setWithdrawals([])
          setLoading(false)
          return
        }
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setWithdrawals(data || [])

      // Завантажуємо інформацію про користувачів та воркерів
      if (data && data.length > 0) {
        const chatIds = [...new Set(data.map((w) => w.chat_id).filter(Boolean))]
        const userInfoMap: Record<string | number, any> = {}
        const workerInfoMap: Record<string | number, any> = {}

        await Promise.all(
          chatIds.map(async (chatId) => {
            // Завантажуємо користувача
            const { data: userData } = await supabase
              .from('users')
              .select('id, chat_id, first_name, username, ref_id')
              .eq('chat_id', chatId)
              .single()

            if (userData) {
              userInfoMap[chatId] = userData

              // Якщо є ref_id, завантажуємо воркера
              if (userData.ref_id) {
                const { data: workerData } = await supabase
                  .from('users')
                  .select('id, chat_id, first_name, username, worker_comment')
                  .eq('chat_id', userData.ref_id)
                  .single()

                if (workerData) {
                  workerInfoMap[userData.ref_id] = workerData
                }
              }
            }
          })
        )

        setUserInfo(userInfoMap)
        setWorkerInfo(workerInfoMap)

        // Групуємо виводи по днях
        const withdrawalsByDayMap: Record<string, number> = {}
        data.forEach((withdraw) => {
          if (withdraw.created_at) {
            const date = new Date(withdraw.created_at).toLocaleDateString('uk-UA', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            })
            withdrawalsByDayMap[date] = (withdrawalsByDayMap[date] || 0) + 1
          }
        })

        const withdrawalsByDayArray = Object.entries(withdrawalsByDayMap)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => {
            const dateA = a.date.split('.').reverse().join('-')
            const dateB = b.date.split('.').reverse().join('-')
            return new Date(dateB).getTime() - new Date(dateA).getTime()
          })

        setWithdrawalsByDay(withdrawalsByDayArray)

        // Групуємо виводи по воркерах
        const withdrawalsByWorkerMap: Record<string | number, { count: number; workerName: string; workerUsername: string | null; workerComment: string | null }> = {}
        data.forEach((withdraw) => {
          const user = userInfoMap[withdraw.chat_id]
          if (user?.ref_id) {
            const worker = workerInfoMap[user.ref_id]
            if (worker) {
              if (!withdrawalsByWorkerMap[worker.chat_id]) {
                withdrawalsByWorkerMap[worker.chat_id] = {
                  count: 0,
                  workerName: worker.first_name || 'Воркер',
                  workerUsername: worker.username || null,
                  workerComment: worker.worker_comment || null
                }
              }
              withdrawalsByWorkerMap[worker.chat_id].count++
            }
          }
        })

        const withdrawalsByWorkerArray = Object.entries(withdrawalsByWorkerMap)
          .map(([workerId, data]) => ({
            workerId,
            workerName: data.workerName,
            workerUsername: data.workerUsername,
            workerComment: data.workerComment,
            count: data.count
          }))
          .sort((a, b) => b.count - a.count)

        setWithdrawalsByWorker(withdrawalsByWorkerArray)
      }
    } catch (err: any) {
      console.error('Ошибка загрузки виводов', err)
      setError(err.message || 'Не удалось загрузить виводи.')
    } finally {
      setLoading(false)
    }
  }

  const fetchDeposits = async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      // Якщо є ref_id з spotlights_users, фільтруємо депозити
      // Показуємо тільки ті, де ref_id користувача (users) дорівнює ref_id з spotlights_users
      if (currentUserRefId) {
        // Отримуємо всіх користувачів з users, у яких ref_id дорівнює currentUserRefId
        const { data: usersWithRefId } = await supabase
          .from('users')
          .select('chat_id')
          .eq('ref_id', currentUserRefId)

        if (usersWithRefId && usersWithRefId.length > 0) {
          const chatIds = usersWithRefId.map((u) => u.chat_id).filter(Boolean)
          query = query.in('chat_id', chatIds)
        } else {
          // Якщо немає користувачів з таким ref_id, повертаємо порожній список
          setDeposits([])
          setLoading(false)
          return
        }
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setDeposits(data || [])

      // Завантажуємо інформацію про користувачів та воркерів
      if (data && data.length > 0) {
        const chatIds = [...new Set(data.map((d) => d.chat_id).filter(Boolean))]
        const userInfoMap: Record<string | number, any> = {}
        const workerInfoMap: Record<string | number, any> = {}

        await Promise.all(
          chatIds.map(async (chatId) => {
            // Завантажуємо користувача
            const { data: userData } = await supabase
              .from('users')
              .select('id, chat_id, first_name, username, ref_id')
              .eq('chat_id', chatId)
              .single()

            if (userData) {
              userInfoMap[chatId] = userData

              // Якщо є ref_id, завантажуємо воркера
              if (userData.ref_id) {
                const { data: workerData } = await supabase
                  .from('users')
                  .select('id, chat_id, first_name, username, worker_comment')
                  .eq('chat_id', userData.ref_id)
                  .single()

                if (workerData) {
                  workerInfoMap[userData.ref_id] = workerData
                }
              }
            }
          })
        )

        setDepositsUserInfo(userInfoMap)
        setDepositsWorkerInfo(workerInfoMap)

        // Групуємо депозити по днях
        const depositsByDayMap: Record<string, number> = {}
        data.forEach((deposit) => {
          if (deposit.created_at) {
            const date = new Date(deposit.created_at).toLocaleDateString('uk-UA', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            })
            depositsByDayMap[date] = (depositsByDayMap[date] || 0) + 1
          }
        })

        const depositsByDayArray = Object.entries(depositsByDayMap)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => {
            const dateA = a.date.split('.').reverse().join('-')
            const dateB = b.date.split('.').reverse().join('-')
            return new Date(dateB).getTime() - new Date(dateA).getTime()
          })

        setDepositsByDay(depositsByDayArray)
      }
    } catch (err: any) {
      console.error('Ошибка загрузки депозитов', err)
      setError(err.message || 'Не удалось загрузить депозити.')
    } finally {
      setLoading(false)
    }
  }

  const closeTrade = async (chatId: string | number | null, tradeId: number, amount: number | string | null, isWin: boolean) => {
    if (!chatId) {
      setError('Chat ID не знайдено')
      return
    }

    setClosingTradeId(tradeId)
    setError(null)

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
      setTrades((prev) =>
        prev.map((trade) =>
          trade.id === tradeId ? { ...trade, isActive: false, isWin: isWin } : trade
        )
      )

      // Оновлюємо список трейдів
      await fetchTrades()
    } catch (err: any) {
      console.error('Ошибка закрытия трейда', err)
      setError(err.message || 'Не удалось закрыть трейд.')
    } finally {
      setClosingTradeId(null)
    }
  }

  const fetchTrades = async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      // Якщо є ref_id з spotlights_users, фільтруємо трейди
      // Показуємо тільки ті, де ref_id користувача (users) дорівнює ref_id з spotlights_users
      if (currentUserRefId) {
        // Отримуємо всіх користувачів з users, у яких ref_id дорівнює currentUserRefId
        const { data: usersWithRefId } = await supabase
          .from('users')
          .select('chat_id')
          .eq('ref_id', currentUserRefId)

        if (usersWithRefId && usersWithRefId.length > 0) {
          const chatIds = usersWithRefId.map((u) => u.chat_id).filter(Boolean)
          query = query.in('chat_id', chatIds)
        } else {
          // Якщо немає користувачів з таким ref_id, повертаємо порожній список
          setTrades([])
          setLoading(false)
          return
        }
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setTrades(data || [])
    } catch (err: any) {
      console.error('Ошибка загрузки трейдов', err)
      setError(err.message || 'Не удалось загрузить трейди.')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    setLoading(true)
    setError(null)
    try {
      // ОПТИМІЗОВАНА ЛОГІКА: Спочатку отримуємо користувачів, потім повідомлення
      
      // Крок 1: Отримуємо користувачів
      let usersQuery = supabase
        .from('users')
        .select('id, chat_id, first_name, username, ref_id, worker_comment')

      if (isSuperAdmin) {
        // Superadmin бачить всіх користувачів (з лімітом для продуктивності)
        usersQuery = usersQuery.limit(1000)
      } else if (currentUserRefId) {
        // Для воркера/адміна - тільки його користувачі
        usersQuery = usersQuery.eq('ref_id', currentUserRefId)
      } else {
        // Немає доступу
        setMessages([])
        setMessagesUserInfo({})
        setMessagesWorkerInfo({})
        return
      }

      const { data: usersData, error: usersError } = await usersQuery

      if (usersError) {
        console.error('Помилка завантаження користувачів:', usersError)
        throw usersError
      }

      if (!usersData || usersData.length === 0) {
        setMessages([])
        setMessagesUserInfo({})
        setMessagesWorkerInfo({})
        return
      }

      // Створюємо мапу користувачів та збираємо chat_id
      const userInfoMap: Record<string | number, any> = {}
      const workerChatIds = new Set<string | number>()
      const userChatIds: (string | number)[] = []

      usersData.forEach((user: any) => {
        if (user.chat_id) {
          userInfoMap[user.chat_id] = user
          userChatIds.push(user.chat_id)
          if (user.ref_id) {
            workerChatIds.add(user.ref_id)
          }
        }
      })

      // Завантажуємо воркерів одним запитом (якщо потрібно)
      const workerInfoMap: Record<string | number, any> = {}
      if (workerChatIds.size > 0) {
        const { data: workersData, error: workersError } = await supabase
          .from('users')
          .select('id, chat_id, first_name, username, worker_comment')
          .in('chat_id', Array.from(workerChatIds))

        if (workersError) {
          console.error('Помилка завантаження воркерів:', workersError)
        } else if (workersData) {
          workersData.forEach((worker: any) => {
            workerInfoMap[worker.chat_id] = worker
          })
        }
      }

      // Крок 2: Отримуємо повідомлення для цих користувачів
      if (userChatIds.length === 0) {
        setMessages([])
        setMessagesUserInfo(userInfoMap)
        setMessagesWorkerInfo(workerInfoMap)
        return
      }

      let messagesQuery = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      // Фільтруємо повідомлення для цих користувачів
      // НОВА СТРУКТУРА: user_id, worker_id, message, sender
      // Фільтруємо по user_id (chat_id користувача)
      if (isSuperAdmin) {
        // Для superadmin - всі повідомлення з цими користувачами
        messagesQuery = messagesQuery.in('user_id', userChatIds)
      } else if (currentUserRefId) {
        // Для воркера - повідомлення до його користувачів (user_id = user.chat_id)
        // Можна також фільтрувати по worker_id, якщо потрібно
        messagesQuery = messagesQuery.in('user_id', userChatIds)
      }

      const { data: messagesData, error: messagesError } = await messagesQuery

      if (messagesError) {
        console.error('Помилка завантаження повідомлень:', messagesError)
        throw messagesError
      }

      // Сортуємо повідомлення за датою (від старого до нового для чату)
      const sortedMessages = (messagesData || []).sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateA - dateB
      })

      // Додаємо інформацію про користувачів, які є в повідомленнях, але не в початковому списку
      // НОВА СТРУКТУРА: user_id, worker_id, message, sender
      const allChatIdsInMessages = new Set<string | number>()
      sortedMessages.forEach((m: any) => {
        if (m.user_id) allChatIdsInMessages.add(String(m.user_id))
        if (m.worker_id) allChatIdsInMessages.add(String(m.worker_id))
      })

      // Завантажуємо додаткових користувачів та воркерів, які є в повідомленнях
      const missingChatIds = Array.from(allChatIdsInMessages).filter(
        (id) => !userInfoMap[id]
      )

      if (missingChatIds.length > 0) {
        const { data: missingUsersData } = await supabase
          .from('users')
          .select('id, chat_id, first_name, username, ref_id, worker_comment')
          .in('chat_id', missingChatIds)

        missingUsersData?.forEach((user: any) => {
          if (user.chat_id) {
            userInfoMap[user.chat_id] = user
            if (user.ref_id && !workerInfoMap[user.ref_id]) {
              workerChatIds.add(user.ref_id)
            }
          }
        })
      }

      // Оновлюємо стан
      setMessages(sortedMessages)
      setMessagesUserInfo(userInfoMap)
      setMessagesWorkerInfo(workerInfoMap)

      console.log(`✅ Завантажено: ${usersData.length} користувачів, ${sortedMessages.length} повідомлень`)
    } catch (err: any) {
      console.error('Ошибка загрузки повідомлень', err)
      setError(err.message || 'Не удалось загрузить повідомлення.')
    } finally {
      setLoading(false)
    }
  }

  const processDeposit = async (depositId: number, chatId: string | number, amount: number | string | null, currency: string | null) => {
    setProcessingDepositId(depositId)
    setError(null)

    try {
      if (!amount || Number.isNaN(Number(amount))) {
        throw new Error('Некоректна сума депозиту')
      }

      const depositAmount = Number(amount)

      // Отримуємо поточний баланс користувача
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('usdt_amount, rub_amount')
        .eq('chat_id', chatId)
        .single()

      if (userError) throw userError

      // Визначаємо, який баланс оновити
      const currencyUpper = currency?.toUpperCase() || 'RUB'
      const isUSDT = currencyUpper === 'USDT' || currencyUpper === 'USD'
      const currentBalance = isUSDT ? Number(userData?.usdt_amount || 0) : Number(userData?.rub_amount || 0)
      const newBalance = currentBalance + depositAmount

      // Оновлюємо баланс користувача та статус депозиту
      const updateData = isUSDT
        ? { usdt_amount: newBalance }
        : { rub_amount: newBalance }

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
      setDeposits((prev) =>
        prev.map((d) =>
          d.id === depositId ? { ...d, isPayed: true } : d
        )
      )

      alert(`Депозит успішно оплачено! Кошти зараховано на баланс користувача.`)
    } catch (err: any) {
      console.error('Ошибка оплаты депозита', err)
      setError(err.message || 'Не удалось оплатить депозит.')
    } finally {
      setProcessingDepositId(null)
    }
  }

  const returnWithdraw = async (withdrawId: number, chatId: string | number, amount: number | string | null, currency?: string | null) => {
    setReturningWithdrawId(withdrawId)
    setError(null)

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
      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === withdrawId ? { ...w, isDone: true } : w
        )
      )

    } catch (err: any) {
      console.error('Ошибка возврата вывода', err)
      setError(err.message || 'Не удалось вернуть средства.')
    } finally {
      setReturningWithdrawId(null)
    }
  }

  const sendApprovalMessage = async (chatId: string | number) => {
    setSendingApproval(prev => ({ ...prev, [chatId]: true }))
    setError(null)

    try {
      const approvalMessage = `Поздравляю, ваша заявка на обучение одобрена, заходите в группу обучения.

https://t.me/+faqFs28Xnx85Mjdi`

      const { error: functionError } = await supabase.functions.invoke('logic', {
        body: {
          type: 'new_employee',
          chat_id: chatId,
          message: approvalMessage
        }
      })

      if (functionError) {
        throw functionError
      }

      // Оновлюємо список чатів після відправки
      await fetchNewEmployeeChats()
    } catch (err: any) {
      console.error('Ошибка отправки сообщения об одобрении', err)
      setError(err.message || 'Не удалось отправить сообщение об одобрении.')
    } finally {
      setSendingApproval(prev => ({ ...prev, [chatId]: false }))
    }
  }

  const fetchNewEmployeeChats = async () => {
    setLoading(true)
    setError(null)
    try {
      // Фільтруємо по isDone: true для оброблених, false/null для необроблених
      const isDoneFilter = newEmployeeFilter === 'processed'
      
      // Отримуємо заявки з таблиці new-employee
      const { data: applications, error: applicationsError } = await supabase
        .from('new-employee')
        .select('*')
        .order('created_at', { ascending: false })

      if (applicationsError) throw applicationsError
      
      // Фільтруємо заявки по isDone
      const filteredApplications = (applications || []).filter(app => {
        if (isDoneFilter) {
          return app.isDone === true
        } else {
          return app.isDone === false || app.isDone === null || app.isDone === undefined
        }
      })
      
      console.log(`[FETCH-CHATS] Filter: ${newEmployeeFilter} (isDoneFilter=${isDoneFilter}), Total applications: ${applications?.length || 0}, Filtered: ${filteredApplications.length}`)
      
      if (filteredApplications.length > 0) {
        // Отримуємо унікальні chat_id для отримання username та повідомлень
        const uniqueChatIds = filteredApplications.map(app => app.chat_id).filter(Boolean)
        
        // Отримуємо username для всіх користувачів
        const { data: usersData } = await supabase
          .from('users')
          .select('chat_id, username')
          .in('chat_id', uniqueChatIds)
        
        // Створюємо мапу chat_id -> username
        const usernameMap = new Map<number | string, string | null>()
        usersData?.forEach(user => {
          if (user.chat_id) {
            usernameMap.set(user.chat_id, user.username)
          }
        })
        
        // Отримуємо повідомлення для цих заявок
        const { data: messagesData } = await supabase
          .from('new-employee-messages')
          .select('*')
          .in('chat_id', uniqueChatIds)
          .order('created_at', { ascending: false })
        
        // Створюємо мапу chat_id -> messages
        const messagesMap = new Map<string | number, any[]>()
        messagesData?.forEach(msg => {
          const chatId = msg.chat_id
          if (!messagesMap.has(chatId)) {
            messagesMap.set(chatId, [])
          }
          messagesMap.get(chatId)!.push(msg)
        })
        
        // Об'єднуємо заявки з повідомленнями та username
        const chatsWithData = filteredApplications.map(app => ({
          ...app,
          username: usernameMap.get(app.chat_id) || app.username || null,
          messages: messagesMap.get(app.chat_id) || []
        }))
        
        setNewEmployeeChats(chatsWithData)
      } else {
        setNewEmployeeChats([])
      }
    } catch (err: any) {
      console.error('Ошибка загрузки чатов new-employee', err)
      setError(err.message || 'Не удалось загрузить чаты.')
    } finally {
      setLoading(false)
    }
  }

  const updateApplicationStatus = async (chatId: string | number, isDone: boolean) => {
    setUpdatingStatus(prev => ({ ...prev, [chatId]: true }))
    setError(null)

    try {
      console.log(`[UPDATE-STATUS] Updating chat_id ${chatId} to isDone=${isDone}`)
      
      // Оновлюємо всі записи для цього chat_id
      const { data: updateData, error: updateError } = await supabase
        .from('new-employee')
        .update({ isDone: isDone })
        .eq('chat_id', chatId)
        .select()

      if (updateError) {
        console.error('[UPDATE-STATUS] Update error:', updateError)
        throw updateError
      }

      console.log(`[UPDATE-STATUS] Updated ${updateData?.length || 0} application(s) for chat_id ${chatId}`)

      // Оновлюємо список чатів
      await fetchNewEmployeeChats()
    } catch (err: any) {
      console.error('Ошибка обновления статуса заявки', err)
      setError(err.message || 'Не удалось обновить статус заявки.')
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [chatId]: false }))
    }
  }

  const fetchPayments = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setPayments(data || [])
    } catch (err: any) {
      console.error('Ошибка загрузки платежей', err)
      setError(err.message || 'Не удалось загрузить платежи.')
    } finally {
      setLoading(false)
    }
  }

  const parseAmount = (value: unknown): number | null => {
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

  const openPaymentForm = (payment?: any) => {
    if (payment) {
      setEditingPayment(payment)
      setPaymentFormData({
        closer: payment.closer || '',
        smm: payment.smm || '',
        amount: payment.amount || '',
        type: payment.type || 'trading',
        platform: payment.platform || '',
        job: payment.job || ''
      })
    } else {
      setEditingPayment(null)
      setPaymentFormData({ closer: '', smm: '', amount: '', type: 'trading', platform: '', job: '' })
    }
    setPaymentFormError('')
    setFormModalOpen(true)
  }

  const closePaymentForm = () => {
    setFormModalOpen(false)
    setEditingPayment(null)
    setPaymentFormData({ closer: '', smm: '', amount: '', type: 'trading', platform: '', job: '' })
    setPaymentFormError('')
    setPaymentFormLoading(false)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPaymentFormError('')

    if (!paymentFormData.closer.trim()) {
      setPaymentFormError('Введите closer.')
      return
    }
    if (!paymentFormData.smm.trim()) {
      setPaymentFormError('Введите smm.')
      return
    }
    const amount = parseAmount(paymentFormData.amount)
    if (amount === null || amount <= 0) {
      setPaymentFormError('Введите корректную сумму (больше 0).')
      return
    }
    if (!paymentFormData.type || (paymentFormData.type !== 'trading' && paymentFormData.type !== 'ico')) {
      setPaymentFormError('Выберите тип: trading или ico.')
      return
    }

    setPaymentFormLoading(true)
    try {
      const requestBody: any = {
        type: 'payment',
        closer: paymentFormData.closer.trim(),
        smm: paymentFormData.smm.trim(),
        amount: amount,
        money_type: paymentFormData.type,
        platform: paymentFormData.platform.trim(),
        job: paymentFormData.job.trim()
      }

      if (editingPayment && editingPayment.id) {
        requestBody.id = editingPayment.id
      }

      const { error } = await supabase.functions.invoke('logic', {
        body: requestBody
      })

      if (error) throw error

      setPaymentFormLoading(false)
      fetchPayments()
      setTimeout(() => {
        closePaymentForm()
      }, 300)
    } catch (err: any) {
      console.error('Ошибка сохранения платежа', err)
      setPaymentFormError(err.message || 'Не удалось сохранить платеж.')
      setPaymentFormLoading(false)
    }
  }

  const handleDeletePayment = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот платеж?')) return
    try {
      const { error } = await supabase.from('payments').delete().eq('id', id)
      if (error) throw error
      fetchPayments()
    } catch (err: any) {
      console.error('Ошибка удаления платежа', err)
      alert(err.message || 'Не удалось удалить платеж.')
    }
  }

  useEffect(() => {
    if (activeTab === 'new-employee') {
      fetchNewEmployeeChats()
    }
  }, [newEmployeeFilter, activeTab])

  const filteredPayments = useMemo(() => {
    const value = paymentSearch.trim().toLowerCase()
    if (!value) return payments
    return payments.filter(
      (item) =>
        item.closer?.toLowerCase().includes(value) ||
        item.smm?.toLowerCase().includes(value) ||
        item.type?.toLowerCase().includes(value) ||
        item.platform?.toLowerCase().includes(value) ||
        item.job?.toLowerCase().includes(value)
    )
  }, [payments, paymentSearch])

  useEffect(() => {
    if (!initialized) return
    if (activeTab === 'workers') {
      fetchWorkers()
      setCurrentWorkersPage(1)
    } else if (activeTab === 'withdrawals') {
      fetchWithdrawals()
      setCurrentWithdrawalsPage(1)
    } else if (activeTab === 'deposits') {
      fetchDeposits()
      setCurrentDepositsPage(1)
    } else if (activeTab === 'trades') {
      fetchTrades()
      setCurrentTradesPage(1)
    } else if (activeTab === 'messages') {
      fetchMessages()
      setCurrentMessagesPage(1)
    } else if (activeTab === 'new-employee') {
      fetchNewEmployeeChats()
      setCurrentNewEmployeePage(1)
    } else if (activeTab === 'payments') {
      fetchPayments()
      setCurrentPaymentsPage(1)
    }
  }, [initialized, activeTab, currentUserRefId])

  // Функція для обчислення пагінації
  const getPaginatedData = <T,>(data: T[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return {
      paginatedData: data.slice(startIndex, endIndex),
      totalPages: Math.ceil(data.length / itemsPerPage),
      currentPage,
      totalItems: data.length
    }
  }

  // Компонент пагінації
  const Pagination = ({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) => {
    if (totalPages <= 1) return null

    const pages = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    return (
      <div className="admin-trading-pagination">
        <button
          className="admin-trading-pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← Попередня
        </button>
        <div className="admin-trading-pagination-pages">
          {startPage > 1 && (
            <>
              <button
                className="admin-trading-pagination-page"
                onClick={() => onPageChange(1)}
              >
                1
              </button>
              {startPage > 2 && <span className="admin-trading-pagination-dots">...</span>}
            </>
          )}
          {pages.map((page) => (
            <button
              key={page}
              className={`admin-trading-pagination-page ${currentPage === page ? 'active' : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ))}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="admin-trading-pagination-dots">...</span>}
              <button
                className="admin-trading-pagination-page"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>
        <button
          className="admin-trading-pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Наступна →
        </button>
      </div>
    )
  }

  if (!initialized) {
    return null
  }

  return (
    <div className="admin-trading-page">
      <div className="admin-trading-card">
        <div className="admin-trading-header">
          <div>
            <h1>Trading</h1>
            <p>Управление торговлей и транзакциями</p>
          </div>
          <div className="admin-trading-actions">
            <button className="admin-trading-back" onClick={() => navigate('/admin')}>
              ← К админ-панели
            </button>
          </div>
        </div>

        {error && <div className="admin-trading-error">{error}</div>}

        <div className="admin-trading-tabs">
          {!isHr && (
            <>
              <button
                className={`admin-trading-tab ${activeTab === 'workers' ? 'active' : ''}`}
                onClick={() => handleTabChange('workers')}
                type="button"
              >
                Клоузери
              </button>
              <button
                className={`admin-trading-tab ${activeTab === 'withdrawals' ? 'active' : ''}`}
                onClick={() => handleTabChange('withdrawals')}
                type="button"
              >
                Виводи
              </button>
              <button
                className={`admin-trading-tab ${activeTab === 'deposits' ? 'active' : ''}`}
                onClick={() => handleTabChange('deposits')}
                type="button"
              >
                Депозити
              </button>
              <button
                className={`admin-trading-tab ${activeTab === 'trades' ? 'active' : ''}`}
                onClick={() => handleTabChange('trades')}
                type="button"
              >
                Трейди
              </button>
              <button
                className={`admin-trading-tab ${activeTab === 'messages' ? 'active' : ''}`}
                onClick={() => handleTabChange('messages')}
                type="button"
              >
                Повідомлення
              </button>
            </>
          )}
          {(isSuperAdmin || isHr) && (
            <button
              className={`admin-trading-tab ${activeTab === 'new-employee' ? 'active' : ''}`}
              onClick={() => handleTabChange('new-employee')}
              type="button"
            >
              Нові співробітники
            </button>
          )}
          {!isHr && (
            <button
              className={`admin-trading-tab ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => handleTabChange('payments')}
              type="button"
            >
              Payments
            </button>
          )}
        </div>

        <div className="admin-trading-content">
          {loading ? (
            <div className="admin-trading-loading">Загрузка...</div>
          ) : (
            <>
              {activeTab === 'workers' && (
                <>
                  {workers.length === 0 ? (
                    <div className="admin-trading-empty">
                      <p>Клоузери не знайдені</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const { paginatedData, totalPages } = getPaginatedData(workers, currentWorkersPage, itemsPerPage)
                        return (
                          <>
                            <Pagination
                              currentPage={currentWorkersPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentWorkersPage}
                            />
                            <div className="admin-trading-stats-toggle">
                              <button
                                className="admin-trading-stats-btn"
                                onClick={() => setShowWorkerStats(!showWorkerStats)}
                              >
                                {showWorkerStats ? 'Приховати статистику' : 'Показати статистику по клоузерам'}
                              </button>
                            </div>
                            {showWorkerStats && (
                              <div className="admin-trading-stats-card">
                                <h3 className="admin-trading-stats-title">Статистика по клоузерам</h3>
                                <div className="admin-trading-worker-stats-grid">
                                  {workers.map((worker) => {
                                    return (
                                      <div key={worker.id} className="admin-trading-worker-stats-item">
                                        <div className="admin-trading-worker-stats-header">
                                          <div className="admin-trading-worker-stats-name-section">
                                            <span className="admin-trading-worker-stats-name">
                                              {worker.first_name || 'Клоузер'}
                                            </span>
                                            {worker.username && (
                                              <span className="admin-trading-worker-stats-username">
                                                @{worker.username}
                                              </span>
                                            )}
                                          </div>
                                          {worker.worker_comment && (
                                            <div className="admin-trading-worker-stats-comment">
                                              <span className="admin-trading-worker-stats-comment-label">Коментар:</span>
                                              <span className="admin-trading-worker-stats-comment-value">{worker.worker_comment}</span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="admin-trading-worker-stats-content">
                                          <div className="admin-trading-worker-stats-stat">
                                            <span className="admin-trading-worker-stats-label">Користувачів</span>
                                            <span className="admin-trading-worker-stats-value">{worker.usersCount || 0}</span>
                                          </div>
                                          {(() => {
                                            const workerStatsData = worker.chat_id ? (workerStats[worker.chat_id] || { withdrawals: 0, deposits: 0, trades: 0 }) : { withdrawals: 0, deposits: 0, trades: 0 }
                                            return (
                                              <>
                                                <div className="admin-trading-worker-stats-stat">
                                                  <span className="admin-trading-worker-stats-label">Виводи</span>
                                                  <span className="admin-trading-worker-stats-value">{workerStatsData.withdrawals}</span>
                                                </div>
                                                <div className="admin-trading-worker-stats-stat">
                                                  <span className="admin-trading-worker-stats-label">Депозити</span>
                                                  <span className="admin-trading-worker-stats-value">{workerStatsData.deposits}</span>
                                                </div>
                                                <div className="admin-trading-worker-stats-stat">
                                                  <span className="admin-trading-worker-stats-label">Трейди</span>
                                                  <span className="admin-trading-worker-stats-value">{workerStatsData.trades}</span>
                                                </div>
                                              </>
                                            )
                                          })()}
                                          {(() => {
                                            const workerChatId = worker.chat_id ? Number(worker.chat_id) : null
                                            if (!workerChatId) {
                                              console.log('[UI] No workerChatId for worker:', worker.chat_id)
                                              return null
                                            }
                                            
                                            const analyticsData = analyticsStats[workerChatId] || analyticsStats[String(workerChatId)]
                                            console.log('[UI] Looking for stats for workerChatId:', workerChatId, 'Found:', analyticsData)
                                            console.log('[UI] Available keys in analyticsStats:', Object.keys(analyticsStats))
                                            
                                            const stats = analyticsData || { reports: 0, activeLeads: 0, rejectedLeads: 0, closedLeads: 0 }
                                            return (
                                              <>
                                                <div className="admin-trading-worker-stats-stat">
                                                  <span className="admin-trading-worker-stats-label">📋 Звіти</span>
                                                  <span className="admin-trading-worker-stats-value">{stats.reports}</span>
                                                </div>
                                                <div className="admin-trading-worker-stats-stat">
                                                  <span className="admin-trading-worker-stats-label">✅ Активні ліди</span>
                                                  <span className="admin-trading-worker-stats-value">{stats.activeLeads}</span>
                                                </div>
                                                <div className="admin-trading-worker-stats-stat">
                                                  <span className="admin-trading-worker-stats-label">❌ Відмовлені ліди</span>
                                                  <span className="admin-trading-worker-stats-value">{stats.rejectedLeads}</span>
                                                </div>
                                                <div className="admin-trading-worker-stats-stat">
                                                  <span className="admin-trading-worker-stats-label">🔒 Закриті ліди</span>
                                                  <span className="admin-trading-worker-stats-value">{stats.closedLeads}</span>
                                                </div>
                                              </>
                                            )
                                          })()}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="admin-trading-workers-grid">
                              {paginatedData.map((worker) => (
                        <div key={worker.id} className="admin-trading-worker-card">
                          <div className="admin-trading-worker-card-section">
                            <span className="admin-trading-worker-card-label">Ім'я</span>
                            <span className="admin-trading-worker-card-value">{worker.first_name || '—'}</span>
                          </div>
                          <div className="admin-trading-worker-card-section">
                            <span className="admin-trading-worker-card-label">Username</span>
                            <span className="admin-trading-worker-card-value">
                              {worker.username ? `@${worker.username}` : '—'}
                            </span>
                          </div>
                          <div className="admin-trading-worker-card-section">
                            <span className="admin-trading-worker-card-label">Chat ID</span>
                            <span className="admin-trading-worker-card-value">{worker.chat_id || '—'}</span>
                          </div>
                          <div className="admin-trading-worker-card-section">
                            <span className="admin-trading-worker-card-label">Worker Comment</span>
                            <span className="admin-trading-worker-card-value">{worker.worker_comment || '—'}</span>
                          </div>
                          <div className="admin-trading-worker-card-section">
                            <span className="admin-trading-worker-card-label">Кількість користувачів</span>
                            <div className="admin-trading-users-count-wrapper">
                              {worker.chat_id ? (
                                <>
                                  <button
                                    className="admin-trading-users-count-btn"
                                    onClick={() => navigate(`/admin/trading/worker/${worker.chat_id}/users`, { state: { fromTab: activeTab } })}
                                    title="Переглянути користувачів"
                                  >
                                    {worker.usersCount ?? 0}
                                  </button>
                                </>
                              ) : (
                                <span className="admin-trading-worker-card-value">0</span>
                              )}
                            </div>
                          </div>
                          {/* Завжди показуємо статистику з closer-worker-analytics */}
                          {(() => {
                            const workerChatId = worker.chat_id ? Number(worker.chat_id) : null
                            if (!workerChatId) {
                              console.log('[UI] No workerChatId for worker card:', worker.id)
                              return null
                            }
                            
                            // Шукаємо статистику за різними ключами
                            const analyticsData = analyticsStats[workerChatId] || analyticsStats[String(workerChatId)] || (worker.chat_id ? analyticsStats[worker.chat_id] : null)
                            
                            console.log(`[UI] Worker card ${worker.id} (chat_id: ${workerChatId}):`, {
                              'analyticsStats[workerChatId]': analyticsStats[workerChatId],
                              'analyticsStats[String(workerChatId)]': analyticsStats[String(workerChatId)],
                              'analyticsStats[worker.chat_id]': worker.chat_id ? analyticsStats[worker.chat_id] : null,
                              'found': analyticsData,
                              'allKeys': Object.keys(analyticsStats)
                            })
                            
                            // Завжди показуємо статистику, навіть якщо значення 0
                            const stats = analyticsData || { reports: 0, activeLeads: 0, rejectedLeads: 0, closedLeads: 0 }
                            
                            return (
                              <>
                                <div className="admin-trading-worker-card-section">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="admin-trading-worker-card-label">📋 Звіти</span>
                                    <span className="admin-trading-worker-card-value">{stats.reports}</span>
                                    {stats.reports > 0 && (
                                      <button
                                        className="admin-trading-view-btn"
                                        onClick={() => handleViewReports(workerChatId)}
                                        style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '12px' }}
                                      >
                                        Переглянути
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="admin-trading-worker-card-section">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="admin-trading-worker-card-label">✅ Активні ліди</span>
                                    <span className="admin-trading-worker-card-value">{stats.activeLeads}</span>
                                    {stats.activeLeads > 0 && (
                                      <button
                                        className="admin-trading-view-btn"
                                        onClick={() => handleViewLeads(workerChatId, 'active')}
                                        style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '12px' }}
                                      >
                                        Переглянути
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="admin-trading-worker-card-section">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="admin-trading-worker-card-label">❌ Відмовлені ліди</span>
                                    <span className="admin-trading-worker-card-value">{stats.rejectedLeads}</span>
                                    {stats.rejectedLeads > 0 && (
                                      <button
                                        className="admin-trading-view-btn"
                                        onClick={() => handleViewLeads(workerChatId, 'rejected')}
                                        style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '12px' }}
                                      >
                                        Переглянути
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="admin-trading-worker-card-section">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="admin-trading-worker-card-label">🔒 Закриті ліди</span>
                                    <span className="admin-trading-worker-card-value">{stats.closedLeads}</span>
                                    {stats.closedLeads > 0 && (
                                      <button
                                        className="admin-trading-view-btn"
                                        onClick={() => handleViewLeads(workerChatId, 'closed')}
                                        style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '12px' }}
                                      >
                                        Переглянути
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                              ))}
                            </div>
                            <Pagination
                              currentPage={currentWorkersPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentWorkersPage}
                            />
                          </>
                        )
                      })()}
                    </>
                  )}
                </>
              )}
              {activeTab === 'withdrawals' && (
                <>
                  {withdrawals.length === 0 ? (
                    <div className="admin-trading-empty">
                      <p>Виводи не знайдені</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const { paginatedData, totalPages } = getPaginatedData(withdrawals, currentWithdrawalsPage, itemsPerPage)
                        return (
                          <>
                            <Pagination
                              currentPage={currentWithdrawalsPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentWithdrawalsPage}
                            />
                            <div className="admin-trading-stats-toggle">
                        <button
                          className="admin-trading-stats-btn"
                          onClick={() => setShowWithdrawalsStats(!showWithdrawalsStats)}
                        >
                          {showWithdrawalsStats ? 'Приховати статистику по днях' : 'Показати статистику по днях'}
                        </button>
                        <button
                          className="admin-trading-stats-btn"
                          onClick={() => setShowWithdrawalsByWorkerStats(!showWithdrawalsByWorkerStats)}
                          style={{ marginLeft: '0.75rem' }}
                        >
                          {showWithdrawalsByWorkerStats ? 'Приховати статистику по клоузерах' : 'Показати статистику по клоузерах'}
                        </button>
                      </div>
                      {showWithdrawalsStats && (
                        <div className="admin-trading-stats-card">
                          <h3 className="admin-trading-stats-title">Кількість виводів по днях</h3>
                          <div className="admin-trading-stats-list">
                            {withdrawalsByDay.length === 0 ? (
                              <p className="admin-trading-stats-empty">Немає даних</p>
                            ) : (
                              withdrawalsByDay.map((item, index) => {
                                const isSelected = selectedDate === item.date
                                const filtered = isSelected ? withdrawals.filter((w) => {
                                  if (!w.created_at) return false
                                  const withdrawDate = new Date(w.created_at).toLocaleDateString('uk-UA', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                  })
                                  return withdrawDate === item.date
                                }) : []

                                return (
                                  <div key={index}>
                                    <div 
                                      className={`admin-trading-stats-item ${isSelected ? 'active' : ''}`}
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedDate(null)
                                        } else {
                                          setSelectedDate(item.date)
                                        }
                                      }}
                                    >
                                      <span className="admin-trading-stats-date">{item.date}</span>
                                      <span className="admin-trading-stats-count">{item.count} виводів</span>
                                    </div>
                                    {isSelected && filtered.length > 0 && (
                                      <div className="admin-trading-date-details">
                                        <div className="admin-trading-date-details-header">
                                          <h4>Виводи за {item.date}</h4>
                                          <button
                                            className="admin-trading-date-details-close"
                                            onClick={() => {
                                              setSelectedDate(null)
                                            }}
                                          >
                                            <X size={18} />
                                          </button>
                                        </div>
                                        <div className="admin-trading-date-details-content">
                                          {filtered.map((withdraw) => {
                                            const user = userInfo[withdraw.chat_id]
                                            const worker = user?.ref_id ? workerInfo[user.ref_id] : null
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
                                              <div key={withdraw.id} className="admin-trading-date-withdraw-card">
                                                {user && (
                                                  <div className="admin-trading-worker-card-section">
                                                    <span className="admin-trading-worker-card-label">Користувач</span>
                                                    <span className="admin-trading-worker-card-value">
                                                      {user.first_name || 'Користувач'} {user.username && `(@${user.username})`}
                                                    </span>
                                                  </div>
                                                )}
                                                {worker && (
                                                  <>
                                                    {worker.first_name && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Ім'я клоузера</span>
                                                        <span className="admin-trading-worker-card-value">{worker.first_name}</span>
                                                      </div>
                                                    )}
                                                    {worker.username && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Username клоузера</span>
                                                        <span className="admin-trading-worker-card-value">@{worker.username}</span>
                                                      </div>
                                                    )}
                                                    {worker.worker_comment && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Коментар клоузера</span>
                                                        <span className="admin-trading-worker-card-value">{worker.worker_comment}</span>
                                                      </div>
                                                    )}
                                                  </>
                                                )}
                                                {Object.entries(withdraw).map(([key, value]) => {
                                                  if (key === 'id' || key === 'chat_id') return null
                                                  const label = withdrawFieldLabels[key] || key
                                                  let displayValue: string = value !== null && value !== undefined ? String(value) : '—'

                                                  if (key === 'isDone') {
                                                    displayValue = value === true || value === 'true' || String(value).toLowerCase() === 'true' ? 'Так' : 'Ні'
                                                  }

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
                                                    <div key={key} className="admin-trading-worker-card-section">
                                                      <span className="admin-trading-worker-card-label">{label}</span>
                                                      <span className="admin-trading-worker-card-value">{displayValue}</span>
                                                    </div>
                                                  )
                                                })}
                                                {withdraw.chat_id && !withdraw.isDone && (
                                                  <div className="admin-trading-worker-card-actions">
                                                    <button
                                                      className="admin-trading-return-withdraw-btn"
                                                      onClick={() => {
                                                        if (withdraw.chat_id) {
                                                          returnWithdraw(withdraw.id, withdraw.chat_id, withdraw.amount ?? null, withdraw.currency ?? null)
                                                        }
                                                      }}
                                                      disabled={returningWithdrawId === withdraw.id}
                                                      title="Повернути кошти на баланс"
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
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )}
                      {showWithdrawalsByWorkerStats && (
                        <div className="admin-trading-stats-card">
                          <h3 className="admin-trading-stats-title">Кількість виводів по клоузерах</h3>
                          <div className="admin-trading-stats-list">
                            {withdrawalsByWorker.length === 0 ? (
                              <p className="admin-trading-stats-empty">Немає даних</p>
                            ) : (
                              withdrawalsByWorker.map((item, index) => (
                                <div key={index} className="admin-trading-stats-item">
                                  <div className="admin-trading-stats-worker-info">
                                    <span className="admin-trading-stats-worker-name">{item.workerName}</span>
                                    {item.workerUsername && (
                                      <span className="admin-trading-stats-worker-username">@{item.workerUsername}</span>
                                    )}
                                    {item.workerComment && (
                                      <span className="admin-trading-stats-worker-comment">{item.workerComment}</span>
                                    )}
                                  </div>
                                  <span className="admin-trading-stats-count">{item.count} виводів</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                            <div className="admin-trading-workers-grid">
                            {paginatedData.map((withdraw) => {
                        const withdrawFieldLabels: Record<string, string> = {
                          amount: 'Сума',
                          status: 'Статус',
                          network: 'Мережа',
                          address: 'Адреса',
                          isDone: 'Повернено',
                          created_at: 'Створено',
                          updated_at: 'Оновлено',
                          chat_id: 'Chat ID'
                        }

                        const user = userInfo[withdraw.chat_id]
                        const worker = user?.ref_id ? workerInfo[user.ref_id] : null

                        return (
                          <div key={withdraw.id} className="admin-trading-worker-card">
                            {user && (
                              <div className="admin-trading-worker-card-section">
                                <span className="admin-trading-worker-card-label">Користувач</span>
                                <div className="admin-trading-user-link-wrapper">
                                  <button
                                    className="admin-trading-user-link"
                                    onClick={() => {
                                      if (user.ref_id) {
                                        navigate(`/admin/trading/worker/${user.ref_id}/users`, { state: { fromTab: activeTab } })
                                      }
                                    }}
                                    title="Переглянути користувача"
                                  >
                                    <User size={14} />
                                    <span>
                                      {user.first_name || 'Користувач'} {user.username && `(@${user.username})`}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            )}
                            {worker && (
                              <>
                                {worker.first_name && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Ім'я клоузера</span>
                                    <span className="admin-trading-worker-card-value">{worker.first_name}</span>
                                  </div>
                                )}
                                {worker.username && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Username клоузера</span>
                                    <span className="admin-trading-worker-card-value">@{worker.username}</span>
                                  </div>
                                )}
                                {worker.worker_comment && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Коментар клоузера</span>
                                    <span className="admin-trading-worker-card-value">{worker.worker_comment}</span>
                                  </div>
                                )}
                              </>
                            )}
                            {Object.entries(withdraw).map(([key, value]) => {
                              if (key === 'id' || key === 'chat_id') return null
                              const label = withdrawFieldLabels[key] || key
                              let displayValue: string = value !== null && value !== undefined ? String(value) : '—'

                              if (key === 'isDone') {
                                displayValue = value === true || value === 'true' || String(value).toLowerCase() === 'true' ? 'Так' : 'Ні'
                              }

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
                                <div key={key} className="admin-trading-worker-card-section">
                                  <span className="admin-trading-worker-card-label">{label}</span>
                                  <span className="admin-trading-worker-card-value">{displayValue}</span>
                                </div>
                              )
                            })}
                            {withdraw.chat_id && !withdraw.isDone && (
                              <div className="admin-trading-worker-card-actions">
                                <button
                                  className="admin-trading-return-withdraw-btn"
                                  onClick={() => {
                                    if (withdraw.chat_id) {
                                      returnWithdraw(withdraw.id, withdraw.chat_id, withdraw.amount ?? null)
                                    }
                                  }}
                                  disabled={returningWithdrawId === withdraw.id}
                                  title="Повернути кошти на баланс"
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
                            <Pagination
                              currentPage={currentWithdrawalsPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentWithdrawalsPage}
                            />
                          </>
                        )
                      })()}
                    </>
                  )}
                </>
              )}
              {activeTab === 'deposits' && (
                <>
                  {deposits.length === 0 ? (
                    <div className="admin-trading-empty">
                      <p>Депозити не знайдені</p>
                    </div>
                  ) : (
                    <>
                      <div className="admin-trading-stats-toggle">
                        <button
                          className="admin-trading-stats-btn"
                          onClick={() => setShowDepositsStats(!showDepositsStats)}
                        >
                          {showDepositsStats ? 'Приховати статистику по днях' : 'Показати статистику по днях'}
                        </button>
                      </div>
                      {showDepositsStats && (
                        <div className="admin-trading-stats-card">
                          <h3 className="admin-trading-stats-title">Кількість депозитів по днях</h3>
                          <div className="admin-trading-stats-list">
                            {depositsByDay.length === 0 ? (
                              <p className="admin-trading-stats-empty">Немає даних</p>
                            ) : (
                              depositsByDay.map((item, index) => {
                                const isSelected = selectedDepositDate === item.date
                                const filtered = isSelected ? deposits.filter((d) => {
                                  if (!d.created_at) return false
                                  const depositDate = new Date(d.created_at).toLocaleDateString('uk-UA', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                  })
                                  return depositDate === item.date
                                }) : []

                                return (
                                  <div key={index}>
                                    <div 
                                      className={`admin-trading-stats-item ${isSelected ? 'active' : ''}`}
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedDepositDate(null)
                                        } else {
                                          setSelectedDepositDate(item.date)
                                        }
                                      }}
                                    >
                                      <span className="admin-trading-stats-date">{item.date}</span>
                                      <span className="admin-trading-stats-count">{item.count} депозитів</span>
                                    </div>
                                    {isSelected && filtered.length > 0 && (
                                      <div className="admin-trading-date-details">
                                        <div className="admin-trading-date-details-header">
                                          <h4>Депозити за {item.date}</h4>
                                          <button
                                            className="admin-trading-date-details-close"
                                            onClick={() => {
                                              setSelectedDepositDate(null)
                                            }}
                                          >
                                            <X size={18} />
                                          </button>
                                        </div>
                                        <div className="admin-trading-date-details-content">
                                          {filtered.map((deposit) => {
                                            const user = depositsUserInfo[deposit.chat_id]
                                            const worker = user?.ref_id ? depositsWorkerInfo[user.ref_id] : null

                                            return (
                                              <div key={deposit.id} className="admin-trading-date-withdraw-card">
                                                {user && (
                                                  <>
                                                    {user.first_name && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Ім'я користувача</span>
                                                        <span className="admin-trading-worker-card-value">{user.first_name}</span>
                                                      </div>
                                                    )}
                                                    {user.username && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Username користувача</span>
                                                        <span className="admin-trading-worker-card-value">@{user.username}</span>
                                                      </div>
                                                    )}
                                                    {user.chat_id && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Chat ID користувача</span>
                                                        <span className="admin-trading-worker-card-value">{user.chat_id}</span>
                                                      </div>
                                                    )}
                                                  </>
                                                )}
                                                {worker && (
                                                  <>
                                                    {worker.first_name && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Ім'я клоузера</span>
                                                        <span className="admin-trading-worker-card-value">{worker.first_name}</span>
                                                      </div>
                                                    )}
                                                    {worker.username && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Username клоузера</span>
                                                        <span className="admin-trading-worker-card-value">@{worker.username}</span>
                                                      </div>
                                                    )}
                                                    {worker.worker_comment && (
                                                      <div className="admin-trading-worker-card-section">
                                                        <span className="admin-trading-worker-card-label">Коментар клоузера</span>
                                                        <span className="admin-trading-worker-card-value">{worker.worker_comment}</span>
                                                      </div>
                                                    )}
                                                  </>
                                                )}
                                                <div className="admin-trading-worker-card-section">
                                                  <span className="admin-trading-worker-card-label">URL</span>
                                                  <span className="admin-trading-worker-card-value">
                                                    {deposit.url ? (
                                                      <a
                                                        href={deposit.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="admin-trading-link"
                                                      >
                                                        {deposit.url}
                                                      </a>
                                                    ) : (
                                                      '—'
                                                    )}
                                                  </span>
                                                </div>
                                                <div className="admin-trading-worker-card-section">
                                                  <span className="admin-trading-worker-card-label">Сума</span>
                                                  <span className="admin-trading-worker-card-value">
                                                    {deposit.amount !== null && deposit.amount !== undefined ? String(deposit.amount) : '—'}
                                                  </span>
                                                </div>
                                                <div className="admin-trading-worker-card-section">
                                                  <span className="admin-trading-worker-card-label">Валюта</span>
                                                  <span className="admin-trading-worker-card-value">{deposit.currency || '—'}</span>
                                                </div>
                                                <div className="admin-trading-worker-card-section">
                                                  <span className="admin-trading-worker-card-label">Оплачено</span>
                                                  <span className="admin-trading-worker-card-value">
                                                    {deposit.isPayed === true || deposit.isPayed === 'true' || String(deposit.isPayed).toLowerCase() === 'true' ? 'Так' : 'Ні'}
                                                  </span>
                                                </div>
                                                {deposit.created_at && (
                                                  <div className="admin-trading-worker-card-section">
                                                    <span className="admin-trading-worker-card-label">Створено</span>
                                                    <span className="admin-trading-worker-card-value">
                                                      {new Date(deposit.created_at).toLocaleString('uk-UA')}
                                                    </span>
                                                  </div>
                                                )}
                                                {deposit.chat_id && !deposit.isPayed && (
                                                  <div className="admin-trading-worker-card-actions">
                                                    <button
                                                      className="admin-trading-process-deposit-btn"
                                                      onClick={() => {
                                                        if (deposit.chat_id) {
                                                          processDeposit(deposit.id, deposit.chat_id, deposit.amount ?? null, deposit.currency ?? null)
                                                        }
                                                      }}
                                                      disabled={processingDepositId === deposit.id}
                                                      title="Оплатити депозит та зарахувати на баланс"
                                                    >
                                                      {processingDepositId === deposit.id ? (
                                                        <>
                                                          <RefreshCw size={14} className="spinning" />
                                                          <span>Обробка...</span>
                                                        </>
                                                      ) : (
                                                        <>
                                                          <RotateCcw size={14} />
                                                          <span>Оплатити</span>
                                                        </>
                                                      )}
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )}
                            {(() => {
                              const { paginatedData, totalPages } = getPaginatedData(deposits, currentDepositsPage, itemsPerPage)
                              return (
                                <>
                                  <Pagination
                                    currentPage={currentDepositsPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentDepositsPage}
                                  />
                                  <div className="admin-trading-workers-grid">
                                    {paginatedData.map((deposit) => {
                                      const user = depositsUserInfo[deposit.chat_id]
                                      const worker = user?.ref_id ? depositsWorkerInfo[user.ref_id] : null

                                      return (
                          <div key={deposit.id} className="admin-trading-worker-card">
                            {user && (
                              <>
                                {user.first_name && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Ім'я користувача</span>
                                    <span className="admin-trading-worker-card-value">{user.first_name}</span>
                                  </div>
                                )}
                                {user.username && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Username користувача</span>
                                    <span className="admin-trading-worker-card-value">@{user.username}</span>
                                  </div>
                                )}
                                {user.chat_id && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Chat ID користувача</span>
                                    <span className="admin-trading-worker-card-value">{user.chat_id}</span>
                                  </div>
                                )}
                              </>
                            )}
                            {worker && (
                              <>
                                {worker.first_name && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Ім'я клоузера</span>
                                    <span className="admin-trading-worker-card-value">{worker.first_name}</span>
                                  </div>
                                )}
                                {worker.username && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Username клоузера</span>
                                    <span className="admin-trading-worker-card-value">@{worker.username}</span>
                                  </div>
                                )}
                                {worker.worker_comment && (
                                  <div className="admin-trading-worker-card-section">
                                    <span className="admin-trading-worker-card-label">Коментар клоузера</span>
                                    <span className="admin-trading-worker-card-value">{worker.worker_comment}</span>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="admin-trading-worker-card-section">
                              <span className="admin-trading-worker-card-label">URL</span>
                            <span className="admin-trading-worker-card-value">
                              {deposit.url ? (
                                <a
                                  href={deposit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="admin-trading-link"
                                >
                                  {deposit.url}
                                </a>
                              ) : (
                                '—'
                              )}
                            </span>
                            </div>
                            <div className="admin-trading-worker-card-section">
                              <span className="admin-trading-worker-card-label">Сума</span>
                            <span className="admin-trading-worker-card-value">
                              {deposit.amount !== null && deposit.amount !== undefined ? String(deposit.amount) : '—'}
                            </span>
                          </div>
                          <div className="admin-trading-worker-card-section">
                            <span className="admin-trading-worker-card-label">Валюта</span>
                            <span className="admin-trading-worker-card-value">{deposit.currency || '—'}</span>
                          </div>
                          <div className="admin-trading-worker-card-section">
                            <span className="admin-trading-worker-card-label">Оплачено</span>
                            <span
                              className={`admin-trading-badge ${
                                deposit.isPayed
                                  ? 'admin-trading-badge--enabled'
                                  : 'admin-trading-badge--disabled'
                              }`}
                            >
                              {deposit.isPayed ? 'Так' : 'Ні'}
                            </span>
                          </div>
                          {deposit.chat_id && !deposit.isPayed && (
                            <div className="admin-trading-worker-card-actions">
                              <button
                                className="admin-trading-process-deposit-btn"
                                onClick={() => {
                                  if (deposit.chat_id) {
                                    processDeposit(deposit.id, deposit.chat_id, deposit.amount ?? null, deposit.currency ?? null)
                                  }
                                }}
                                disabled={processingDepositId === deposit.id}
                                title="Оплатити депозит та зарахувати на баланс"
                              >
                                {processingDepositId === deposit.id ? (
                                  <>
                                    <RefreshCw size={14} className="spinning" />
                                    <span>Обробка...</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw size={14} />
                                    <span>Оплатити</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                          <div className="admin-trading-worker-card-section">
                            <span className="admin-trading-worker-card-label">Chat ID</span>
                            <span className="admin-trading-worker-card-value">{deposit.chat_id || '—'}</span>
                          </div>
                          {deposit.created_at && (
                            <div className="admin-trading-worker-card-section">
                              <span className="admin-trading-worker-card-label">Створено</span>
                              <span className="admin-trading-worker-card-value">
                                {new Date(deposit.created_at).toLocaleString('uk-UA')}
                              </span>
                            </div>
                          )}
                          </div>
                                      )
                                    })}
                                  </div>
                                  <Pagination
                                    currentPage={currentDepositsPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentDepositsPage}
                                  />
                                </>
                              )
                            })()}
                    </>
                  )}
                </>
              )}
              {activeTab === 'trades' && (
                <>
                  {trades.length === 0 ? (
                    <div className="admin-trading-empty">
                      <p>Трейди не знайдені</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const { paginatedData, totalPages } = getPaginatedData(trades, currentTradesPage, itemsPerPage)
                        return (
                          <>
                            <Pagination
                              currentPage={currentTradesPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentTradesPage}
                            />
                            <div className="admin-trading-workers-grid">
                            {paginatedData.map((trade) => {
                        const tradeFieldLabels: Record<string, string> = {
                          token: 'Токен',
                          amount: 'Сума',
                          isActive: 'Активний',
                          isWin: 'Виграш',
                          duration: 'Тривалість',
                          trade_type: 'Тип трейду',
                          created_at: 'Створено',
                          updated_at: 'Оновлено',
                          chat_id: 'Chat ID'
                        }

                        const isActive = trade.isActive === true || trade.isActive === 'true' || String(trade.isActive).toLowerCase() === 'true'
                        
                        return (
                          <div key={trade.id} className="admin-trading-worker-card">
                            {Object.entries(trade).map(([key, value]) => {
                              if (key === 'id') return null
                              const label = tradeFieldLabels[key] || key
                              let displayValue: string = value !== null && value !== undefined ? String(value) : '—'

                              if (key === 'isActive' || key === 'isWin') {
                                displayValue = value === true || value === 'true' || String(value).toLowerCase() === 'true' ? 'Так' : 'Ні'
                              }

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
                                <div key={key} className="admin-trading-worker-card-section">
                                  <span className="admin-trading-worker-card-label">{label}</span>
                                  <span className="admin-trading-worker-card-value">{displayValue}</span>
                                </div>
                              )
                            })}
                            {isActive && (
                              <div className="admin-trading-worker-card-actions">
                                <button
                                  className="admin-trading-close-trade-btn admin-trading-close-trade-btn--win"
                                  onClick={() => {
                                    closeTrade(trade.chat_id, trade.id, trade.amount ?? null, true)
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
                                  className="admin-trading-close-trade-btn admin-trading-close-trade-btn--loss"
                                  onClick={() => {
                                    closeTrade(trade.chat_id, trade.id, trade.amount ?? null, false)
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
                            <Pagination
                              currentPage={currentTradesPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentTradesPage}
                            />
                          </>
                        )
                      })()}
                    </>
                  )}
                </>
              )}
              {activeTab === 'messages' && (
                <>
                  {messages.length === 0 ? (
                    <div className="admin-trading-empty">
                      <p>Повідомлення не знайдені</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        // Групуємо повідомлення за користувачами (user_id)
                        // НОВА СТРУКТУРА: user_id, worker_id, message, sender
                        // Фільтруємо тільки тих користувачів, у яких ref_id дорівнює currentUserRefId
                        const recipientsMap = new Map<string | number, { messages: any[], user: any, lastMessageTime: string, lastMessage: any | null }>()
                        
                        messages.forEach((message) => {
                          const userId = message.user_id
                          if (!userId) return
                          
                          const user = messagesUserInfo[userId]
                          // Показуємо тільки користувачів, у яких ref_id дорівнює currentUserRefId
                          if (currentUserRefId && user?.ref_id !== currentUserRefId) {
                            return
                          }
                          
                          if (!recipientsMap.has(userId)) {
                            recipientsMap.set(userId, {
                              messages: [],
                              user: user || null,
                              lastMessageTime: message.created_at || '',
                              lastMessage: null
                            })
                          }
                          
                          const recipient = recipientsMap.get(userId)!
                          recipient.messages.push(message)
                          
                          // Оновлюємо час останнього повідомлення та саме повідомлення
                          if (message.created_at) {
                            const messageTime = new Date(message.created_at).getTime()
                            const currentLastTime = new Date(recipient.lastMessageTime || 0).getTime()
                            if (messageTime > currentLastTime) {
                              recipient.lastMessageTime = message.created_at
                              recipient.lastMessage = message
                            }
                          }
                        })

                        const recipients = Array.from(recipientsMap.entries()).map(([userId, data]) => {
                          // Знаходимо останнє повідомлення (найновіше за created_at)
                          const lastMessage = data.messages.reduce((latest, msg) => {
                            if (!latest) return msg
                            const msgTime = new Date(msg.created_at || 0).getTime()
                            const latestTime = new Date(latest.created_at || 0).getTime()
                            return msgTime > latestTime ? msg : latest
                          }, null as any)

                          // Визначаємо, чи останнє повідомлення від користувача (sender === 'user')
                          const isLastMessageFromUser = lastMessage && lastMessage.sender === 'user'

                          return {
                            userId,
                            ...data,
                            messageCount: data.messages.length,
                            lastMessage,
                            isLastMessageFromUser
                          }
                        }).sort((a, b) => {
                          // Сортуємо за часом останнього повідомлення (новіші першими)
                          const timeA = new Date(a.lastMessageTime || 0).getTime()
                          const timeB = new Date(b.lastMessageTime || 0).getTime()
                          return timeB - timeA
                        })

                        return (
                          <div className="admin-trading-recipients-list">
                            <div className="admin-trading-recipients-header">
                              <h3>Отримувачі ({recipients.length})</h3>
                              <button
                                className="admin-trading-subtle-button"
                                onClick={fetchMessages}
                                disabled={loading}
                                title="Оновити список повідомлень"
                              >
                                Оновити
                              </button>
                            </div>
                            <div className="admin-trading-recipients-grid">
                              {recipients.map((recipient) => {
                                return (
                                  <div
                                    key={String(recipient.userId)}
                                    className={`admin-trading-recipient-card ${recipient.isLastMessageFromUser ? 'admin-trading-recipient-card--unread' : ''}`}
                                    onClick={() => navigate(`/admin/trading/messages/${recipient.userId}`, { state: { fromTab: activeTab } })}
                                  >
                                    <div className="admin-trading-recipient-card-header">
                                      <div className="admin-trading-recipient-card-name">
                                        {recipient.user ? (
                                          <>
                                            {recipient.user.first_name || 'Користувач'} {recipient.user.username && `(@${recipient.user.username})`}
                                          </>
                                        ) : (
                                          `Chat ID: ${recipient.userId}`
                                        )}
                                      </div>
                                      {recipient.lastMessageTime && (
                                        <div className="admin-trading-recipient-card-time">
                                          {new Date(recipient.lastMessageTime).toLocaleString('uk-UA', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    <div className="admin-trading-recipient-card-preview">
                                      {recipient.lastMessage?.message?.substring(0, 100) || 'Повідомлення'}
                                      {recipient.lastMessage?.message && recipient.lastMessage.message.length > 100 ? '...' : ''}
                                    </div>
                                    <div className="admin-trading-recipient-card-footer">
                                      <span className="admin-trading-recipient-card-count">
                                        Всього: {recipient.messageCount} повідомл.
                                      </span>
                                      <button
                                        className="admin-trading-recipient-card-button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                        navigate(`/admin/trading/messages/${recipient.userId}`, { state: { fromTab: activeTab } })
                                        }}
                                      >
                                        Відкрити чат →
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )}
                </>
              )}
              {activeTab === 'new-employee' && (
                <>
                  {newEmployeeChats.length === 0 ? (
                    <div className="admin-trading-empty">
                      <p>Чаты не найдены</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        // newEmployeeChats тепер містить заявки з масивом messages
                        const chats = newEmployeeChats
                          .map((application): NewEmployeeChat | null => {
                            const chatId = application.chat_id
                            if (!chatId) return null
                            
                            // Сортуємо повідомлення від старого до нового
                            const sortedMessages = (application.messages || []).sort((a: NewEmployeeMessage, b: NewEmployeeMessage) => {
                              const timeA = new Date(a.created_at || 0).getTime()
                              const timeB = new Date(b.created_at || 0).getTime()
                              return timeA - timeB
                            })
                            
                            // Знаходимо перше повідомлення від користувача (де from === chatId)
                            const firstUserMessage = sortedMessages.find((msg: NewEmployeeMessage) => 
                              String(msg.from) === String(chatId) && msg.from !== 'bot'
                            )
                            
                            // Повертаємо до сортування від нового до старого для lastMessage
                            const reverseSorted = [...sortedMessages].reverse()
                            
                            return {
                              chatId,
                              messages: reverseSorted,
                              lastMessage: reverseSorted[0] || null,
                              step: reverseSorted[0]?.step || null,
                              firstUserMessage: firstUserMessage || null,
                              username: application.username || null,
                              isDone: application.isDone || false
                            }
                          })
                          .filter((chat): chat is NewEmployeeChat => chat !== null)
                          .sort((a, b) => {
                            const timeA = new Date(a.lastMessage?.created_at || 0).getTime()
                            const timeB = new Date(b.lastMessage?.created_at || 0).getTime()
                            return timeB - timeA
                          })

                        const { paginatedData, totalPages } = getPaginatedData(chats, currentNewEmployeePage, itemsPerPage)

                        return (
                          <div className="admin-trading-new-employee-list">
                            <div className="admin-trading-recipients-header">
                              <h3>Заявки нових співробітників ({chats.length})</h3>
                              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button
                                  onClick={() => {
                                    setNewEmployeeFilter('unprocessed')
                                    setCurrentNewEmployeePage(1)
                                  }}
                                  style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: `2px solid ${newEmployeeFilter === 'unprocessed' ? '#667eea' : 'rgba(102, 126, 234, 0.3)'}`,
                                    background: newEmployeeFilter === 'unprocessed' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                                    color: 'var(--text-color)',
                                    cursor: 'pointer',
                                    fontWeight: newEmployeeFilter === 'unprocessed' ? '600' : '400',
                                    transition: 'all 0.3s ease'
                                  }}
                                >
                                  Необроблені
                                </button>
                                <button
                                  onClick={() => {
                                    setNewEmployeeFilter('processed')
                                    setCurrentNewEmployeePage(1)
                                  }}
                                  style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: `2px solid ${newEmployeeFilter === 'processed' ? '#667eea' : 'rgba(102, 126, 234, 0.3)'}`,
                                    background: newEmployeeFilter === 'processed' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                                    color: 'var(--text-color)',
                                    cursor: 'pointer',
                                    fontWeight: newEmployeeFilter === 'processed' ? '600' : '400',
                                    transition: 'all 0.3s ease'
                                  }}
                                >
                                  Оброблені
                                </button>
                              </div>
                            </div>
                            <div className="admin-trading-recipients-grid">
                              {paginatedData.map((chat) => (
                                <div
                                  key={String(chat.chatId)}
                                  className="admin-trading-recipient-card"
                                  onClick={() => navigate(`/admin/trading/new-employee/${chat.chatId}`, { state: { fromTab: activeTab } })}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <div className="admin-trading-recipient-card-header">
                                    <div className="admin-trading-recipient-card-name">
                                      {chat.username ? (
                                        `@${chat.username}`
                                      ) : (
                                        `Chat ID: ${chat.chatId}`
                                      )}
                                    </div>
                                    {chat.lastMessage?.created_at && (
                                      <div className="admin-trading-recipient-card-time">
                                        {new Date(chat.lastMessage.created_at).toLocaleString('uk-UA', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div 
                                    className={`admin-trading-recipient-card-preview ${expandedMessages[chat.chatId] ? 'admin-trading-recipient-card-preview--expanded' : ''}`}
                                  >
                                    {chat.firstUserMessage?.message ? (
                                      <div style={{ 
                                        marginTop: '8px',
                                        color: 'var(--text-color)',
                                        fontSize: '14px',
                                        lineHeight: '1.4',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                      }}>
                                        {(() => {
                                          const message = chat.firstUserMessage.message
                                          const shouldTruncate = message.length > 150 || message.split('\n').length > 3
                                          
                                          if (shouldTruncate && !expandedMessages[chat.chatId]) {
                                            // Обрізаємо до 150 символів або до 3 рядків
                                            const lines = message.split('\n')
                                            if (lines.length > 3) {
                                              const truncated = lines.slice(0, 3).join('\n')
                                              return (
                                                <>
                                                  <div style={{ display: 'inline' }}>
                                                    {truncated}...
                                                  </div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setExpandedMessages(prev => ({
                                                        ...prev,
                                                        [chat.chatId]: !prev[chat.chatId]
                                                      }))
                                                    }}
                                                    style={{
                                                      marginLeft: '8px',
                                                      display: 'inline-block',
                                                      color: '#667eea',
                                                      background: 'rgba(102, 126, 234, 0.1)',
                                                      border: '1px solid rgba(102, 126, 234, 0.3)',
                                                      borderRadius: '4px',
                                                      cursor: 'pointer',
                                                      fontSize: '12px',
                                                      padding: '4px 8px',
                                                      fontWeight: 500,
                                                      transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                      e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                                                      e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)'
                                                      e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                                                    }}
                                                  >
                                                    Розгорнути
                                                  </button>
                                                </>
                                              )
                                            } else {
                                              return (
                                                <>
                                                  <div style={{ display: 'inline' }}>
                                                    {message.substring(0, 150)}...
                                                  </div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setExpandedMessages(prev => ({
                                                        ...prev,
                                                        [chat.chatId]: !prev[chat.chatId]
                                                      }))
                                                    }}
                                                    style={{
                                                      marginLeft: '8px',
                                                      display: 'inline-block',
                                                      color: '#667eea',
                                                      background: 'rgba(102, 126, 234, 0.1)',
                                                      border: '1px solid rgba(102, 126, 234, 0.3)',
                                                      borderRadius: '4px',
                                                      cursor: 'pointer',
                                                      fontSize: '12px',
                                                      padding: '4px 8px',
                                                      fontWeight: 500,
                                                      transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                      e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                                                      e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)'
                                                      e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                                                    }}
                                                  >
                                                    Розгорнути
                                                  </button>
                                                </>
                                              )
                                            }
                                          } else if (shouldTruncate && expandedMessages[chat.chatId]) {
                                            return (
                                              <>
                                                <div style={{ display: 'block', marginBottom: '8px' }}>
                                                  {message}
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setExpandedMessages(prev => ({
                                                      ...prev,
                                                      [chat.chatId]: !prev[chat.chatId]
                                                    }))
                                                  }}
                                                  style={{
                                                    display: 'inline-block',
                                                    color: '#667eea',
                                                    background: 'rgba(102, 126, 234, 0.1)',
                                                    border: '1px solid rgba(102, 126, 234, 0.3)',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    padding: '4px 8px',
                                                    fontWeight: 500,
                                                    transition: 'all 0.2s ease'
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                                                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)'
                                                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                                                  }}
                                                >
                                                  Згорнути
                                                </button>
                                              </>
                                            )
                                          } else {
                                            return message
                                          }
                                        })()}
                                      </div>
                                    ) : (
                                      <>
                                        <div><strong>Step:</strong> {chat.step || '—'}</div>
                                        {chat.lastMessage?.from && (
                                          <div><strong>From:</strong> {chat.lastMessage.from}</div>
                                        )}
                                        {chat.lastMessage?.to && (
                                          <div><strong>To:</strong> {chat.lastMessage.to}</div>
                                        )}
                                        {chat.lastMessage?.message && (
                                          <div style={{ marginTop: '8px' }}>
                                            {chat.lastMessage.message.substring(0, 100)}
                                            {chat.lastMessage.message.length > 100 ? '...' : ''}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <div className="admin-trading-recipient-card-footer">
                                    <span className="admin-trading-recipient-card-count">
                                      {chat.messages.length} повідомл.
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      {newEmployeeFilter === 'unprocessed' ? (
                                        <>
                                          <button
                                            className="admin-trading-recipient-card-button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              sendApprovalMessage(chat.chatId)
                                            }}
                                            disabled={sendingApproval[chat.chatId]}
                                            style={{
                                              fontSize: '12px',
                                              padding: '6px 12px',
                                              background: sendingApproval[chat.chatId] ? '#ccc' : 'var(--primary-color, #007bff)',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: sendingApproval[chat.chatId] ? 'not-allowed' : 'pointer'
                                            }}
                                          >
                                            {sendingApproval[chat.chatId] ? 'Відправка...' : 'Схвалити'}
                                          </button>
                                          <button
                                            className="admin-trading-recipient-card-button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              updateApplicationStatus(chat.chatId, true)
                                            }}
                                            disabled={updatingStatus[chat.chatId]}
                                            style={{
                                              fontSize: '12px',
                                              padding: '6px 12px',
                                              background: updatingStatus[chat.chatId] ? '#ccc' : '#4caf50',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: updatingStatus[chat.chatId] ? 'not-allowed' : 'pointer'
                                            }}
                                          >
                                            {updatingStatus[chat.chatId] ? 'Обробка...' : 'Заявка оброблена'}
                                          </button>
                                          <button
                                            className="admin-trading-recipient-card-button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              navigate(`/admin/trading/new-employee/${chat.chatId}`, { state: { fromTab: activeTab } })
                                            }}
                                          >
                                            Відкрити чат →
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            className="admin-trading-recipient-card-button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              updateApplicationStatus(chat.chatId, false)
                                            }}
                                            disabled={updatingStatus[chat.chatId]}
                                            style={{
                                              fontSize: '12px',
                                              padding: '6px 12px',
                                              background: updatingStatus[chat.chatId] ? '#ccc' : '#ff9800',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: updatingStatus[chat.chatId] ? 'not-allowed' : 'pointer'
                                            }}
                                          >
                                            {updatingStatus[chat.chatId] ? 'Обробка...' : 'Повернути до списку'}
                                          </button>
                                          <button
                                            className="admin-trading-recipient-card-button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              navigate(`/admin/trading/new-employee/${chat.chatId}`, { state: { fromTab: activeTab } })
                                            }}
                                          >
                                            Відкрити чат →
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {totalPages > 1 && (
                              <Pagination
                                currentPage={currentNewEmployeePage}
                                totalPages={totalPages}
                                onPageChange={setCurrentNewEmployeePage}
                              />
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </>
              )}
              {activeTab === 'payments' && (
                <>
                  <div className="admin-trading-payments-header">
                    <input
                      className="admin-trading-search"
                      type="search"
                      placeholder="Поиск по closer, smm, type, platform или job"
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                    />
                    <button className="admin-trading-subtle-button" onClick={fetchPayments} disabled={loading}>
                      Обновить
                    </button>
                    {isSuperAdmin && (
                      <button 
                        className="admin-trading-subtle-button" 
                        onClick={() => navigate('/admin/payments/users')}
                      >
                        Управління користувачами
                      </button>
                    )}
                    <button className="admin-trading-primary-button" onClick={() => openPaymentForm()}>
                      + Добавить платеж
                    </button>
                  </div>
                  {filteredPayments.length === 0 ? (
                    <div className="admin-trading-empty">
                      <p>Платежи не найдены</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const { paginatedData, totalPages } = getPaginatedData(filteredPayments, currentPaymentsPage, itemsPerPage)
                        return (
                          <>
                            <div className="admin-trading-payments-table-container">
                              <table className="admin-trading-payments-table">
                                <thead>
                                  <tr>
                                    <th>Closer</th>
                                    <th>SMM</th>
                                    <th>Platform</th>
                                    <th>Job</th>
                                    <th>Amount</th>
                                    <th>Type</th>
                                    <th>Создано</th>
                                    <th>Действия</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedData.map((payment: any) => (
                                    <tr key={payment.id}>
                                      <td>{payment.closer}</td>
                                      <td>{payment.smm}</td>
                                      <td>{payment.platform || '—'}</td>
                                      <td>{payment.job || '—'}</td>
                                      <td>{parseAmount(payment.amount)?.toFixed(2) ?? '—'} USDT</td>
                                      <td>
                                        <span className={`admin-trading-payment-type admin-trading-payment-type-${payment.type}`}>
                                          {payment.type}
                                        </span>
                                      </td>
                                      <td>
                                        {payment.created_at
                                          ? new Date(payment.created_at).toLocaleString('ru-RU')
                                          : '—'}
                                      </td>
                                      <td>
                                        <div className="admin-trading-payment-actions">
                                          <button
                                            className="admin-trading-edit-button"
                                            onClick={() => openPaymentForm(payment)}
                                          >
                                            Редактировать
                                          </button>
                                          <button
                                            className="admin-trading-delete-button"
                                            onClick={() => payment.id && handleDeletePayment(payment.id)}
                                          >
                                            Удалить
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {totalPages > 1 && (
                              <Pagination
                                currentPage={currentPaymentsPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPaymentsPage}
                              />
                            )}
                          </>
                        )
                      })()}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {/* Модальне вікно для звітів */}
      {showReportsModal && (
        <div className="admin-trading-modal-overlay" onClick={() => setShowReportsModal(null)}>
          <div className="admin-trading-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="admin-trading-modal-header">
              <h2>📋 Звіти клоузера</h2>
              <button className="admin-trading-modal-close" type="button" onClick={() => setShowReportsModal(null)}>
                ×
              </button>
            </div>
            <div className="admin-trading-modal-content">
              {loadingReports ? (
                <p>Завантаження...</p>
              ) : reports.length === 0 ? (
                <p>Звіти не знайдені</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {reports.map((report) => (
                    <div key={report.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <strong>ID:</strong> {report.id}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {new Date(report.created_at).toLocaleString('uk-UA')}
                        </div>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Тип:</strong> {report.message_type}
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Статус:</strong> {report.status === 'read' ? '✅ Прочитано' : '📬 Непрочитано'}
                      </div>
                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <strong>Текст звіту:</strong>
                        <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                          {report.message_text || <span style={{ color: '#999', fontStyle: 'italic' }}>Текст відсутній</span>}
                        </div>
                      </div>
                      {report.file_id && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                          <strong>File ID:</strong> {report.file_id}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальне вікно для лідів */}
      {showLeadsModal && (
        <div className="admin-trading-modal-overlay" onClick={() => setShowLeadsModal(null)}>
          <div className="admin-trading-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="admin-trading-modal-header">
              <h2>👤 Ліди клоузера</h2>
              <button className="admin-trading-modal-close" type="button" onClick={() => setShowLeadsModal(null)}>
                ×
              </button>
            </div>
            <div className="admin-trading-modal-content">
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <button
                  className={leadStatusFilter === 'all' ? 'admin-trading-tab active' : 'admin-trading-tab'}
                  onClick={() => {
                    setLeadStatusFilter('all')
                    fetchLeads(showLeadsModal, 'all')
                  }}
                >
                  Всі
                </button>
                <button
                  className={leadStatusFilter === 'active' ? 'admin-trading-tab active' : 'admin-trading-tab'}
                  onClick={() => {
                    setLeadStatusFilter('active')
                    fetchLeads(showLeadsModal, 'active')
                  }}
                >
                  Активні
                </button>
                <button
                  className={leadStatusFilter === 'rejected' ? 'admin-trading-tab active' : 'admin-trading-tab'}
                  onClick={() => {
                    setLeadStatusFilter('rejected')
                    fetchLeads(showLeadsModal, 'rejected')
                  }}
                >
                  Відмовлені
                </button>
                <button
                  className={leadStatusFilter === 'closed' ? 'admin-trading-tab active' : 'admin-trading-tab'}
                  onClick={() => {
                    setLeadStatusFilter('closed')
                    fetchLeads(showLeadsModal, 'closed')
                  }}
                >
                  Закриті
                </button>
              </div>
              {loadingLeads ? (
                <p>Завантаження...</p>
              ) : leads.length === 0 ? (
                <p>Ліди не знайдені</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {leads.map((lead) => (
                    <div key={lead.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <strong>ID:</strong> {lead.id}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {new Date(lead.created_at).toLocaleString('uk-UA')}
                        </div>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Статус:</strong>{' '}
                        {lead.lead_status === 'new' ? '🆕 Новий' :
                         lead.lead_status === 'contacted' ? '📞 Зв\'язався' :
                         lead.lead_status === 'converted' ? '✅ Конвертувався' :
                         lead.lead_status === 'lost' ? '❌ Втрачений' :
                         lead.lead_status === 'rejected' ? '🚫 Відмовлений' :
                         lead.lead_status === 'closed' ? '🔒 Закритий' :
                         lead.lead_status}
                      </div>
                      {lead.lead_name && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Ім'я:</strong> {lead.lead_name}
                        </div>
                      )}
                      {lead.lead_contact && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Контакт:</strong> {lead.lead_contact}
                        </div>
                      )}
                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <strong>Інформація про ліда:</strong>
                        <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                          {lead.lead_info ? (
                            lead.lead_info.length > 500 ? (
                              <>
                                {lead.lead_info.substring(0, 500)}...
                                <button
                                  onClick={() => {
                                    const fullText = document.getElementById(`lead-info-${lead.id}`)
                                    if (fullText) {
                                      fullText.style.display = fullText.style.display === 'none' ? 'block' : 'none'
                                    }
                                  }}
                                  style={{ marginLeft: '8px', padding: '4px 8px', fontSize: '12px' }}
                                >
                                  Показати повністю
                                </button>
                                <div id={`lead-info-${lead.id}`} style={{ display: 'none', marginTop: '8px' }}>
                                  {lead.lead_info}
                                </div>
                              </>
                            ) : (
                              lead.lead_info
                            )
                          ) : (
                            <span style={{ color: '#999', fontStyle: 'italic' }}>Інформація відсутня</span>
                          )}
                        </div>
                      </div>
                      {lead.notes && (
                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                          <strong>Нотатки:</strong>
                          <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>{lead.notes}</div>
                        </div>
                      )}
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                        <strong>Оновлено:</strong> {new Date(lead.updated_at).toLocaleString('uk-UA')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {formModalOpen && (
        <div className="admin-trading-modal-overlay" onClick={closePaymentForm}>
          <div className="admin-trading-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-trading-modal-header">
              <h2>{editingPayment ? 'Редактировать платеж' : 'Добавить платеж'}</h2>
              <button className="admin-trading-modal-close" type="button" onClick={closePaymentForm}>
                ×
              </button>
            </div>
            <form className="admin-trading-payment-form" onSubmit={handlePaymentSubmit}>
              <div className="admin-trading-form-field">
                <label htmlFor="closer">Closer *</label>
                <input
                  id="closer"
                  type="text"
                  placeholder="Введите closer"
                  value={paymentFormData.closer}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, closer: e.target.value })}
                  disabled={paymentFormLoading}
                  required
                />
              </div>
              <div className="admin-trading-form-field">
                <label htmlFor="smm">SMM *</label>
                <input
                  id="smm"
                  type="text"
                  placeholder="Введите smm"
                  value={paymentFormData.smm}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, smm: e.target.value })}
                  disabled={paymentFormLoading}
                  required
                />
              </div>
              <div className="admin-trading-form-field">
                <label htmlFor="platform">Platform</label>
                <input
                  id="platform"
                  type="text"
                  placeholder="Введите platform"
                  value={paymentFormData.platform}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, platform: e.target.value })}
                  disabled={paymentFormLoading}
                />
              </div>
              <div className="admin-trading-form-field">
                <label htmlFor="job">Job</label>
                <input
                  id="job"
                  type="text"
                  placeholder="Введите job"
                  value={paymentFormData.job}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, job: e.target.value })}
                  disabled={paymentFormLoading}
                />
              </div>
              <div className="admin-trading-form-field">
                <label htmlFor="amount">Amount (USDT) *</label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Введите сумму"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  disabled={paymentFormLoading}
                  required
                />
              </div>
              <div className="admin-trading-form-field">
                <label htmlFor="type">Type *</label>
                <select
                  id="type"
                  value={paymentFormData.type}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, type: e.target.value as 'trading' | 'ico' })}
                  disabled={paymentFormLoading}
                  required
                >
                  <option value="trading">Trading</option>
                  <option value="ico">ICO</option>
                </select>
              </div>
              {paymentFormError && <div className="admin-trading-form-error">{paymentFormError}</div>}
              <button type="submit" className="admin-trading-form-submit" disabled={paymentFormLoading}>
                {paymentFormLoading
                  ? editingPayment
                    ? 'Сохранение...'
                    : 'Создание...'
                  : editingPayment
                    ? 'Сохранить'
                    : 'Создать'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminTradingPage

