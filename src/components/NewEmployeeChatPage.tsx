import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Send, RefreshCw } from 'lucide-react'
import './MessagesChatPage.css'

const STORAGE_KEY = 'spotlight_user'

interface StoredUser {
  email: string
  type?: string
}

const NewEmployeeChatPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { chatId } = useParams<{ chatId: string }>()
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
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
          // Доступ для superadmin та hr
          if (parsed?.type === 'superadmin' || parsed?.type === 'hr') {
            setInitialized(true)
            return
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
    if (!chatId) return

    if (showLoading) {
      setLoading(true)
    }
    setError(null)
    try {
      // Завантажуємо повідомлення з таблиці new-employee-messages для цього chat_id
      const { data, error: fetchError } = await supabase
        .from('new-employee-messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      if (fetchError) {
        console.error('Помилка завантаження повідомлень:', fetchError)
        throw fetchError
      }

      console.log('Завантажено повідомлень:', data?.length || 0, 'для chatId:', chatId)

      // Сортуємо повідомлення за датою створення (від старого до нового)
      const sortedMessages = (data || []).sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateA - dateB
      })

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
    if (!initialized || !chatId) return
    fetchMessages()
  }, [initialized, chatId])

  // Автоскрол до останнього повідомлення
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!messageText.trim() || !chatId || sending) return

    const messageToSend = messageText.trim()
    setSending(true)
    setError(null)

    // Оптимістичне оновлення - додаємо повідомлення одразу
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      chat_id: chatId,
      from: 'admin',
      to: chatId,
      message: messageToSend,
      step: null,
      created_at: new Date().toISOString()
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setMessageText('')

    try {
      console.log('Відправка повідомлення new-employee:', {
        type: 'new_employee',
        chat_id: chatId,
        message: messageToSend
      })

      // Відправляємо повідомлення через edge function logic
      const { error } = await supabase.functions.invoke('logic', {
        body: {
          type: 'new_employee',
          chat_id: chatId,
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
      await new Promise(resolve => setTimeout(resolve, 500))

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
              onClick={() => navigate(`/admin/trading/${fromTab || 'new-employee'}`)}
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
            <h1>Чат нового співробітника</h1>
            {chatId && (
              <div className="messages-chat-header-user">
                <span>Chat ID: {chatId}</span>
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
                // Зліва: повідомлення, де chat_id === chatId (від користувача)
                // Справа: всі інші (від адміна)
                const isFromUser = String(message.from) === String(chatId)
                console.log('isFromUser', isFromUser)
                const prevMessage = index > 0 ? messages[index - 1] : null
                const showDateSeparator = !prevMessage || 
                  new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString()

                return (
                  <div key={message.id || `msg-${index}`}>
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
                            {isFromUser ? `Користувач (${message.from || chatId})` : 'Адмін'}
                          </span>
                          {message.step && (
                            <span className="messages-chat-message-step" style={{ fontSize: '0.85em', opacity: 0.7 }}>
                              Step: {message.step}
                            </span>
                          )}
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
              placeholder="Введіть повідомлення..."
              value={messageText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              rows={1}
              disabled={sending}
            />
            <button
              className="messages-chat-send-button"
              onClick={sendMessage}
              disabled={!messageText.trim() || sending}
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

export default NewEmployeeChatPage

