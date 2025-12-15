import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NETWORKS, NetworkKey } from '../constants/topupNetworks'
import './TopUpPage.css'

const STORAGE_KEY = 'spotlight_user'

const TopUpPage = () => {
  const navigate = useNavigate()
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey>('bsc')
  const [copyStatus, setCopyStatus] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [amountInput, setAmountInput] = useState('')
  const [confirmedAmount, setConfirmedAmount] = useState<string | null>(null)
  const [amountError, setAmountError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const storedUser = window.localStorage.getItem(STORAGE_KEY)
      if (storedUser) {
        const parsed = JSON.parse(storedUser)
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

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAmountInput(event.target.value)
    if (amountError) {
      setAmountError('')
    }
  }

  const handleAmountSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = amountInput.replace(',', '.').trim()

    if (!normalized) {
      setAmountError('Введите сумму пополнения.')
      return
    }

    const numeric = parseFloat(normalized)
    if (Number.isNaN(numeric) || numeric <= 0) {
      setAmountError('Введите корректную сумму больше 0.')
      return
    }

    if (!userEmail) {
      setAmountError('Не удалось определить пользователя. Пожалуйста, войдите снова.')
      return
    }

    const formatted = numeric.toLocaleString('ru-RU', {
      minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 8
    })

    try {
      const { error } = await supabase.from('spotlights_deposits').insert({
        email: userEmail,
        amount: formatted
      })

      if (error) {
        console.error('Ошибка сохранения заявки на пополнение', error)
        setAmountError('Не удалось создать заявку. Попробуйте снова позже.')
        return
      }

      setConfirmedAmount(formatted)
      setAmountError('')
      setStep(2)
      setCopyStatus('')
    } catch (dbError) {
      console.error('Неожиданная ошибка при сохранении депозита', dbError)
      setAmountError('Произошла ошибка. Попробуйте снова позже.')
    }
  }

  const handleEditAmount = () => {
    setStep(1)
    setCopyStatus('')
  }

  const handleCopyAddress = async () => {
    const address = NETWORKS[selectedNetwork].address
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(address)
        setCopyStatus('Адрес скопирован')
      } else {
        throw new Error('Clipboard API недоступен')
      }
    } catch (error) {
      setCopyStatus('Не удалось скопировать. Скопируйте вручную.')
    }

    setTimeout(() => setCopyStatus(''), 3000)
  }

  const displayAmount = confirmedAmount ?? (amountInput ? amountInput : '—')

  return (
    <div className="topup-page">
      <div className="topup-card">
        <div className="topup-header">
          <div className="topup-titles">
            <h1>Пополнение аккаунта</h1>
            <p>Укажите сумму и получите реквизиты для перевода средств</p>
            {userEmail && <span className="topup-user">Ваш аккаунт: {userEmail}</span>}
          </div>
          <button className="back-button" onClick={() => navigate('/')}>← Назад</button>
        </div>

        {step === 1 && (
          <div className="topup-stage topup-stage--amount">
            <div className="step-header">
              <div>
                <span className="step-badge">Шаг 1</span>
                <h2 className="step-title">Укажите желаемую сумму пополнения</h2>
                <p className="step-subtitle">Мы подготовим для вас адрес для перевода</p>
              </div>
            </div>

            <form className="amount-form" onSubmit={handleAmountSubmit}>
              <label htmlFor="topupAmount">Сумма пополнения</label>
              <div className="amount-input-wrapper">
                <input
                  id="topupAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Например, 250"
                  value={amountInput}
                  onChange={handleAmountChange}
                />
                <span className="amount-suffix">USDT</span>
              </div>
              {amountError && <p className="amount-error">{amountError}</p>}

              <button type="submit" className="amount-submit-button">
                Создать заявку
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="topup-stage topup-stage--networks">
            <div className="step-header">
              <div>
                <span className="step-badge">Шаг 2</span>
                <h2 className="step-title">Выберите сеть и отправьте средства</h2>
                <p className="step-subtitle">Используйте адрес, совместимый с выбранной сетью</p>
              </div>
              <button type="button" className="edit-amount-button" onClick={handleEditAmount}>
                Изменить сумму
              </button>
            </div>

            <div className="amount-summary">
              <span className="summary-label">Сумма пополнения:</span>
              <span className="summary-value">{displayAmount} USDT</span>
            </div>

            <div className="topup-body">
              <div className="topup-networks">
                <h2>Доступные сети</h2>
                <div className="topup-network-grid">
                  {Object.entries(NETWORKS).map(([key, network]) => (
                    <button
                      key={key}
                      type="button"
                      className={`topup-network ${selectedNetwork === key ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedNetwork(key as NetworkKey)
                        setCopyStatus('')
                      }}
                    >
                      <span className="network-label">{network.label}</span>
                      <span className="network-description">{network.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="topup-address-block">
                <h2>Адрес для перевода</h2>
                <div className="topup-address-box">
                  <span className="topup-address">{NETWORKS[selectedNetwork].address}</span>
                  <button className="copy-address-button" type="button" onClick={handleCopyAddress}>
                    Скопировать
                  </button>
                </div>
                {copyStatus && <p className="topup-status">{copyStatus}</p>}
                <p className="topup-warning">
                  Отправляйте только совместимые активы в выбранной сети. Пополнение в другой сети может привести к потере средств.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TopUpPage
