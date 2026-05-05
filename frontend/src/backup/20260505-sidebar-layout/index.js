import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/simple.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layouts/SimpleLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/simple.vue')
      },
      // 基礎資料
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/products/index.vue')
      },
      {
        path: 'suppliers',
        name: 'Suppliers',
        component: () => import('@/views/purchase/index.vue') // 暫用採購頁面，後續拆分
      },
      // 採購管理
      {
        path: 'purchase',
        name: 'Purchase',
        component: () => import('@/views/purchase/index.vue')
      },
      // 生產管理
      {
        path: 'production',
        name: 'Production',
        component: () => import('@/views/production/index.vue')
      },
      // 銷售管理
      {
        path: 'sales',
        name: 'Sales',
        component: () => import('@/views/sales/index.vue')
      },
      // 會員管理
      {
        path: 'members',
        name: 'Members',
        component: () => import('@/views/member/index.vue')
      },
      // 門店管理
      {
        path: 'stores',
        name: 'Stores',
        component: () => import('@/views/store/index.vue')
      },
      // 庫存管理
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/inventory/index.vue')
      },
      // 財務報表
      {
        path: 'finance-report',
        name: 'FinanceReport',
        component: () => import('@/views/finance-report/index.vue')
      },
      // 財務管理
      {
        path: 'finance',
        name: 'Finance',
        component: () => import('@/views/finance/index.vue')
      },
      // 系統設置
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守衛
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  
  if (!to.meta.public && !token) {
    return next('/login')
  }
  
  if (to.path === '/login' && token) {
    return next('/dashboard')
  }
  
  next()
})

export default router
