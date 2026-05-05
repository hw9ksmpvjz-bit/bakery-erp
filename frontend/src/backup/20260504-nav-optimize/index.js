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
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/products/index.vue')
      },
      {
        path: 'sales',
        name: 'Sales',
        component: () => import('@/views/sales/index.vue')
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/inventory/index.vue')
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
