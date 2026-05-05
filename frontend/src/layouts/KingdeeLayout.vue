<template>
  <div class="kingdee-layout">
    <!-- 頂部標題欄 -->
    <header class="top-header">
      <div class="header-left">
        <span class="logo">🥐</span>
        <span class="brand">烘焙ERP</span>
      </div>
      <div class="header-center">
        <span class="current-page">{{ currentPageTitle }}</span>
      </div>
      <div class="header-right">
        <span class="store-name">旗艦店</span>
        <el-dropdown @command="handleUserCommand">
          <span class="user-info">
            <el-avatar :size="28" :icon="UserFilled" />
            <span>{{ username }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">個人中心</el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登錄</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <div class="main-container">
      <!-- 左側側邊欄 -->
      <aside class="sidebar" :class="{ collapsed: isCollapsed }">
        <div class="sidebar-menu">
          <div
            v-for="item in menuList"
            :key="item.path"
            class="menu-item"
            :class="{ active: currentMenu === item.path }"
            @click="handleMenuClick(item)"
          >
            <el-icon class="menu-icon" :size="18">
              <component :is="item.icon" />
            </el-icon>
            <span class="menu-text">{{ item.title }}</span>
            <el-icon v-if="item.children" class="arrow" :size="12">
              <ArrowRight v-if="currentMenu !== item.path" />
              <ArrowDown v-else />
            </el-icon>
          </div>
        </div>

        <!-- 收起/展開按鈕 -->
        <div class="collapse-btn" @click="toggleSidebar">
          <el-icon :size="16">
            <Fold v-if="!isCollapsed" />
            <Expand v-else />
          </el-icon>
        </div>
      </aside>

      <!-- 右側子菜單面板 -->
      <div v-if="showSubMenu && currentMenuItem" class="submenu-panel">
        <div class="submenu-header">
          <h3>{{ currentMenuItem.title }}</h3>
          <el-icon class="close-btn" @click="closeSubMenu"><Close /></el-icon>
        </div>
        <div class="submenu-content">
          <div
            v-for="(group, index) in currentMenuItem.children"
            :key="index"
            class="submenu-group"
          >
            <h4 class="group-title">{{ group.title }}</h4>
            <div class="group-items">
              <div
                v-for="subItem in group.items"
                :key="subItem.path"
                class="submenu-item"
                @click="navigateTo(subItem.path)"
              >
                {{ subItem.title }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 主內容區 -->
      <main class="main-content" :class="{ 'with-submenu': showSubMenu }">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  UserFilled, ArrowRight, ArrowDown, Fold, Expand, Close,
  HomeFilled, Goods, Van, ShoppingCart, Box, Sell, User, Shop,
  OfficeBuilding, Money, Setting, TrendCharts
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const isCollapsed = ref(false)
const currentMenu = ref('')
const showSubMenu = ref(false)

const username = computed(() => {
  const userInfo = localStorage.getItem('userInfo')
  return userInfo ? JSON.parse(userInfo).username : '用戶'
})

const currentPageTitle = computed(() => {
  const titles = {
    '/dashboard': '儀表板',
    '/products': '商品管理',
    '/suppliers': '供應商管理',
    '/purchase': '採購管理',
    '/production': '生產管理',
    '/sales': '銷售管理',
    '/members': '會員管理',
    '/stores': '門店管理',
    '/inventory': '庫存管理',
    '/finance-report': '財務報表',
    '/finance': '財務管理',
    '/settings': '系統設置'
  }
  return titles[route.path] || '烘焙ERP'
})

const menuList = [
  {
    path: '/dashboard',
    title: '儀表板',
    icon: 'HomeFilled'
  },
  {
    path: '/basic',
    title: '基礎資料',
    icon: 'Goods',
    children: [
      {
        title: '商品管理',
        items: [
          { title: '商品列表', path: '/products' },
          { title: '商品分類', path: '/products' },
          { title: '商品單位', path: '/products' }
        ]
      },
      {
        title: '供應商管理',
        items: [
          { title: '供應商列表', path: '/suppliers' },
          { title: '供應商分類', path: '/suppliers' }
        ]
      }
    ]
  },
  {
    path: '/purchase',
    title: '採購管理',
    icon: 'ShoppingCart',
    children: [
      {
        title: '採購業務',
        items: [
          { title: '採購訂單', path: '/purchase' },
          { title: '採購入庫', path: '/purchase' },
          { title: '採購退貨', path: '/purchase' }
        ]
      },
      {
        title: '採購報表',
        items: [
          { title: '採購明細', path: '/purchase' },
          { title: '供應商往來', path: '/purchase' }
        ]
      }
    ]
  },
  {
    path: '/production',
    title: '生產管理',
    icon: 'Box',
    children: [
      {
        title: '生產業務',
        items: [
          { title: '生產計劃', path: '/production' },
          { title: '原料領料', path: '/production' },
          { title: '成品入庫', path: '/production' }
        ]
      },
      {
        title: '配方管理',
        items: [
          { title: '產品配方', path: '/production' },
          { title: 'BOM管理', path: '/production' }
        ]
      }
    ]
  },
  {
    path: '/sales',
    title: '銷售管理',
    icon: 'Sell',
    children: [
      {
        title: '門店銷售',
        items: [
          { title: 'POS開單', path: '/sales' },
          { title: '銷售退貨', path: '/sales' },
          { title: '日結管理', path: '/sales' }
        ]
      },
      {
        title: '會員門店',
        items: [
          { title: '會員管理', path: '/members' },
          { title: '門店管理', path: '/stores' }
        ]
      }
    ]
  },
  {
    path: '/inventory',
    title: '庫存管理',
    icon: 'OfficeBuilding',
    children: [
      {
        title: '庫存業務',
        items: [
          { title: '庫存查詢', path: '/inventory' },
          { title: '庫存調撥', path: '/inventory' },
          { title: '盤點管理', path: '/inventory' }
        ]
      },
      {
        title: '庫存預警',
        items: [
          { title: '效期預警', path: '/inventory' },
          { title: '低庫存預警', path: '/inventory' }
        ]
      }
    ]
  },
  {
    path: '/finance',
    title: '財務管理',
    icon: 'Money',
    children: [
      {
        title: '財務報表',
        items: [
          { title: '銷售報表', path: '/finance-report' },
          { title: '利潤報表', path: '/finance-report' },
          { title: '成本報表', path: '/finance-report' }
        ]
      },
      {
        title: '應收應付',
        items: [
          { title: '應收款', path: '/finance' },
          { title: '應付款', path: '/finance' },
          { title: '對賬管理', path: '/finance' }
        ]
      }
    ]
  },
  {
    path: '/settings',
    title: '系統設置',
    icon: 'Setting'
  }
]

const currentMenuItem = computed(() => {
  return menuList.find(item => item.path === currentMenu.value)
})

const handleMenuClick = (item) => {
  currentMenu.value = item.path
  if (item.children && item.children.length > 0) {
    showSubMenu.value = true
  } else {
    showSubMenu.value = false
    router.push(item.path)
  }
}

const closeSubMenu = () => {
  showSubMenu.value = false
}

const navigateTo = (path) => {
  router.push(path)
  showSubMenu.value = false
}

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleUserCommand = (command) => {
  if (command === 'logout') {
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    ElMessage.success('已退出登錄')
    router.push('/login')
  } else if (command === 'profile') {
    router.push('/settings')
  }
}
</script>

<style scoped>
.kingdee-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 頂部標題欄 */
.top-header {
  height: 50px;
  background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  font-size: 24px;
}

.brand {
  font-size: 18px;
  font-weight: bold;
}

.header-center {
  font-size: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.store-name {
  font-size: 14px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.3s;
}

.user-info:hover {
  background: rgba(255,255,255,0.15);
}

/* 主容器 */
.main-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左側側邊欄 */
.sidebar {
  width: 200px;
  background: #1e1e2d;
  color: #a0a3bd;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  position: relative;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar-menu {
  flex: 1;
  padding: 10px 0;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.menu-item:hover {
  background: rgba(255,255,255,0.05);
  color: #fff;
}

.menu-item.active {
  background: #ff6b35;
  color: #fff;
}

.menu-icon {
  margin-right: 12px;
  flex-shrink: 0;
}

.sidebar.collapsed .menu-text {
  display: none;
}

.menu-text {
  flex: 1;
  font-size: 14px;
}

.sidebar.collapsed .arrow {
  display: none;
}

.arrow {
  margin-left: auto;
}

/* 收起按鈕 */
.collapse-btn {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-top: 1px solid rgba(255,255,255,0.1);
  transition: background 0.3s;
}

.collapse-btn:hover {
  background: rgba(255,255,255,0.05);
}

/* 子菜單面板 */
.submenu-panel {
  width: 600px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  box-shadow: 2px 0 8px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.submenu-header {
  height: 50px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e8e8e8;
}

.submenu-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.close-btn {
  cursor: pointer;
  color: #999;
  transition: color 0.3s;
}

.close-btn:hover {
  color: #666;
}

.submenu-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.submenu-group {
  margin-bottom: 20px;
}

.group-title {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.submenu-item {
  font-size: 13px;
  color: #666;
  cursor: pointer;
  padding: 6px 0;
  transition: color 0.3s;
}

.submenu-item:hover {
  color: #ff6b35;
}

/* 主內容區 */
.main-content {
  flex: 1;
  background: #f5f7fa;
  overflow: auto;
  padding: 20px;
}

.main-content.with-submenu {
  margin-left: 0;
}

/* 響應式 */
@media (max-width: 1200px) {
  .submenu-panel {
    width: 400px;
  }
  
  .submenu-content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 50px;
    bottom: 0;
    z-index: 200;
  }
  
  .sidebar.collapsed {
    transform: translateX(-100%);
  }
  
  .submenu-panel {
    position: fixed;
    left: 200px;
    top: 50px;
    bottom: 0;
    z-index: 150;
  }
}
</style>
