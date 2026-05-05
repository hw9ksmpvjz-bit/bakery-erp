<template>
  <div class="simple-dashboard">
    <h1>🥐 烘焙ERP儀表板</h1>
    <p>歡迎使用，{{ username }}！</p>
    <div class="menu-grid">
      <router-link to="/products" class="menu-item">
        <span class="icon">📦</span>
        <span>商品管理</span>
      </router-link>
      <router-link to="/sales" class="menu-item">
        <span class="icon">💰</span>
        <span>銷售管理</span>
      </router-link>
      <router-link to="/inventory" class="menu-item">
        <span class="icon">🏭</span>
        <span>庫存管理</span>
      </router-link>
      <router-link to="/settings" class="menu-item">
        <span class="icon">⚙️</span>
        <span>系統設置</span>
      </router-link>
    </div>
    <el-button type="danger" @click="logout" style="margin-top: 30px;">退出登錄</el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const username = localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')).username : '用戶'

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  ElMessage.success('已退出登錄')
  router.push('/login')
}
</script>

<style scoped>
.simple-dashboard {
  padding: 40px;
  text-align: center;
  min-height: 100vh;
  background: #f5f7fa;
}

h1 {
  color: #ff6b35;
  margin-bottom: 10px;
}

p {
  color: #666;
  margin-bottom: 40px;
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.menu-item {
  background: white;
  padding: 30px;
  border-radius: 12px;
  text-decoration: none;
  color: #333;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.3s;
}

.menu-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.icon {
  font-size: 40px;
  display: block;
  margin-bottom: 10px;
}
</style>
