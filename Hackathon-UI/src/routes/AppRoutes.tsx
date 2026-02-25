// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminLayout } from '../layouts/AdminLayout'

// Страницы (создадим их позже, один за другим)
// import { VMListPage }    from '../pages/VMListPage'
// import { CreateVMPage }  from '../pages/CreateVMPage'
// import { NodesPage }     from '../pages/NodesPage'
// import { ImagesPage }    from '../pages/ImagesPage'
// import { FlavorsPage }   from '../pages/FlavorsPage'
// import { NotFoundPage }  from '../pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Все страницы внутри AdminLayout (сайдбар + хедер) */}
      <Route element={<AdminLayout />}>

        {/* Главная → редирект на список VM */}
        <Route index element={<Navigate to="/vms" replace />} />
    
        {/* VM */}
        <Route path="vms"        />
        <Route path="vms/create"  />

        {/* Инфраструктура */}
        <Route path="nodes"   />
        <Route path="images"   />
        <Route path="flavors" />

      </Route>

      {/* 404 */}
      <Route path="*"  />
    </Routes>
  )
}