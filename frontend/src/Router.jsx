import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import Home from './App'
import { Layout, RequireAuth } from './components/Layout'
import AuthPage from './pages/AuthPage'
import LotDetailPage from './pages/LotDetailPage'
import VehiclesPage from './pages/VehiclesPage'
import ReservationsPage from './pages/ReservationsPage'
import ReservationReviewPage from './pages/ReservationReviewPage'
import HistoryPage from './pages/HistoryPage'
import { StaffCheckInPage, StaffCheckOutPage } from './pages/StaffPages'
import { AdminDashboardPage, AdminManagePage } from './pages/AdminPages'
import SecurityPage from './pages/SecurityPage'
import AccountPage from './pages/AccountPage'
import ParkedVehiclesPage from './pages/ParkedVehiclesPage'
import CustomerDashboardPage from './pages/CustomerDashboardPage'
import CustomerPaymentsPage from './pages/CustomerPaymentsPage'
import WalletPage from './pages/WalletPage'
import WalletReviewPage from './pages/WalletReviewPage'
import RevenuePage from './pages/RevenuePage'
import ParkingSearchPage from './pages/ParkingSearchPage'
import ForecastOperationsPage from './pages/ForecastOperationsPage'
import PortalLayout from './components/PortalLayout'
import { useAuth } from './auth/useAuth'
import ParkingAssistant from './components/ParkingAssistant'

export default function AppRouter() {
  const { pathname, hash } = useLocation()
  const { ready } = useAuth()
  useEffect(() => {
    if (!ready) return
    const anchor = hash && document.getElementById(hash.slice(1))
    if (anchor) anchor.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash, ready])

  return <><Routes>
    <Route element={<Layout matchPortal />}>
      <Route path="/" element={<Home />} />
      <Route path="/lots/:id" element={<LotDetailPage />} />
      <Route path="/parking-search" element={<ParkingSearchPage />} />
    </Route>
    <Route element={<Layout />}>
      <Route path="/login" element={<AuthPage key="login" />} />
      <Route path="/register" element={<AuthPage key="register" register />} />
    </Route>
    <Route element={<RequireAuth />}>
      <Route element={<PortalLayout />}>
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
      <Route element={<PortalLayout area="customer" />}>
        <Route path="/my-parking" element={<CustomerDashboardPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/parked" element={<ParkedVehiclesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/payments" element={<CustomerPaymentsPage />} />
        <Route path="/wallet" element={<WalletPage />} />
      </Route>
    </Route>
    <Route element={<RequireAuth roles={['Admin', 'Staff']} />}>
      <Route element={<PortalLayout area="staff" />}>
        <Route path="/staff/check-in" element={<StaffCheckInPage />} />
        <Route path="/staff/check-out" element={<StaffCheckOutPage />} />
        <Route path="/staff/reservations" element={<ReservationReviewPage />} />
        <Route path="/staff/revenue" element={<RevenuePage />} />
        <Route path="/staff/forecast" element={<ForecastOperationsPage />} />
      </Route>
    </Route>
    <Route element={<RequireAuth roles={['Admin']} />}>
      <Route element={<PortalLayout area="admin" />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/manage" element={<AdminManagePage />} />
        <Route path="/admin/reservations" element={<ReservationReviewPage />} />
        <Route path="/admin/wallet" element={<WalletReviewPage />} />
        <Route path="/admin/revenue" element={<RevenuePage />} />
        <Route path="/admin/forecast" element={<ForecastOperationsPage admin />} />
      </Route>
    </Route>
    <Route element={<Layout matchPortal />}>
      <Route path="*" element={<main className="page-wrap"><section className="panel"><h1>Không tìm thấy trang</h1><a className="button main-button" href="/">Về trang chủ</a></section></main>} />
    </Route>
  </Routes><ParkingAssistant /></>
}
