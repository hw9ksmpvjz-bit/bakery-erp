<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <span class="logo-icon">🥐</span>
        <h1>烘焙業ERP管理系統</h1>
        <p>專業的烘焙行業進銷存解決方案</p>
      </div>

      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="用戶名"
            size="large"
            :prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="密碼"
            size="large"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-button"
            :loading="loading"
            @click="handleLogin"
          >
            登錄
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        <p>默認賬號：admin / 密碼：admin123</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const loginFormRef = ref()
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {
  username: [
    { required: true, message: '請輸入用戶名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '請輸入密碼', trigger: 'blur' },
    { min: 6, message: '密碼長度至少6位', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  try {
    await loginFormRef.value.validate()
    
    loading.value = true
    const result = await userStore.login(loginForm)
    
    if (result.success) {
      ElMessage.success('登錄成功')
      router.push('/dashboard')
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    console.error('登錄錯誤:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 50%, #ffa07a 100%);
  
  .login-box {
    width: 420px;
    padding: 40px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    
    .login-header {
      text-align: center;
      margin-bottom: 30px;
      
      .logo-icon {
        font-size: 64px;
        display: block;
        margin-bottom: 16px;
      }
      
      h1 {
        font-size: 24px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      
      p {
        font-size: 14px;
        color: var(--text-secondary);
      }
    }
    
    .login-form {
      .el-input {
        :deep(.el-input__inner) {
          height: 44px;
        }
      }
      
      .login-button {
        width: 100%;
        height: 44px;
        font-size: 16px;
        margin-top: 10px;
      }
    }
    
    .login-footer {
      margin-top: 20px;
      text-align: center;
      
      p {
        font-size: 12px;
        color: var(--text-muted);
      }
    }
  }
}

@media (max-width: 480px) {
  .login-container {
    padding: 20px;
    
    .login-box {
      width: 100%;
      padding: 30px 20px;
    }
  }
}
</style>
