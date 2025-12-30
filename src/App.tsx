import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import SpotlightCenter from './components/SpotlightCenter'
import SpotlightDetail from './components/SpotlightDetail'
import TopUpPage from './components/TopUpPage'
import WithdrawPage from './components/WithdrawPage'
import AdminDashboard from './components/AdminDashboard'
import DepositsPage from './components/DepositsPage'
import WithdrawalsPage from './components/WithdrawalsPage'
import AllocationPage from './components/AllocationPage'
import AdminAllocationsPage from './components/AdminAllocationsPage'
import AdminTradingPage from './components/AdminTradingPage'
import WorkerUsersPage from './components/WorkerUsersPage'
import MessagesChatPage from './components/MessagesChatPage'
import NewEmployeeChatPage from './components/NewEmployeeChatPage'
import PaymentsUsersPage from './components/PaymentsUsersPage'
import Header from './components/Header'

function App() {
  return (
    <Router>
      <div className="app">
        <Header />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<SpotlightCenter />} />
            <Route path="/spotlight/:id" element={<SpotlightDetail />} />
            <Route path="/topup" element={<TopUpPage />} />
            <Route path="/withdraw" element={<WithdrawPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/deposits" element={<DepositsPage />} />
            <Route path="/withdrawals" element={<WithdrawalsPage />} />
            <Route path="/allocation" element={<AllocationPage />} />
            <Route path="/admin/allocations" element={<AdminAllocationsPage />} />
            <Route path="/admin/trading" element={<AdminTradingPage />} />
            <Route path="/admin/trading/:tab" element={<AdminTradingPage />} />
            {/* Catch-all under trading to prevent 404 on refresh/deep links */}
            <Route path="/admin/trading/*" element={<AdminTradingPage />} />
            <Route path="/admin/trading/worker/:chatId/users" element={<WorkerUsersPage />} />
            <Route path="/admin/trading/messages/:toChatId" element={<MessagesChatPage />} />
            <Route path="/admin/trading/new-employee/:chatId" element={<NewEmployeeChatPage />} />
            <Route path="/admin/payments/users" element={<PaymentsUsersPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App

