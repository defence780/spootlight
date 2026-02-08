import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './WorkerReportsPage.css'

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
  worker?: {
    chat_id: number
    username?: string | null
    first_name?: string | null
  } | null
}

const WorkerReportsPage = () => {
  const navigate = useNavigate()
  const { closerChatId } = useParams<{ closerChatId: string }>()
  const [reports, setReports] = useState<WorkerReport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closerInfo, setCloserInfo] = useState<{ username?: string | null; first_name?: string | null } | null>(null)

  useEffect(() => {
    if (closerChatId) {
      fetchCloserInfo()
      fetchReports(Number(closerChatId))
    }
  }, [closerChatId])

  const fetchCloserInfo = async () => {
    if (!closerChatId) return
    
    try {
      const { data, error } = await supabase
        .from('analytics-users')
        .select('username, first_name')
        .eq('chat_id', Number(closerChatId))
        .single()

      if (error) {
        console.error('Error fetching closer info:', error)
        return
      }

      setCloserInfo(data)
    } catch (err) {
      console.error('Error fetching closer info:', err)
    }
  }

  const fetchReports = async (closerChatId: number) => {
    setLoading(true)
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
      
      // Отримуємо інформацію про воркерів для кожного звіту
      if (data && data.length > 0) {
        const workerChatIds = [...new Set(data.map((r) => r.worker_chat_id).filter(Boolean))]
        const { data: workers } = await supabase
          .from('analytics-users')
          .select('chat_id, username, first_name')
          .in('chat_id', workerChatIds)

        const workersMap = new Map()
        workers?.forEach((w) => {
          workersMap.set(w.chat_id, w)
        })

        // Додаємо інформацію про воркера до кожного звіту
        const reportsWithWorkers = data.map((report) => ({
          ...report,
          worker: workersMap.get(report.worker_chat_id) || null
        }))

        setReports(reportsWithWorkers)
      } else {
        setReports([])
      }
    } catch (err: any) {
      console.error('Ошибка загрузки звітів', err)
      setError(err.message || 'Не удалось загрузить звіти.')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (reportId: number) => {
    try {
      const { error } = await supabase
        .from('worker_reports')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', reportId)

      if (error) {
        console.error('Error marking report as read:', error)
        return
      }

      // Оновлюємо локальний стан
      setReports(reports.map(report => 
        report.id === reportId 
          ? { ...report, status: 'read' as const, read_at: new Date().toISOString() }
          : report
      ))
    } catch (err) {
      console.error('Error marking report as read:', err)
    }
  }

  const closerName = closerInfo 
    ? (closerInfo.username ? `@${closerInfo.username}` : closerInfo.first_name || `ID: ${closerChatId}`)
    : `ID: ${closerChatId}`

  const unreadCount = reports.filter(r => r.status === 'unread').length

  return (
    <div className="worker-reports-page">
      <div className="worker-reports-header">
        <button 
          className="worker-reports-back-btn" 
          onClick={() => navigate('/admin/trading/workers')}
        >
          ← Назад
        </button>
        <div className="worker-reports-title-section">
          <h1>📋 Звіти клоузера</h1>
          <div className="worker-reports-closer-name">{closerName}</div>
          {unreadCount > 0 && (
            <div className="worker-reports-unread-badge">
              Непрочитаних: {unreadCount}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="worker-reports-error">
          {error}
        </div>
      )}

      <div className="worker-reports-content">
        {loading ? (
          <div className="worker-reports-loading">Завантаження...</div>
        ) : reports.length === 0 ? (
          <div className="worker-reports-empty">
            <p>Звіти не знайдені</p>
          </div>
        ) : (
          <div className="worker-reports-list">
            {reports.map((report) => {
              const workerName = report.worker 
                ? (report.worker.username ? `@${report.worker.username}` : report.worker.first_name || `ID: ${report.worker.chat_id}`)
                : `ID: ${report.worker_chat_id}`
              const messageTypeIcon = report.message_type === 'photo' ? '📷' : 
                                     report.message_type === 'document' ? '📄' : 
                                     report.message_type === 'video' ? '🎥' : '💬'
              
              return (
                <div 
                  key={report.id} 
                  className={`worker-reports-item ${report.status === 'unread' ? 'unread' : ''}`}
                >
                  <div className="worker-reports-item-header">
                    <div className="worker-reports-item-info">
                      <div className="worker-reports-item-worker">
                        <strong>👤 {workerName}</strong>
                        {report.status === 'unread' && (
                          <span className="worker-reports-item-new-badge">
                            НОВИЙ
                          </span>
                        )}
                      </div>
                      <div className="worker-reports-item-type">
                        {messageTypeIcon} {report.message_type === 'photo' ? 'Фото' : 
                                         report.message_type === 'document' ? 'Документ' : 
                                         report.message_type === 'video' ? 'Відео' : 'Текст'}
                      </div>
                    </div>
                    <div className="worker-reports-item-date">
                      <div>{new Date(report.created_at).toLocaleDateString('uk-UA')}</div>
                      <div>{new Date(report.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  
                  <div className="worker-reports-item-content">
                    <div className="worker-reports-item-text">
                      {report.message_text || <span className="worker-reports-item-empty">Текст відсутній</span>}
                    </div>
                  </div>
                  
                  {report.file_id && (
                    <div className="worker-reports-item-file">
                      <strong>📎 Файл:</strong> {report.file_id}
                    </div>
                  )}
                  
                  {report.read_at && (
                    <div className="worker-reports-item-read-at">
                      Прочитано: {new Date(report.read_at).toLocaleString('uk-UA')}
                    </div>
                  )}

                  {report.status === 'unread' && (
                    <button
                      className="worker-reports-item-mark-read"
                      onClick={() => markAsRead(report.id)}
                    >
                      Позначити як прочитане
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkerReportsPage
