import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import Home from './App'
import { Layout, RequireAuth } from './components/Layout'
import AuthPage from './pages/AuthPage'
import LotDetailPage from './pages/LotDetailPage'
import VehiclesPage from './pages/VehiclesPage'
import ReservationsPage from './pages/ReservationsPage'
import HistoryPage from './pages/HistoryPage'
import { StaffCheckInPage, StaffCheckOutPage } from './pages/StaffPages'
import { AdminDashboardPage, AdminManagePage } from './pages/AdminPages'
import SecurityPage from './pages/SecurityPage'
import AccountPage from './pages/AccountPage'
import ParkedVehiclesPage from './pages/ParkedVehiclesPage'

export default function AppRouter() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const anchor = hash && document.getElementById(hash.slice(1))
    if (anchor) anchor.scrollIntoView()
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])

  return <Routes>
    <Route path="/" element={<Home />} />
    <Route element={<Layout />}>
      <Route path="/lots/:id" element={<LotDetailPage />} />
      <Route path="/login" element={<AuthPage key="login" />} />
      <Route path="/register" element={<AuthPage key="register" register />} />
      <Route path="/security" element={<RequireAuth><SecurityPage /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
      <Route path="/vehicles" element={<RequireAuth><VehiclesPage /></RequireAuth>} />
      <Route path="/reservations" element={<RequireAuth><ReservationsPage /></RequireAuth>} />
      <Route path="/parked" element={<RequireAuth><ParkedVehiclesPage /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
      <Route path="/staff/check-in" element={<RequireAuth roles={['Admin', 'Staff']}><StaffCheckInPage /></RequireAuth>} />
      <Route path="/staff/check-out" element={<RequireAuth roles={['Admin', 'Staff']}><StaffCheckOutPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['Admin']}><AdminDashboardPage /></RequireAuth>} />
      <Route path="/admin/manage" element={<RequireAuth roles={['Admin']}><AdminManagePage /></RequireAuth>} />
    </Route>
    <Route path="*" element={<main className="page-wrap"><h1>Không tìm thấy trang</h1><a href="/">Về trang chủ</a></main>} />
  </Routes>
}
