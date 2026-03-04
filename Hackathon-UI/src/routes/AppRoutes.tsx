import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AdminLayout } from '../layouts/AdminLayout'
import { UserLayout } from '../layouts/UserLayout'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage/NotFoundPage'
import { ScreenPage } from '../pages/user/screen/ScreenPage'

// ── Admin страницы ─────────────────────────────────────────────────────────────
import { AdminVMsPage } from '../pages/admin/vms/AdminVMsPage'
import { AdminNodesPage } from '../pages/admin/nodes/AdminNodesPage'
import { AdminDatabasesPage } from '../pages/admin/databases/AdminDatabasesPage'
import { AdminObjectStoragePage } from '../pages/admin/storage/object/AdminObjectStoragePage'
import { AdminFileStoragePage } from '../pages/admin/storage/file/AdminFileStoragePage'
import { AdminMobilePage } from '../pages/admin/mobile/AdminMobilePage'
import { AdminUsersPage } from '../pages/admin/users/AdminUsersPage'
import { AdminCatalogPage } from '../pages/admin/catalog/AdminCatalogPage'
import { AdminMetricsPage } from '../pages/admin/metrics/AdminMetricsPage'
import { AdminRecommendationsPage } from '../pages/admin/recommendations/AdminRecommendationsPage'
import { AdminSnapshotsPage } from '../pages/admin/snapshots/AdminSnapshotsPage'
import { AdminImagesPage } from '../pages/admin/images/AdminImagesPage'
import { AdminDashboardPage } from '../pages/admin/dashboard/AdminDashboardPage'
import { CreateVMPage } from '../pages/admin/vms/CreateVMPage'

// ── User страницы ──────────────────────────────────────────────────────────────
import { UserDashboardPage } from '../pages/user/dashboard/UserDashboardPage'
import { UserComputePage } from '../pages/user/compute/UserComputePage'
import { UserDatabasesPage } from '../pages/user/databases/UserDatabasesPage'
import { UserStoragePage } from '../pages/user/storage/UserStoragePage'
import { UserMobilePage } from '../pages/user/mobile/UserMobilePage'
import { UserSnapshotsPage } from '../pages/user/snapshots/UserSnapshotsPage'
import { UserRecommendationsPage } from '../pages/user/recommendations/UserRecommendationsPage'
import { UserSettingsPage } from '../pages/user/settings/UserSettingsPage'



export function AppRoutes() {
  return (
    <Routes>

      {/* ── Публичный роут — страница входа ───────────────────────── */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── Admin (требует role=admin) ─────────────────────────────── */}
      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/vms" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="vms" element={<AdminVMsPage />} />
          <Route path="vms/create" element={<CreateVMPage />} />
          <Route path="nodes" element={<AdminNodesPage />} />
          <Route path="databases" element={<AdminDatabasesPage />} />
          <Route path="storage/object" element={<AdminObjectStoragePage />} />
          <Route path="storage/file" element={<AdminFileStoragePage />} />
          <Route path="mobile" element={<AdminMobilePage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="catalog" element={<AdminCatalogPage />} />
          <Route path="metrics" element={<AdminMetricsPage />} />
          <Route path="recommendations" element={<AdminRecommendationsPage />} />
          <Route path="snapshots" element={<AdminSnapshotsPage />} />
          <Route path="images" element={<AdminImagesPage />} />
        </Route>
      </Route>

     {/* ── User (любой авторизованный пользователь) ──────────────── */}
<Route element={<ProtectedRoute />}>
  {/* Fullscreen страница — БЕЗ UserLayout сайдбара */}
  <Route path="/screen/:id" element={<ScreenPage />} />

  <Route path="/" element={<UserLayout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard"       element={<UserDashboardPage />} />
    <Route path="compute"         element={<UserComputePage />} />
    <Route path="databases"       element={<UserDatabasesPage />} />
    <Route path="storage"         element={<UserStoragePage />} />
    <Route path="mobile"          element={<UserMobilePage />} />
    <Route path="snapshots"       element={<UserSnapshotsPage />} />
    <Route path="recommendations" element={<UserRecommendationsPage />} />
    <Route path="settings"        element={<UserSettingsPage />} />
  </Route>
</Route>

      {/* ── Редиректы старых роутов ───────────────────────────────── */}
      <Route path="/vms" element={<Navigate to="/admin/vms" replace />} />
      <Route path="/nodes" element={<Navigate to="/admin/nodes" replace />} />
      <Route path="/images" element={<Navigate to="/admin/images" replace />} />
      <Route path="/flavors" element={<Navigate to="/admin/catalog" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}