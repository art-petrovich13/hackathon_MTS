// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminLayout } from '../layouts/AdminLayout'

// Страницы (создадим их позже, один за другим)
import { VMListPage }    from '../pages/VMListPage/VMListPage'
import { CreateVMPage }  from '../pages/CreateVMPage/CreateVMPage'
import { NodesPage }     from '../pages/NodesPage/NodesPage'
import { ImagesPage }    from '../pages/ImagesPage/ImagesPage'
import { FlavorsPage }   from '../pages/FlavorsPage/FlavorsPage'
import { NotFoundPage }  from '../pages/NotFoundPage/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Все страницы внутри AdminLayout (сайдбар + хедер) */}
      <Route element={<AdminLayout />}>

        {/* Главная → редирект на список VM */}
        <Route index element={<Navigate to="/vms" replace />} />

        {/* VM */}
        <Route path="vms"        element={<VMListPage />} />
        <Route path="vms/create" element={<CreateVMPage />} />

        {/* Инфраструктура */}
        <Route path="nodes"   element={<NodesPage />} />
        <Route path="images"  element={<ImagesPage />} />
        <Route path="flavors" element={<FlavorsPage />} />

      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}