# Spotlight

A modern React application built with Vite, TypeScript, and React 18.

## Features

- ⚡️ **Lightning Fast** - Powered by Vite for instant HMR and optimized builds
- 🎯 **TypeScript** - Full type safety and enhanced developer experience
- ⚛️ **React 18** - Latest React features and concurrent rendering
- 🗄️ **Supabase** - Backend as a service with real-time capabilities
- 🎨 **Modern UI** - Clean, responsive design with beautiful gradients
- 📦 **ESLint** - Code quality and consistency

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view it in your browser.

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
spotlight/
├── src/
│   ├── lib/
│   │   └── supabase.ts  # Supabase client configuration
│   ├── App.tsx          # Main App component
│   ├── App.css          # App styles
│   ├── main.tsx         # Application entry point
│   ├── index.css        # Global styles
│   └── vite-env.d.ts    # Vite type declarations
├── public/
│   └── vite.svg         # App icon
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── README.md           # This file
```

## Technologies

- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vite](https://vitejs.dev/) - Build tool
- [Supabase](https://supabase.com/) - Backend as a service
- [ESLint](https://eslint.org/) - Linting

## Using Supabase

The Supabase client is configured in `src/lib/supabase.ts`. Import it in any component:

```typescript
import { supabase } from './lib/supabase'

// Example: Query data
const { data, error } = await supabase
  .from('your_table')
  .select('*')

// Example: Insert data
const { data, error } = await supabase
  .from('your_table')
  .insert({ column: 'value' })
```

## Learn More

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)


додай можливість побачити воркерів
воркер це користувач 
user в якого є worker_comment 
таблиця користувачі це 
id
created_at
chat_id
isAdmin
username
first_name
ref_id
balance
auto_win
is_trading_enable
spam
usdt_amount
rub_amount
verification_on
verification_needed
is_message_sending
comment
panel_disabled
worker_comment