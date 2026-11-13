import { Route, Routes } from 'react-router'
import Home from './App'
import { Layout, RequireAuth } from './components/Layout'
import AuthPage from './pages/AuthPage'
import LotDetailPage from './pages/LotDetailPage'
import VehiclesPage from './pages/VehiclesPage'
import ReservationsPage from './pages/ReservationsPage'
import HistoryPage from './pages/HistoryPage'
import { StaffCheckInPage, StaffCheckOutPage } from './pages/StaffPages'
import { AdminDashboardPage, AdminManagePage } from './pages/AdminPages'

export default function AppRouter() {
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route element={<Layout />}>
      <Route path="/lots/:id" element={<LotDetailPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage register />} />
      <Route path="/vehicles" element={<RequireAuth><VehiclesPage /></RequireAuth>} />
      <Route path="/reservations" element={<RequireAuth><ReservationsPage /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
      <Route path="/staff/check-in" element={<RequireAuth roles={['Admin', 'Staff']}><StaffCheckInPage /></RequireAuth>} />
      <Route path="/staff/check-out" element={<RequireAuth roles={['Admin', 'Staff']}><StaffCheckOutPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['Admin']}><AdminDashboardPage /></RequireAuth>} />
      <Route path="/admin/manage" element={<RequireAuth roles={['Admin']}><AdminManagePage /></RequireAuth>} />
    </Route>
    <Route path="*" element={<main className="page-wrap"><h1>Không tìm thấy trang</h1><a href="/">Về trang chủ</a></main>} />
  </Routes>
}
