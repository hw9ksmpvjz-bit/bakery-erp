<template>
  <div class="dashboard">
    <!-- 頂部歡迎區 -->
    <div class="welcome-section">
      <h1>🥐 歡迎使用烘焙業ERP管理系統</h1>
      <p class="subtitle">今天是 {{ today }}，祝您工作順利！</p>
    </div>

    <!-- 功能分類導航（參照金蝶分類樹思路） -->
    <div class="module-grid">
      <!-- 基礎資料 -->
      <el-card class="module-card" shadow="hover" @click="goTo('/products')">
        <div class="module-icon" style="background: #e3f2fd;">
          <el-icon :size="32" color="#1976d2"><Document /></el-icon>
        </div>
        <div class="module-info">
          <h3>基礎資料</h3>
          <p>商品、供應商管理</p>
        </div>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </el-card>

      <!-- 採購管理 -->
      <el-card class="module-card" shadow="hover" @click="goTo('/purchase')">
        <div class="module-icon" style="background: #f3e5f5;">
          <el-icon :size="32" color="#7b1fa2"><ShoppingCart /></el-icon>
        </div>
        <div class="module-info">
          <h3>採購管理</h3>
          <p>採購訂單、入庫管理</p>
        </div>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </el-card>

      <!-- 生產管理 -->
      <el-card class="module-card" shadow="hover" @click="goTo('/production')">
        <div class="module-icon" style="background: #e8f5e9;">
          <el-icon :size="32" color="#388e3c"><Box /></el-icon>
        </div>
        <div class="module-info">
          <h3>生產管理</h3>
          <p>配方、生產計劃、領料</p>
        </div>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </el-card>

      <!-- 銷售管理 -->
      <el-card class="module-card" shadow="hover" @click="goTo('/sales')">
        <div class="module-icon" style="background: #fff3e0;">
          <el-icon :size="32" color="#f57c00"><Sell /></el-icon>
        </div>
        <div class="module-info">
          <h3>銷售管理</h3>
          <p>POS開單、會員、門店</p>
        </div>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </el-card>

      <!-- 庫存管理 -->
      <el-card class="module-card" shadow="hover" @click="goTo('/inventory')">
        <div class="module-icon" style="background: #fce4ec;">
          <el-icon :size="32" color="#c2185b"><OfficeBuilding /></el-icon>
        </div>
        <div class="module-info">
          <h3>庫存管理</h3>
          <p>庫存查詢、調撥、效期</p>
        </div>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </el-card>

      <!-- 財務管理 -->
      <el-card class="module-card" shadow="hover" @click="goTo('/finance-report')">
        <div class="module-icon" style="background: #e0f2f1;">
          <el-icon :size="32" color="#00796b"><Money /></el-icon>
        </div>
        <div class="module-info">
          <h3>財務管理</h3>
          <p>報表、應收應付</p>
        </div>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </el-card>
    </div>

    <!-- 快速統計（簡化版） -->
    <el-row :gutter="20" class="quick-stats">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ stats.todayOrders }}</div>
          <div class="stat-label">今日訂單</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">¥{{ stats.todayAmount }}</div>
          <div class="stat-label">今日營業額</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card warning">
          <div class="stat-value">{{ stats.expiryWarning }}</div>
          <div class="stat-label">效期預警</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ stats.lowStock }}</div>
          <div class="stat-label">低庫存預警</div>
        </div>
      </el-col>
    </el-row>

    <!-- 系統公告/提示 -->
    <el-card class="notice-card">
      <template #header>
        <span>📢 系統公告</span>
      </template>
      <p>🎉 烘焙ERP系統極簡版本已上線！後續功能模塊將逐步開發完善。</p>
      <p>💡 當前可用功能：基礎資料、採購、生產、銷售、庫存、財務管理</p>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  Document, ShoppingCart, Box, Sell, OfficeBuilding, Money, ArrowRight
} from '@element-plus/icons-vue'

const router = useRouter()

const today = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

const stats = ref({
  todayOrders: 0,
  todayAmount: 0,
  expiryWarning: 0,
  lowStock: 0
})

const goTo = (path) => {
  router.push(path)
}

const fetchStats = async () => {
  try {
    const response = await axios.get('/api/reports/dashboard')
    if (response.data?.data) {
      const data = response.data.data
      stats.value.todayOrders = data.today?.order_count || 0
      stats.value.todayAmount = data.today?.sales_amount || 0
      stats.value.expiryWarning = data.pending_tasks?.expiry_warnings || 0
      stats.value.lowStock = data.pending_tasks?.low_stock_products || 0
    }
  } catch (error) {
    console.log('統計數據加載失敗，使用默認值')
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

/* 歡迎區 */
.welcome-section {
  text-align: center;
  margin-bottom: 30px;
}

.welcome-section h1 {
  color: #ff6b35;
  margin-bottom: 10px;
  font-size: 28px;
}

.subtitle {
  color: #666;
  font-size: 16px;
}

/* 功能模塊網格 */
.module-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.module-card {
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  padding: 20px;
}

.module-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

.module-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  flex-shrink: 0;
}

.module-info {
  flex: 1;
}

.module-info h3 {
  margin: 0 0 6px 0;
  font-size: 18px;
  color: #333;
}

.module-info p {
  margin: 0;
  font-size: 13px;
  color: #999;
}

.arrow {
  color: #ccc;
  font-size: 20px;
}

/* 快速統計 */
.quick-stats {
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border-left: 4px solid #ff6b35;
}

.stat-card.warning {
  border-left-color: #ff9800;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #ff6b35;
  margin-bottom: 8px;
}

.stat-card.warning .stat-value {
  color: #ff9800;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

/* 公告卡片 */
.notice-card {
  background: linear-gradient(135deg, #fff5f0 0%, #ffffff 100%);
}

.notice-card p {
  margin: 8px 0;
  color: #666;
}

/* 響應式 */
@media (max-width: 992px) {
  .module-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .module-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-stats .el-col {
    margin-bottom: 15px;
  }
}
</style>
