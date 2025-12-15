import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, User, Send, RefreshCw } from 'lucide-react'
import './MessagesChatPage.css'

const STORAGE_KEY = 'spotlight_user'

interface StoredUser {
  email: string
  type?: string
}

const MessagesChatPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { toChatId } = useParams<{ toChatId: string }>()
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [toUser, setToUser] = useState<any>(null)
  const [currentUserRefId, setCurrentUserRefId] = useState<string | number | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [messageText, setMessageText] = useState<string>('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fromTab = (location.state as { fromTab?: string } | null)?.fromTab

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAccess = async () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed: StoredUser | null = JSON.parse(stored)
          if (parsed?.type === 'admin' || parsed?.type === 'superadmin') {
            // Для superadmin - повний доступ, але також отримуємо ref_id якщо є
            if (parsed?.type === 'superadmin') {
              setIsSuperAdmin(true)
              const { data: currentUserInSpotlights } = await supabase
                .from('spotlights_users')
                .select('ref_id, email')
                .eq('type', 'superadmin')
                .eq('email', parsed?.email || '')
                .maybeSingle()

              if (currentUserInSpotlights?.ref_id) {
                setCurrentUserRefId(currentUserInSpotlights.ref_id)
              }
              setInitialized(true)
              return
            }

            // Для admin - перевіряємо, чи є ref_id
            if (parsed?.type === 'admin') {
              setIsSuperAdmin(false)
              const { data: currentUserInSpotlights } = await supabase
                .from('spotlights_users')
                .select('ref_id, email')
                .eq('type', 'admin')
                .eq('email', parsed?.email || '')
                .maybeSingle()

              // Доступ тільки якщо є ref_id
              if (currentUserInSpotlights?.ref_id) {
                setCurrentUserRefId(currentUserInSpotlights.ref_id)
                setInitialized(true)
                return
              }
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

  const fetchMessages = async (showLoading = true) => {
    if (!toChatId) return

    if (showLoading) {
      setLoading(true)
    }
    setError(null)
    try {
      // Завантажуємо інформацію про отримувача
      // toChatId - це chat_id користувача (поле to в таблиці messages)
      const { data: userData } = await supabase
        .from('users')
        .select('id, chat_id, first_name, username, ref_id')
        .eq('chat_id', toChatId)
        .single()

      if (userData) {
        setToUser(userData)
        // currentUserRefId вже встановлений в checkAccess (ref_id воркера/superadmin)
        // userData.ref_id - це ref_id користувача, з яким ведеться розмова
      }

      // Завантажуємо повідомлення
      // Показуємо всі повідомлення, де користувач (toChatId) є учасником:
      // - Від користувача: from = toChatId
      // - До користувача: to = toChatId
      let query = supabase
        .from('messages')
        .select('*')
        .or(`from.eq.${toChatId},to.eq.${toChatId}`)

      query = query.order('created_at', { ascending: true })

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Помилка завантаження повідомлень:', fetchError)
        throw fetchError
      }

      console.log('Завантажено повідомлень:', data?.length || 0, 'для toChatId:', toChatId, 'currentUserRefId:', currentUserRefId)

      // Сортуємо повідомлення за датою створення (від старого до нового)
      const sortedMessages = (data || []).sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateA - dateB
      })

      console.log('Відсортовано повідомлень:', sortedMessages.length)
      setMessages(sortedMessages)
    } catch (err: any) {
      console.error('Ошибка загрузки повідомлень', err)
      setError(err.message || 'Не удалось загрузить повідомлення.')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!initialized || !toChatId) return
    fetchMessages()
  }, [initialized, toChatId, currentUserRefId])

  // Автоскрол до останнього повідомлення
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    // Для superadmin дозволяємо відправку навіть без ref_id
    const canSend = isSuperAdmin || currentUserRefId
    if (!messageText.trim() || !toChatId || !canSend || sending) return

    const messageToSend = messageText.trim()
    setSending(true)
    setError(null)

    // Для superadmin без ref_id використовуємо toChatId як from (від імені користувача)
    const fromId = currentUserRefId || (isSuperAdmin ? toChatId : null)
    if (!fromId) return

    // Оптимістичне оновлення - додаємо повідомлення одразу
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      from: fromId,
      to: toChatId,
      message: messageToSend,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setMessageText('')

    try {
      console.log('Відправка повідомлення:', {
        type: 'send_message',
        ref_id: currentUserRefId || (isSuperAdmin ? toChatId : null),
        chat_id: toChatId,
        message: messageToSend,
        isSuperAdmin
      })

      const { error } = await supabase.functions.invoke('logic', {
        body: {
          type: 'send_message',
          ref_id: currentUserRefId || (isSuperAdmin ? toChatId : null),  // Для superadmin без ref_id використовуємо toChatId
          chat_id: toChatId,
          message: messageToSend
        }
      })

      if (error) {
        console.error('Помилка Edge Function:', error)
        // Якщо помилка, видаляємо оптимістичне повідомлення
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id))
        throw error
      }

      console.log('Повідомлення відправлено успішно, очікуємо оновлення...')

      // Очікуємо невелику затримку, щоб повідомлення встигло зберегтися в БД
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Оновлюємо список повідомлень з сервера (без показу loading)
      console.log('Оновлюємо список повідомлень...')
      await fetchMessages(false)
      console.log('Список повідомлень оновлено')
    } catch (err: any) {
      console.error('Ошибка отправки повідомлення', err)
      setError(err.message || 'Не удалось отправить повідомлення.')
      // Повертаємо текст повідомлення в поле вводу при помилці
      setMessageText(messageToSend)
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value)
    // Автоматично збільшуємо висоту textarea при введенні тексту
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  if (!initialized) {
    return null
  }

  return (
    <div className="messages-chat-page">
      <div className="messages-chat-card">
        <div className="messages-chat-header">
          <div className="messages-chat-header-actions">
            <button
              className="messages-chat-back-button"
              onClick={() => navigate(`/admin/trading/${fromTab || 'messages'}`)}
            >
              <ArrowLeft size={20} />
              <span>Назад до списку</span>
            </button>
            <button
              className="messages-chat-refresh-button"
              onClick={() => fetchMessages()}
              disabled={loading}
              title="Оновити повідомлення"
            >
              <RefreshCw size={18} className={loading ? 'spinning' : ''} />
              <span>Оновити</span>
            </button>
          </div>
          <div className="messages-chat-header-info">
            <h1>Чат</h1>
            {toUser && (
              <div className="messages-chat-header-user">
                <User size={18} />
                <span>
                  {toUser.first_name || 'Користувач'} {toUser.username && `(@${toUser.username})`}
                </span>
                {toUser.chat_id && (
                  <span className="messages-chat-header-chat-id">ID: {toUser.chat_id}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {error && <div className="messages-chat-error">{error}</div>}

        <div className="messages-chat-container">
          {loading ? (
            <div className="messages-chat-loading">Загрузка...</div>
          ) : messages.length === 0 ? (
            <div className="messages-chat-empty">
              <p>Немає повідомлень</p>
            </div>
          ) : (
            <div className="messages-chat-messages-list">
              {messages.map((message, index) => {
                // Зліва: повідомлення, де from === toChatId (від користувача)
                // Справа: всі інші (від воркера/адміна)
                const isFromUser = String(message.from) === String(toChatId)
                const prevMessage = index > 0 ? messages[index - 1] : null
                const showDateSeparator = !prevMessage || 
                  new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString()

                return (
                  <div key={message.id}>
                    {showDateSeparator && (
                      <div className="messages-chat-date-separator">
                        {new Date(message.created_at).toLocaleDateString('uk-UA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    )}
                    <div className={`messages-chat-message ${isFromUser ? 'from-user' : 'from-worker'}`}>
                      <div className="messages-chat-message-bubble">
                        <div className="messages-chat-message-header">
                          <span className="messages-chat-message-sender">
                            {isFromUser ? (toUser?.first_name || 'Користувач') : 'Воркер'}
                          </span>
                          <span className="messages-chat-message-time">
                            {new Date(message.created_at).toLocaleTimeString('uk-UA', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="messages-chat-message-text">
                          {message.message || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Форма відправки повідомлення */}
        <div className="messages-chat-input-container">
          <div className="messages-chat-input-wrapper">
            <textarea
              className="messages-chat-input"
              placeholder={(isSuperAdmin || currentUserRefId) ? "Введіть повідомлення..." : "Завантаження..."}
              value={messageText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              rows={1}
              disabled={sending || !(isSuperAdmin || currentUserRefId)}
            />
            <button
              className="messages-chat-send-button"
              onClick={sendMessage}
              disabled={!messageText.trim() || sending || !(isSuperAdmin || currentUserRefId)}
              title="Відправити повідомлення (Enter)"
            >
              {sending ? (
                <div className="messages-chat-send-spinner" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MessagesChatPage

