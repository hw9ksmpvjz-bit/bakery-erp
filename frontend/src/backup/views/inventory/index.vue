<template>
  <div class="inventory-page">
    <div class="page-header">
      <h2>庫存管理</h2>
      <div>
        <el-button type="warning" @click="showExpiryWarnings">
          <el-icon><Warning /></el-icon>效期預警
        </el-button>
        <el-button type="primary" @click="handleTransfer">
          <el-icon><Switch /></el-icon>庫存調撥
        </el-button>
      </div>
    </div>

    <!-- 效期預警卡片（烘焙專屬） -->
    <el-row :gutter="20" class="warning-cards" v-if="showWarnings">
      <el-col :span="8">
        <el-card class="warning-card expired">
          <div class="warning-title">🔴 已過期</div>
          <div class="warning-count">{{ expiryStats.expired }} 批次</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="warning-card critical">
          <div class="warning-title">🟠 緊急（1天內）</div>
          <div class="warning-count">{{ expiryStats.critical }} 批次</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="warning-card warning">
          <div class="warning-title">🟡 臨期预警</div>
          <div class="warning-count">{{ expiryStats.warning }} 批次</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="商品">
          <el-input v-model="searchForm.keyword" placeholder="商品名稱/編號" clearable />
        </el-form-item>
        <el-form-item label="效期狀態">
          <el-select v-model="searchForm.expiry_status" placeholder="選擇效期狀態" clearable>
            <el-option label="正常" value="normal" />
            <el-option label="臨期" value="warning" />
            <el-option label="緊急" value="critical" />
            <el-option label="已過期" value="expired" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="inventoryList" v-loading="loading" stripe>
        <el-table-column prop="batch_no" label="批次號" width="150" />
        <el-table-column prop="product_sku" label="商品編號" width="120" />
        <el-table-column prop="product_name" label="商品名稱" min-width="150" />
        <el-table-column prop="store_name" label="所在倉庫" width="120" />
        <el-table-column prop="quantity" label="庫存數量" width="100" />
        <el-table-column prop="production_date" label="生產日期" width="120" />
        <el-table-column prop="expiry_date" label="效期截止" width="120">
          <template #default="{ row }">
            <span :class="getExpiryClass(row)">{{ row.expiry_date }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="days_until_expiry" label="剩餘天數" width="100">
          <template #default="{ row }">
            <el-tag :type="getExpiryType(row)" size="small">
              {{ row.days_until_expiry > 0 ? `${row.days_until_expiry}天` : '已過期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleScrap(row)">報廢</el-button>
            <el-button type="warning" link @click="handleTransfer(row)">調撥</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning, Switch } from '@element-plus/icons-vue'
import axios from 'axios'

const loading = ref(false)
const inventoryList = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const showWarnings = ref(false)
const expiryStats = reactive({
  expired: 0,
  critical: 0,
  warning: 0
})

const searchForm = reactive({
  keyword: '',
  expiry_status: ''
})

const getExpiryClass = (row) => {
  if (row.days_until_expiry < 0) return 'expired-text'
  if (row.days_until_expiry <= 1) return 'critical-text'
  if (row.days_until_expiry <= 3) return 'warning-text'
  return ''
}

const getExpiryType = (row) => {
  if (row.days_until_expiry < 0) return 'danger'
  if (row.days_until_expiry <= 1) return 'warning'
  if (row.days_until_expiry <= 3) return 'warning'
  return 'success'
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/inventory', {
      params: { page: page.value, pageSize: pageSize.value, ...searchForm }
    })
    inventoryList.value = res.data.data.list
    total.value = res.data.data.pagination.total
  } catch (error) {
    ElMessage.error('獲取數據失敗')
  } finally {
    loading.value = false
  }
}

const fetchExpiryStats = async () => {
  try {
    const res = await axios.get('/api/inventory/expiry-warnings')
    const stats = res.data.data.statistics
    expiryStats.expired = stats.expired || 0
    expiryStats.critical = stats.critical || 0
    expiryStats.warning = stats.warning || 0
  } catch (error) {
    console.error('獲取效期統計失敗')
  }
}

const showExpiryWarnings = () => {
  showWarnings.value = !showWarnings.value
  if (showWarnings.value) {
    fetchExpiryStats()
  }
}

const handleSearch = () => {
  page.value = 1
  fetchData()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.expiry_status = ''
  handleSearch()
}

const handleScrap = (row) => {
  ElMessage.info('報廢功能開發中...')
}

const handleTransfer = (row) => {
  ElMessage.info('調撥功能開發中...')
}

const handleSizeChange = (val) => {
  pageSize.value = val
  fetchData()
}

const handleCurrentChange = (val) => {
  page.value = val
  fetchData()
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="scss">
.inventory-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .warning-cards {
    margin-bottom: 20px;

    .warning-card {
      text-align: center;

      &.expired {
        background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      }

      &.critical {
        background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
      }

      &.warning {
        background: linear-gradient(135deg, #fef9c3 0%, #fde047 100%);
      }

      .warning-title {
        font-size: 14px;
        margin-bottom: 8px;
      }

      .warning-count {
        font-size: 24px;
        font-weight: 600;
      }
    }
  }

  .search-card {
    margin-bottom: 20px;
  }

  .expired-text {
    color: #dc2626;
    font-weight: bold;
  }

  .critical-text {
    color: #ea580c;
    font-weight: bold;
  }

  .warning-text {
    color: #ca8a04;
  }

  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
