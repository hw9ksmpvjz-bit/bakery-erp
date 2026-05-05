<template>
  <div class="simple-login">
    <div class="login-box">
      <h1>🥐 烘焙業ERP</h1>
      <p>請登錄系統</p>
      
      <input 
        v-model="form.username" 
        placeholder="用戶名" 
        class="input"
        @keyup.enter="login"
      />
      <input 
        v-model="form.password" 
        type="password" 
        placeholder="密碼" 
        class="input"
        @keyup.enter="login"
      />
      
      <button @click="login" :disabled="loading" class="btn">
        {{ loading ? '登錄中...' : '登錄' }}
      </button>
      
      <p class="hint">默認賬號: admin / admin123</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const loading = ref(false)
const form = ref({ username: '', password: '' })

const login = async () => {
  if (!form.value.username || !form.value.password) {
    alert('請輸入用戶名和密碼')
    return
  }
  
  loading.value = true
  try {
    const res = await axios.post('/api/auth/login', form.value)
    if (res.data.success) {
      localStorage.setItem('token', res.data.data.token)
      localStorage.setItem('userInfo', JSON.stringify(res.data.data.user))
      alert('登錄成功！')
      router.push('/dashboard')
    } else {
      alert(res.data.message || '登錄失敗')
    }
  } catch (err) {
    alert('登錄失敗: ' + (err.response?.data?.message || err.message))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.simple-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%);
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 16px;
  width: 320px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}

h1 {
  color: #ff6b35;
  margin-bottom: 10px;
}

.input {
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.input:focus {
  outline: none;
  border-color: #ff6b35;
}

.btn {
  width: 100%;
  padding: 12px;
  background: #ff6b35;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 10px;
}

.btn:hover {
  background: #e55a2b;
}

.btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.hint {
  margin-top: 20px;
  font-size: 12px;
  color: #999;
}
</style>
