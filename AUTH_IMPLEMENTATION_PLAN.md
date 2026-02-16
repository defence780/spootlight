# План впровадження безпечної авторизації

## 🎯 Стратегія

Оскільки у вас вже є таблиця `spotlights_users` з хешованими паролями, ми використаємо **гібридний підхід**:
1. Створимо Edge Function для авторизації, яка повертає JWT токени
2. Використаємо Supabase Auth для зберігання сесій (або власні JWT)
3. Додамо middleware для валідації токенів
4. Замінимо localStorage на безпечне зберігання токенів

---

## 📋 Крок 1: Створення Edge Function для авторизації

### Файл: `bots/supabase/functions/auth/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, verify } from 'https://deno.land/x/djwt@v2.8/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuthRequest {
  email: string
  password: string
  mode: 'signin' | 'signup'
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, mode }: AuthRequest = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const jwtSecret = Deno.env.get('JWT_SECRET')! // Додати в Supabase Secrets
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (mode === 'signup') {
      // Перевірка чи існує користувач
      const { data: existing } = await supabase
        .from('spotlights_users')
        .select('email')
        .eq('email', email.toLowerCase())
        .maybeSingle()

      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Користувач вже існує' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Хешування пароля
      const passwordHash = await hashPassword(password)
      
      // Створення користувача
      const { data: user, error } = await supabase
        .from('spotlights_users')
        .insert({
          email: email.toLowerCase(),
          password: passwordHash,
          type: 'user'
        })
        .select('id, email, type, balance')
        .single()

      if (error) throw error

      // Генерація JWT токену
      const token = await createJWT(user, jwtSecret)
      
      return new Response(
        JSON.stringify({ token, user: { email: user.email, type: user.type, balance: user.balance } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Sign in
      const passwordHash = await hashPassword(password)
      
      const { data: user, error } = await supabase
        .from('spotlights_users')
        .select('id, email, password, type, balance')
        .eq('email', email.toLowerCase())
        .maybeSingle()

      if (error || !user || user.password !== passwordHash) {
        return new Response(
          JSON.stringify({ error: 'Невірний email або пароль' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Генерація JWT токену
      const token = await createJWT(user, jwtSecret)
      
      return new Response(
        JSON.stringify({ 
          token, 
          user: { 
            email: user.email, 
            type: user.type, 
            balance: user.balance 
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function createJWT(user: any, secret: string): Promise<string> {
  const payload = {
    userId: user.id,
    email: user.email,
    type: user.type,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 днів
  }
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  return await create({ alg: 'HS256', typ: 'JWT' }, payload, key)
}
```

---

## 📋 Крок 2: Створення Edge Function для валідації токенів

### Файл: `bots/supabase/functions/validate-auth/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { verify } from 'https://deno.land/x/djwt@v2.8/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Токен не надано' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.substring(7)
    const jwtSecret = Deno.env.get('JWT_SECRET')!
    
    // Валідація токену
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    const payload = await verify(token, key)
    
    // Перевірка чи користувач існує та не заблокований
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: user, error } = await supabase
      .from('spotlights_users')
      .select('id, email, type, balance, ref_id')
      .eq('id', payload.userId)
      .maybeSingle()
    
    if (error || !user) {
      return new Response(
        JSON.stringify({ error: 'Користувач не знайдений' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        valid: true, 
        user: {
          id: user.id,
          email: user.email,
          type: user.type,
          balance: user.balance,
          ref_id: user.ref_id
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Невірний токен', valid: false }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

---

## 📋 Крок 3: Створення Auth Context та Hook

### Файл: `spootlight/src/contexts/AuthContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface User {
  id: number
  email: string
  type: string
  balance: number
  ref_id?: string | number | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Завантаження токену при ініціалізації
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (storedToken) {
      setToken(storedToken)
      validateToken(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  const validateToken = async (tokenToValidate: string) => {
    try {
      const response = await supabase.functions.invoke('validate-auth', {
        headers: {
          Authorization: `Bearer ${tokenToValidate}`
        }
      })

      if (response.error) throw response.error

      const { data } = response
      if (data.valid && data.user) {
        setUser(data.user)
      } else {
        // Токен невалідний - видаляємо
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        setToken(null)
        setUser(null)
      }
    } catch (error) {
      console.error('Token validation error:', error)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('auth', {
        body: { email, password, mode: 'signin' }
      })

      if (error) throw error

      const { token: newToken, user: userData } = data
      
      // Зберігаємо токен
      localStorage.setItem(TOKEN_KEY, newToken)
      setToken(newToken)
      setUser(userData)
    } catch (error: any) {
      throw new Error(error.message || 'Помилка входу')
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('auth', {
        body: { email, password, mode: 'signup' }
      })

      if (error) throw error

      const { token: newToken, user: userData } = data
      
      localStorage.setItem(TOKEN_KEY, newToken)
      setToken(newToken)
      setUser(userData)
    } catch (error: any) {
      throw new Error(error.message || 'Помилка реєстрації')
    }
  }

  const signOut = async () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    if (!token) return
    await validateToken(token)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

---

## 📋 Крок 4: Створення Protected Route компонента

### Файл: `spootlight/src/components/ProtectedRoute.tsx`

```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredType?: 'admin' | 'superadmin' | 'hr' | 'user'
  requireRefId?: boolean
}

export function ProtectedRoute({ 
  children, 
  requiredType, 
  requireRefId = false 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return

    if (!user) {
      navigate('/', { replace: true })
      return
    }

    // Перевірка типу користувача
    if (requiredType) {
      if (requiredType === 'superadmin' && user.type !== 'superadmin') {
        navigate('/', { replace: true })
        return
      }
      
      if (requiredType === 'admin' && user.type !== 'admin' && user.type !== 'superadmin') {
        navigate('/', { replace: true })
        return
      }

      if (requiredType === 'hr' && user.type !== 'hr' && user.type !== 'superadmin') {
        navigate('/', { replace: true })
        return
      }
    }

    // Перевірка ref_id якщо потрібно
    if (requireRefId && !user.ref_id && user.type !== 'superadmin') {
      navigate('/', { replace: true })
      return
    }
  }, [user, loading, requiredType, requireRefId, navigate])

  if (loading) {
    return <div>Завантаження...</div>
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
```

---

## 📋 Крок 5: Оновлення Header.tsx

### Зміни в `spootlight/src/components/Header.tsx`:

```typescript
// Замінити весь handleSubmit на:
const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  const validationErrors = validateForm(authMode)

  if (validationErrors.length > 0) {
    setErrors(validationErrors)
    setSuccessMessage('')
    return
  }

  setErrors([])
  setSuccessMessage('')
  setIsSubmitting(true)

  try {
    if (authMode === 'signup') {
      await signUp(formState.email, formState.password)
      setSuccessMessage('Регистрация прошла успешно!')
    } else {
      await signIn(formState.email, formState.password)
      setSuccessMessage('Вход выполнен успешно!')
    }
    
    setFormState(initialFormState)
    setTimeout(() => {
      setIsModalOpen(false)
      setSuccessMessage('')
    }, 500)
  } catch (error: any) {
    setErrors([error.message || 'Произошла непредвиденная ошибка.'])
  } finally {
    setIsSubmitting(false)
  }
}

// Додати імпорт:
import { useAuth } from '../contexts/AuthContext'

// В компоненті:
const { user, signIn, signUp, signOut } = useAuth()
```

---

## 📋 Крок 6: Оновлення всіх компонентів з checkAccess

### Приклад для `AdminTradingPage.tsx`:

```typescript
// Замінити весь useEffect з checkAccess на:
import { useAuth } from '../contexts/AuthContext'

const { user, loading: authLoading } = useAuth()

useEffect(() => {
  if (authLoading) return
  
  if (!user) {
    navigate('/', { replace: true })
    return
  }

  // Логіка для різних типів користувачів
  if (user.type === 'hr') {
    setIsHr(true)
    if (tab !== 'new-employee') {
      navigate('/admin/trading/new-employee', { replace: true })
    }
    setInitialized(true)
    return
  }

  if (user.type === 'superadmin') {
    setIsSuperAdmin(true)
    setCurrentUserRefId(null)
    setInitialized(true)
    return
  }

  if (user.type === 'admin') {
    if (user.ref_id) {
      setCurrentUserRefId(user.ref_id)
    }
    setInitialized(true)
    return
  }

  navigate('/', { replace: true })
}, [user, authLoading, navigate, tab])
```

---

## 📋 Крок 7: Додати JWT_SECRET в Supabase Secrets

1. Перейти в Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Додати `JWT_SECRET` з випадковим рядком (мінімум 32 символи)

---

## 📋 Крок 8: Оновлення App.tsx для AuthProvider

```typescript
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Ваші роути */}
      </Router>
    </AuthProvider>
  )
}
```

---

## 🔒 Додаткові покращення

### 1. Автоматичне оновлення токенів
Додати логіку для автоматичного оновлення токенів перед закінченням терміну дії.

### 2. Refresh Tokens
Реалізувати refresh tokens для безпечного оновлення access tokens.

### 3. Rate Limiting
Додати rate limiting до Edge Functions для захисту від brute force.

---

## ✅ Переваги цього підходу

1. ✅ **Безпека**: Токени не можна підробити (підписані секретним ключем)
2. ✅ **Серверна валідація**: Кожен запит перевіряється на сервері
3. ✅ **Термін дії**: Токени мають обмежений термін дії
4. ✅ **Сумісність**: Працює з існуючою таблицею `spotlights_users`
5. ✅ **Масштабованість**: Легко додати нові типи користувачів

---

## 📝 Порядок впровадження

1. Створити Edge Functions (auth, validate-auth)
2. Додати JWT_SECRET в Supabase Secrets
3. Створити AuthContext та useAuth hook
4. Оновити Header.tsx
5. Оновити всі компоненти з checkAccess
6. Додати ProtectedRoute компонент
7. Тестування
8. Видалити старий код з localStorage

---

**Час впровадження:** 2-3 дні
**Складність:** Середня
**Пріоритет:** Критичний
