<template>
  <div class="simple-layout">
    <header class="header">
      <span class="logo">🥐 烘焙ERP</span>
      <nav>
        <router-link to="/dashboard">儀表板</router-link>
        <router-link to="/products">商品</router-link>
        <router-link to="/sales">銷售</router-link>
        <router-link to="/inventory">庫存</router-link>
        <a href="#" @click.prevent="logout">退出</a>
      </nav>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  router.push('/login')
}
</script>

<style scoped>
.simple-layout {
  min-height: 100vh;
}

.header {
  background: #ff6b35;
  color: white;
  padding: 15px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 20px;
  font-weight: bold;
}

nav a {
  color: white;
  text-decoration: none;
  margin-left: 20px;
  padding: 5px 10px;
  border-radius: 4px;
}

nav a:hover {
  background: rgba(255,255,255,0.2);
}

.main {
  padding: 20px;
}
</style>
