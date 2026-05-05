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
    component: () => import('@/layouts/KingdeeLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/simple.vue')
      },
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/products/index.vue')
      },
      {
        path: 'units',
        name: 'Units',
        component: () => import('@/views/units/index.vue')
      },
      {
        path: 'suppliers',
        name: 'Suppliers',
        component: () => import('@/views/purchase/index.vue')
      },
      {
        path: 'purchase',
        name: 'Purchase',
        component: () => import('@/views/purchase/index.vue')
      },
      {
        path: 'production',
        name: 'Production',
        component: () => import('@/views/production/index.vue')
      },
      {
        path: 'sales',
        name: 'Sales',
        component: () => import('@/views/sales/index.vue')
      },
      {
        path: 'members',
        name: 'Members',
        component: () => import('@/views/member/index.vue')
      },
      {
        path: 'stores',
        name: 'Stores',
        component: () => import('@/views/store/index.vue')
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/inventory/index.vue')
      },
      {
        path: 'finance-report',
        name: 'FinanceReport',
        component: () => import('@/views/finance-report/index.vue')
      },
      {
        path: 'finance',
        name: 'Finance',
        component: () => import('@/views/finance/index.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue')
      },
      {
        path: 'quick-app',
        name: 'QuickApp',
        component: () => import('@/views/quick-app/index.vue')
      },
      {
        path: 'analysis',
        name: 'Analysis',
        component: () => import('@/views/analysis/index.vue')
      },
      {
        path: 'map',
        name: 'Map',
        component: () => import('@/views/map/index.vue')
      },
      {
        path: 'wecom',
        name: 'Wecom',
        component: () => import('@/views/wecom/index.vue')
      },
      {
        path: 'credit',
        name: 'Credit',
        component: () => import('@/views/credit/index.vue')
      },
      {
        path: 'app-center',
        name: 'AppCenter',
        component: () => import('@/views/app-center/index.vue')
      },
      {
        path: 'content',
        name: 'Content',
        component: () => import('@/views/content/index.vue')
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
