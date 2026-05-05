// 調試版本入口文件
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import App from './App.vue'
import router from './router'
import './styles/main.scss'

console.log('🚀 main.debug.js 開始執行')

try {
  const app = createApp(App)
  console.log('✅ Vue app 創建成功')

  // 註冊所有圖標
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }
  console.log('✅ 圖標註冊成功')

  app.use(createPinia())
  console.log('✅ Pinia 掛載成功')
  
  app.use(router)
  console.log('✅ Router 掛載成功')
  
  app.use(ElementPlus, { locale: zhCn })
  console.log('✅ ElementPlus 掛載成功')

  app.mount('#app')
  console.log('✅ App 掛載到 #app 成功')
} catch (error) {
  console.error('❌ main.debug.js 執行失敗:', error)
  document.body.innerHTML = `
    <div style="padding: 20px; color: red;">
      <h1>🚨 應用啟動失敗</h1>
      <pre>${error.stack}</pre>
    </div>
  `
}
