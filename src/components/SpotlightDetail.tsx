import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './SpotlightDetail.css'

interface Spotlight {
  id: number
  created_at?: string
  name?: string
  symbol?: string
  total_supply?: number
  market_cap?: number
  price?: number
  trading_volume?: number
  img?: string
  description?: string
  [key: string]: any
}

// Function to convert image reference to proper URL
const getImageUrl = (img: string): string => {
  if (!img) return ''
  
  // If it's already a full URL (http/https), return as is
  if (img.startsWith('http://') || img.startsWith('https://')) {
    // Check if it's a Google Drive URL
    const driveMatch = img.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1]
      return `https://drive.google.com/uc?export=view&id=${fileId}`
    }
    return img
  }
  
  // If it's a local image reference (like "image1", "image2"), add path and extension
  if (img.match(/^image\d+$/)) {
    return `/${img}.jpeg`
  }
  
  // If it already has extension, just add leading slash
  if (img.includes('.')) {
    return img.startsWith('/') ? img : `/${img}`
  }
  
  // Default: assume it's in public folder
  return `/${img}`
}

function SpotlightDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [allocations, setAllocations] = useState<
    Array<{ id: number; amount: number; status: string | null; created_at: string | null; expired_at: string | null }>
  >([])
  const [allocationsLoading, setAllocationsLoading] = useState(false)
  const [allocationsError, setAllocationsError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSpotlight = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('spotlights')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        setSpotlight(data)
        setError(null)
      } catch (err: any) {
        setError(err.message)
        console.error('Error fetching spotlight:', err)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchSpotlight()
    }
  }, [id])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const storedRaw = window.localStorage.getItem('spotlight_user')
      if (!storedRaw) return
      const parsed = JSON.parse(storedRaw) as { email?: string } | null
      if (parsed?.email) {
        setUserEmail(parsed.email)
      }
    } catch (storageError) {
      console.error('Не удалось прочитать локальные данные пользователя', storageError)
    }
  }, [])

  useEffect(() => {
    if (!userEmail) return

    let cancelled = false

    const fetchUser = async () => {
      try {
        const { data, error: userError } = await supabase
          .from('spotlights_users')
          .select('id')
          .eq('email', userEmail)
          .maybeSingle()

        if (userError) throw userError
        if (!cancelled) {
          setUserId(data?.id ?? null)
        }
      } catch (fetchError) {
        console.error('Не удалось получить пользователя', fetchError)
      }
    }

    fetchUser()

    return () => {
      cancelled = true
    }
  }, [userEmail])

  useEffect(() => {
    if (!userId || !spotlight?.id) return

    let cancelled = false
    const fetchAllocations = async () => {
      setAllocationsLoading(true)
      setAllocationsError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('spotlights_allocations')
          .select('id, amount, status, created_at, expired_at')
          .eq('users_id', userId)
          .eq('coin_id', spotlight.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError

        if (!cancelled) {
          const mapped =
            data?.map((item) => ({
              id: item.id,
              amount: Number(item.amount ?? 0),
              status: item.status ?? null,
              created_at: item.created_at ?? null,
              expired_at: item.expired_at ?? null
            })) ?? []
          setAllocations(mapped)
        }
      } catch (fetchError: any) {
        if (!cancelled) {
          console.error('Не удалось загрузить аллокации пользователя', fetchError)
          setAllocationsError(fetchError.message || 'Не удалось загрузить ваши аллокации.')
        }
      } finally {
        if (!cancelled) {
          setAllocationsLoading(false)
        }
      }
    }

    fetchAllocations()

    return () => {
      cancelled = true
    }
  }, [userId, spotlight?.id])

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString('ru-RU')
    } catch (err) {
      return value
    }
  }

  if (loading) {
    return (
      <div className="spotlight-detail">
        <div className="loading">Загрузка...</div>
      </div>
    )
  }

  if (error || !spotlight) {
    return (
      <div className="spotlight-detail">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Назад
        </button>
        <div className="error-message">
          <strong>Ошибка:</strong> {error || 'Проект не найден'}
        </div>
      </div>
    )
  }

  return (
    <div className="spotlight-detail">
      <button className="back-button" onClick={() => navigate('/')}>
        ← Назад к списку
      </button>

      <div className="detail-container">
        <div className="detail-header">
          {spotlight.img && (
            <div className="detail-image-container">
              <img 
                src={getImageUrl(spotlight.img)} 
                alt={spotlight.name || 'Spotlight'} 
                className="detail-image"
              />
            </div>
          )}
          
          <div className="detail-title-section">
            <h1 className="detail-title">{spotlight.name || 'Untitled'}</h1>
            {spotlight.symbol && (
              <span className="detail-symbol">({spotlight.symbol})</span>
            )}
            <button
              className="detail-allocation-button"
              type="button"
              onClick={() => navigate(`/allocation?coinId=${spotlight.id}`)}
            >
              Добавить аллокацию
            </button>
          </div>
        </div>

        {spotlight.description && (
          <div className="detail-section">
            <h2>Описание</h2>
            <p className="detail-description">{spotlight.description}</p>
          </div>
        )}

        {(spotlight.price || spotlight.total_supply || spotlight.market_cap || spotlight.trading_volume) && (
          <div className="detail-section">
            <h2>Финансовые показатели</h2>
            <div className="detail-stats">
              {spotlight.price !== undefined && (
                <div className="stat-card">
                  <div className="stat-label">Цена</div>
                  <div className="stat-value">${spotlight.price}</div>
                </div>
              )}
              {spotlight.market_cap !== undefined && (
                <div className="stat-card">
                  <div className="stat-label">Рыночная капитализация</div>
                  <div className="stat-value">${spotlight.market_cap.toLocaleString()}</div>
                </div>
              )}
              {spotlight.total_supply !== undefined && (
                <div className="stat-card">
                  <div className="stat-label">Общее предложение</div>
                  <div className="stat-value">{spotlight.total_supply.toLocaleString()}</div>
                </div>
              )}
              {spotlight.trading_volume !== undefined && (
                <div className="stat-card">
                  <div className="stat-label">Объем торгов</div>
                  <div className="stat-value">${spotlight.trading_volume.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {userEmail && (
          <div className="detail-section">
            <h2>Ваши активные аллокации</h2>
            {allocationsLoading ? (
              <div className="user-allocations-loading">Загрузка аллокаций...</div>
            ) : allocationsError ? (
              <div className="user-allocations-error">{allocationsError}</div>
            ) : allocations.length === 0 ? (
              <div className="user-allocations-empty">Активные аллокации для этой монеты отсутствуют.</div>
            ) : (
              <div className="user-allocations-list">
                {allocations.map((allocation) => (
                  <div className="user-allocation-card" key={allocation.id}>
                    <div className="user-allocation-row">
                      <span className="user-allocation-label">Сумма</span>
                      <span className="user-allocation-value">{allocation.amount.toFixed(2)} USDT</span>
                    </div>
                    <div className="user-allocation-row">
                      <span className="user-allocation-label">Создана</span>
                      <span className="user-allocation-value">{formatDate(allocation.created_at)}</span>
                    </div>
                    <div className="user-allocation-row">
                      <span className="user-allocation-label">Экспирация</span>
                      <span className="user-allocation-value">{formatDate(allocation.expired_at)}</span>
                    </div>
                    <span className={`user-allocation-badge user-allocation-badge--${(allocation.status ?? 'active').toLowerCase()}`}>
                      {allocation.status === 'active' ? 'Активна' : allocation.status ?? 'Активна'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Removed auxiliary metadata block per request */}
      </div>
    </div>
  )
}

export default SpotlightDetail

