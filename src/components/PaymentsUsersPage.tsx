import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './PaymentsUsersPage.css'

const STORAGE_KEY = 'spotlight_user'

interface PaymentsUser {
  id: number
  created_at: string
  username: string | null
  chat_id: number
  first_name: string | null
  role: 'worker' | 'closer' | 'superadmin' | null
  closer_id: number | null
  can_generate_link: boolean
  closer_username?: string | null
}

const PaymentsUsersPage = () => {
  const [users, setUsers] = useState<PaymentsUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState<PaymentsUser | null>(null)
  const [editForm, setEditForm] = useState({
    role: 'worker' as 'worker' | 'closer' | 'superadmin',
    can_generate_link: false,
    closer_username: '',
    username: ''
  })

  useEffect(() => {
    const checkAccess = async () => {
      if (typeof window === 'undefined') return

      const storedRaw = window.localStorage.getItem(STORAGE_KEY)
      if (!storedRaw) {
        setError('Доступ заборонено')
        return
      }

      try {
        const parsed: { type?: string } | null = JSON.parse(storedRaw)
        if (parsed?.type === 'superadmin') {
          setIsSuperAdmin(true)
          fetchUsers()
        } else {
          setError('Тільки суперадмін має доступ до цієї сторінки')
        }
      } catch (parseError) {
        console.error('Failed to parse stored user data', parseError)
        setError('Помилка перевірки доступу')
      }
    }

    checkAccess()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('users-payments')
        .select(`
          id,
          created_at,
          username,
          chat_id,
          first_name,
          role,
          closer_id,
          can_generate_link
        `)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      // Отримуємо username клоузерів для воркерів
      const usersWithCloser = await Promise.all(
        (data || []).map(async (user) => {
          if (user.closer_id) {
            const { data: closerData } = await supabase
              .from('users-payments')
              .select('username')
              .eq('id', user.closer_id)
              .single()

            return {
              ...user,
              closer_username: closerData?.username || null
            }
          }
          return { ...user, closer_username: null }
        })
      )

      setUsers(usersWithCloser as PaymentsUser[])
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження користувачів')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: PaymentsUser) => {
    setEditingUser(user)
    setEditForm({
      role: (user.role || 'worker') as 'worker' | 'closer' | 'superadmin',
      can_generate_link: user.can_generate_link || false,
      closer_username: user.closer_username || '',
      username: user.username || ''
    })
  }

  const handleSave = async () => {
    if (!editingUser) return

    setLoading(true)
    setError(null)

    try {
      let closer_id: number | null = null

      // Якщо встановлюємо роль worker і вказано closer_username
      if (editForm.role === 'worker' && editForm.closer_username) {
        const { data: closerData, error: closerError } = await supabase
          .from('users-payments')
          .select('id')
          .eq('username', editForm.closer_username)
          .eq('role', 'closer')
          .single()

        if (closerError || !closerData) {
          throw new Error('Клоузер з таким username не знайдено')
        }

        closer_id = closerData.id
      } else if (editForm.role === 'closer' || editForm.role === 'superadmin') {
        closer_id = null
      }

      // Оновлюємо username якщо змінився
      if (editForm.username && editForm.username !== editingUser.username) {
        const { error: usernameError } = await supabase
          .from('users-payments')
          .update({ username: editForm.username })
          .eq('id', editingUser.id)

        if (usernameError) {
          throw usernameError
        }
      }

      // Оновлюємо роль та інші поля
      const updateData: any = {
        role: editForm.role,
        can_generate_link: editForm.role === 'closer' ? editForm.can_generate_link : false,
        closer_id: closer_id
      }

      const { error: updateError } = await supabase
        .from('users-payments')
        .update(updateData)
        .eq('id', editingUser.id)

      if (updateError) {
        throw updateError
      }

      setEditingUser(null)
      await fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Помилка оновлення користувача')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      user.username?.toLowerCase().includes(search) ||
      user.first_name?.toLowerCase().includes(search) ||
      user.chat_id?.toString().includes(search) ||
      user.role?.toLowerCase().includes(search) ||
      user.closer_username?.toLowerCase().includes(search)
    )
  })

  if (!isSuperAdmin) {
    return (
      <div className="payments-users-page">
        <div className="payments-users-error">
          <p>{error || 'Доступ заборонено'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="payments-users-page">
      <div className="payments-users-header">
        <h1>Управління користувачами Payments</h1>
        <button 
          className="payments-users-refresh-btn" 
          onClick={fetchUsers}
          disabled={loading}
        >
          {loading ? 'Завантаження...' : 'Оновити'}
        </button>
      </div>

      {error && (
        <div className="payments-users-error-message">
          {error}
        </div>
      )}

      <div className="payments-users-search">
        <input
          type="text"
          placeholder="Пошук по username, імені, chat_id, ролі..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="payments-users-table-container">
        <table className="payments-users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Ім'я</th>
              <th>Chat ID</th>
              <th>Роль</th>
              <th>Клоузер</th>
              <th>Може генерувати посилання</th>
              <th>Створено</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={9} className="payments-users-loading">
                  Завантаження...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="payments-users-empty">
                  Користувачі не знайдені
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username || '—'}</td>
                  <td>{user.first_name || '—'}</td>
                  <td>{user.chat_id}</td>
                  <td>
                    <span className={`payments-users-role payments-users-role-${user.role || 'none'}`}>
                      {user.role || 'не встановлено'}
                    </span>
                  </td>
                  <td>{user.closer_username || '—'}</td>
                  <td>
                    {user.can_generate_link ? (
                      <span className="payments-users-check">✓</span>
                    ) : (
                      <span className="payments-users-cross">—</span>
                    )}
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString('uk-UA')}</td>
                  <td>
                    <button
                      className="payments-users-edit-btn"
                      onClick={() => handleEdit(user)}
                    >
                      Редагувати
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="payments-users-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="payments-users-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Редагувати користувача</h2>
            
            <div className="payments-users-form-group">
              <label>Username (для фільтрації):</label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                placeholder="Введіть username"
              />
            </div>

            <div className="payments-users-form-group">
              <label>Роль:</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ 
                  ...editForm, 
                  role: e.target.value as 'worker' | 'closer' | 'superadmin',
                  can_generate_link: e.target.value === 'closer' ? editForm.can_generate_link : false
                })}
              >
                <option value="worker">Worker</option>
                <option value="closer">Closer</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>

            {editForm.role === 'worker' && (
              <div className="payments-users-form-group">
                <label>Username клоузера:</label>
                <input
                  type="text"
                  value={editForm.closer_username}
                  onChange={(e) => setEditForm({ ...editForm, closer_username: e.target.value })}
                  placeholder="Введіть username клоузера"
                />
                <small>Воркер буде прив'язаний до клоузера з цим username</small>
              </div>
            )}

            {editForm.role === 'closer' && (
              <div className="payments-users-form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={editForm.can_generate_link}
                    onChange={(e) => setEditForm({ ...editForm, can_generate_link: e.target.checked })}
                  />
                  Може генерувати реферальні посилання
                </label>
              </div>
            )}

            <div className="payments-users-modal-actions">
              <button
                className="payments-users-cancel-btn"
                onClick={() => setEditingUser(null)}
              >
                Скасувати
              </button>
              <button
                className="payments-users-save-btn"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentsUsersPage

