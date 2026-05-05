<template>
  <div class="dashboard">
    <div class="page-header">
      <h2>儀表板</h2>
      <span class="date">{{ today }}</span>
    </div>

    <!-- 數據卡片 -->
    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="6">
        <div class="data-card">
          <div class="card-title">今日銷售額</div>
          <div class="card-value">¥{{ formatNumber(stats.today?.sales_amount || 0) }}</div>
          <div class="card-change" :class="(stats.today?.order_count || 0) > 0 ? 'up' : ''">
            {{ stats.today?.order_count || 0 }} 筆訂單
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="data-card">
          <div class="card-title">本月銷售額</div>
          <div class="card-value">¥{{ formatNumber(stats.this_month?.sales_amount || 0) }}</div>
          <div class="card-change" :class="(stats.this_month?.order_count || 0) > 0 ? 'up' : ''">
            {{ stats.this_month?.order_count || 0 }} 筆訂單
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="data-card">
          <div class="card-title">庫存總值</div>
          <div class="card-value">¥{{ formatNumber(stats.inventory?.total_value || 0) }}</div>
          <div class="card-change">
            {{ stats.inventory?.total_quantity || 0 }} 件商品
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="data-card warning">
          <div class="card-title">待處理事項</div>
          <div class="card-value">{{ totalPending }}</div>
          <div class="card-change down">
            請及時處理
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 歡迎信息 -->
    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>🎉 欢迎使用烘焙業ERP管理系統</span>
            </div>
          </template>
          <div style="padding: 20px; text-align: center;">
            <p style="font-size: 16px; color: #666; margin-bottom: 20px;">
              這是一套專為烘焙行業設計的進銷存管理系統
            </p>
            <el-row :gutter="20">
              <el-col :span="8">
                <div style="padding: 20px; background: #fff5f0; border-radius: 8px;">
                  <div style="font-size: 32px; margin-bottom: 10px;">🥐</div>
                  <div style="font-weight: bold; color: #ff6b35;">商品管理</div>
                  <div style="font-size: 12px; color: #999; margin-top: 5px;">配方、庫存、效期</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div style="padding: 20px; background: #f0f9ff; border-radius: 8px;">
                  <div style="font-size: 32px; margin-bottom: 10px;">📦</div>
                  <div style="font-weight: bold; color: #1890ff;">進銷存</div>
                  <div style="font-size: 12px; color: #999; margin-top: 5px;">採購、生產、銷售</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div style="padding: 20px; background: #f6ffed; border-radius: 8px;">
                  <div style="font-size: 32px; margin-bottom: 10px;">💰</div>
                  <div style="font-weight: bold; color: #52c41a;">財務報表</div>
                  <div style="font-size: 12px; color: #999; margin-top: 5px;">成本、利潤、分析</div>
                </div>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const today = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

const stats = ref({
  today: { sales_amount: 0, order_count: 0 },
  this_month: { sales_amount: 0, order_count: 0 },
  inventory: { total_quantity: 0, total_value: 0 },
  pending_tasks: {
    pending_purchase_orders: 0,
    pending_transfer_orders: 0,
    pending_production_orders: 0,
    expiry_warnings: 0,
    low_stock_products: 0
  }
})

const totalPending = computed(() => {
  return Object.values(stats.value.pending_tasks || {}).reduce((sum, count) => sum + (count || 0), 0)
})

const formatNumber = (num) => {
  return (num || 0).toLocaleString('zh-CN')
}

const fetchDashboardData = async () => {
  try {
    const response = await axios.get('/api/reports/dashboard')
    if (response.data?.data) {
      stats.value = response.data.data
    }
  } catch (error) {
    console.log('儀表板數據加載失敗，使用默認值')
  }
}

onMounted(() => {
  fetchDashboardData()
})
</script>

<style scoped lang="scss">
.dashboard {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    h2 {
      font-size: 20px;
      font-weight: 600;
    }
    
    .date {
      color: var(--text-secondary);
      font-size: 14px;
    }
  }
  
  .data-card {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 20px;
    box-shadow: var(--shadow);
    transition: transform 0.3s;
    
    &:hover {
      transform: translateY(-2px);
    }
    
    &.warning {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    }
    
    .card-title {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    
    .card-value {
      font-size: 28px;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .card-change {
      font-size: 12px;
      margin-top: 8px;
      color: var(--text-muted);
      
      &.up {
        color: #10b981;
      }
      
      &.down {
        color: #ef4444;
      }
    }
  }
  
  .mt-20 {
    margin-top: 20px;
  }
  
  .card-header {
    font-weight: 600;
  }
}
</style>
