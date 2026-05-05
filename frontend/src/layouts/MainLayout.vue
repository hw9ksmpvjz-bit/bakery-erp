<template>
  <el-container class="app-container">
    <!-- 側邊欄 -->
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <span class="logo-icon">🥐</span>
        <span class="logo-text">烘焙ERP</span>
      </div>
      
      <el-menu
        :default-active="$route.path"
        router
        class="sidebar-menu"
        background-color="transparent"
        text-color="#a0a3bd"
        active-text-color="#ff6b35"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 頂部導航 -->
      <el-header class="header">
        <div class="header-left">
          <span>{{ route.meta.title || '管理系統' }}</span>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" :icon="UserFilled" />
              <span class="username">{{ userStore.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">個人中心</el-dropdown-item>
                <el-dropdown-item command="settings">系統設置</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登錄</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主內容區 -->
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  HomeFilled,
  GoodsFilled,
  ShoppingCartFilled,
  Box,
  Sell,
  OfficeBuilding,
  Money,
  TrendCharts,
  Setting,
  UserFilled,
  ArrowDown
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const menuItems = computed(() => [
  { path: '/dashboard', title: '儀表板', icon: 'HomeFilled' },
  { path: '/products', title: '商品管理', icon: 'GoodsFilled' },
  { path: '/purchase', title: '採購管理', icon: 'ShoppingCartFilled' },
  { path: '/production', title: '生產管理', icon: 'Box' },
  { path: '/sales', title: '銷售管理', icon: 'Sell' },
  { path: '/inventory', title: '庫存管理', icon: 'OfficeBuilding' },
  { path: '/finance', title: '財務管理', icon: 'Money' },
  { path: '/reports', title: '報表中心', icon: 'TrendCharts' },
  { path: '/settings', title: '系統設置', icon: 'Setting' }
])

const handleCommand = async (command) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('確定要退出登錄嗎？', '提示', {
          confirmButtonText: '確定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        userStore.logout()
        router.push('/login')
        ElMessage.success('已退出登錄')
      } catch {
        // 取消退出
      }
      break
  }
}
</script>

<style scoped lang="scss">
.app-container {
  min-height: 100vh;
}

.sidebar {
  background-color: var(--sidebar-bg);
  
  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    
    .logo-icon {
      font-size: 28px;
      margin-right: 10px;
    }
    
    .logo-text {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }
  }
  
  .sidebar-menu {
    border-right: none;
    padding-top: 10px;
    
    :deep(.el-menu-item) {
      height: 50px;
      line-height: 50px;
      
      &:hover {
        background-color: var(--sidebar-hover) !important;
      }
      
      &.is-active {
        background-color: rgba(255, 107, 53, 0.1) !important;
      }
      
      .el-icon {
        margin-right: 10px;
        font-size: 18px;
      }
    }
  }
}

.header {
  background-color: var(--header-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  
  .header-left {
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 4px;
      transition: background-color 0.3s;
      
      &:hover {
        background-color: var(--content-bg);
      }
      
      .username {
        margin: 0 8px;
        font-size: 14px;
        color: var(--text-primary);
      }
    }
  }
}

.main-content {
  background-color: var(--content-bg);
  padding: 20px;
  overflow-y: auto;
}
</style>
