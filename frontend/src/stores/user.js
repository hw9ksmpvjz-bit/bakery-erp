import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useUserStore = defineStore('user', () => {
  // State
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))

  // Getters
  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.username || '')
  const role = computed(() => userInfo.value?.role_code || '')
  const isSuperAdmin = computed(() => role.value === 'super_admin')

  // Actions
  const setToken = (newToken) => {
    token.value = newToken
    localStorage.setItem('token', newToken)
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
  }

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  const login = async (credentials) => {
    try {
      const response = await axios.post('/api/auth/login', credentials)
      const { token: newToken, user } = response.data.data
      
      setToken(newToken)
      setUserInfo(user)
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || '登錄失敗'
      }
    }
  }

  const logout = () => {
    token.value = ''
    userInfo.value = {}
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    delete axios.defaults.headers.common['Authorization']
  }

  // 初始化 axios 頭
  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    username,
    role,
    isSuperAdmin,
    login,
    logout,
    setToken,
    setUserInfo
  }
})
