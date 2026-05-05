<template>
  <div class="erp-layout">
    <!-- 頂部導航欄 -->
    <header class="top-nav">
      <div class="nav-brand">
        <span class="logo">🥐</span>
        <span class="brand-text">烘焙ERP</span>
      </div>
      
      <nav class="nav-menu">
        <!-- 基礎資料 -->
        <el-dropdown class="nav-item">
          <span class="nav-link">
            <el-icon><Document /></el-icon>
            基礎資料
            <el-icon class="arrow"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/products')">
                <el-icon><Goods /></el-icon> 商品管理
              </el-dropdown-item>
              <el-dropdown-item @click="router.push('/suppliers')">
                <el-icon><Van /></el-icon> 供應商管理
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 採購管理 -->
        <div class="nav-item" @click="router.push('/purchase')">
          <span class="nav-link">
            <el-icon><ShoppingCart /></el-icon>
            採購管理
          </span>
        </div>

        <!-- 生產管理 -->
        <div class="nav-item" @click="router.push('/production')">
          <span class="nav-link">
            <el-icon><Box /></el-icon>
            生產管理
          </span>
        </div>

        <!-- 銷售管理 -->
        <el-dropdown class="nav-item">
          <span class="nav-link">
            <el-icon><Sell /></el-icon>
            銷售管理
            <el-icon class="arrow"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/sales')">
                <el-icon><ShoppingBag /></el-icon> POS開單
              </el-dropdown-item>
              <el-dropdown-item @click="router.push('/members')">
                <el-icon><User /></el-icon> 會員管理
              </el-dropdown-item>
              <el-dropdown-item @click="router.push('/stores')">
                <el-icon><Shop /></el-icon> 門店管理
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 庫存管理 -->
        <div class="nav-item" @click="router.push('/inventory')">
          <span class="nav-link">
            <el-icon><OfficeBuilding /></el-icon>
            庫存管理
          </span>
        </div>

        <!-- 財務管理 -->
        <el-dropdown class="nav-item">
          <span class="nav-link">
            <el-icon><Money /></el-icon>
            財務管理
            <el-icon class="arrow"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/finance-report')">
                <el-icon><TrendCharts /></el-icon> 財務報表
              </el-dropdown-item>
              <el-dropdown-item @click="router.push('/finance')">
                <el-icon><Coin /></el-icon> 應收應付
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 系統設置 -->
        <div class="nav-item" @click="router.push('/settings')">
          <span class="nav-link">
            <el-icon><Setting /></el-icon>
            系統設置
          </span>
        </div>
      </nav>

      <div class="nav-user">
        <el-dropdown @command="handleUserCommand">
          <span class="user-info">
            <el-avatar :size="32" :icon="UserFilled" />
            <span class="username">{{ username }}</span>
            <el-icon><ArrowDown /></el-icon>
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

    <!-- 主內容區 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Document, ShoppingCart, Box, Sell, OfficeBuilding, Money, Setting,
  Goods, Van, ShoppingBag, User, Shop, TrendCharts, Coin,
  UserFilled, ArrowDown
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const username = computed(() => {
  const userInfo = localStorage.getItem('userInfo')
  return userInfo ? JSON.parse(userInfo).username : '用戶'
})

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
.erp-layout {
  min-height: 100vh;
  background: #f5f7fa;
}

/* 頂部導航欄 */
.top-nav {
  background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.nav-brand {
  display: flex;
  align-items: center;
  margin-right: 40px;
  font-size: 20px;
  font-weight: bold;
}

.logo {
  font-size: 28px;
  margin-right: 10px;
}

.nav-menu {
  display: flex;
  flex: 1;
  gap: 8px;
}

.nav-item {
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.3s;
}

.nav-item:hover {
  background: rgba(255,255,255,0.15);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
}

.nav-link .arrow {
  font-size: 12px;
  margin-left: 2px;
}

.nav-user {
  margin-left: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.3s;
}

.user-info:hover {
  background: rgba(255,255,255,0.15);
}

.username {
  font-size: 14px;
}

/* 主內容區 */
.main-content {
  padding: 20px;
  min-height: calc(100vh - 60px);
}
</style>
