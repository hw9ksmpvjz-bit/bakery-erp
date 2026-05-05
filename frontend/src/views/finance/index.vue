<template>
  <div class="finance-page">
    <div class="page-header">
      <h2>財務管理</h2>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>應收賬款</span>
              <el-button type="primary" link @click="handleAddReceipt">收款</el-button>
            </div>
          </template>
          <div class="stat-item">
            <div class="stat-label">總欠款</div>
            <div class="stat-value warning">¥{{ receivableStats.total_remaining || 0 }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">逾期欠款</div>
            <div class="stat-value danger">¥{{ receivableStats.overdue_amount || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>應付賬款</span>
              <el-button type="primary" link @click="handleAddPayment">付款</el-button>
            </div>
          </template>
          <div class="stat-item">
            <div class="stat-label">總欠款</div>
            <div class="stat-value warning">¥{{ payableStats.total_remaining || 0 }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">逾期欠款</div>
            <div class="stat-value danger">¥{{ payableStats.overdue_amount || 0 }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="mt-20">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="應收賬款" name="receivable">
          <el-table :data="receivableList" stripe>
            <el-table-column prop="customer_name" label="客戶" />
            <el-table-column prop="total_amount" label="欠款金額">
              <template #default="{ row }">¥{{ row.total_amount }}</template>
            </el-table-column>
            <el-table-column prop="remaining_amount" label="剩餘欠款">
              <template #default="{ row }">¥{{ row.remaining_amount }}</template>
            </el-table-column>
            <el-table-column prop="age_days" label="賬齡" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="primary" link @click="handleReceipt(row)">收款</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="應付賬款" name="payable">
          <el-table :data="payableList" stripe>
            <el-table-column prop="supplier_name" label="供應商" />
            <el-table-column prop="total_amount" label="欠款金額">
              <template #default="{ row }">¥{{ row.total_amount }}</template>
            </el-table-column>
            <el-table-column prop="remaining_amount" label="剩餘欠款">
              <template #default="{ row }">¥{{ row.remaining_amount }}</template>
            </el-table-column>
            <el-table-column prop="age_days" label="賬齡" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="primary" link @click="handlePayment(row)">付款</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const activeTab = ref('receivable')
const receivableList = ref([])
const payableList = ref([])
const receivableStats = reactive({ total_remaining: 0, overdue_amount: 0 })
const payableStats = reactive({ total_remaining: 0, overdue_amount: 0 })

const fetchReceivables = async () => {
  try {
    const res = await axios.get('/api/finance/receivables')
    receivableList.value = res.data.data.list
    Object.assign(receivableStats, res.data.data.stats)
  } catch (error) {
    console.error('獲取應收失敗')
  }
}

const fetchPayables = async () => {
  try {
    const res = await axios.get('/api/finance/payables')
    payableList.value = res.data.data.list
    Object.assign(payableStats, res.data.data.stats)
  } catch (error) {
    console.error('獲取應付失敗')
  }
}

const handleAddReceipt = () => {
  ElMessage.info('收款功能開發中...')
}

const handleAddPayment = () => {
  ElMessage.info('付款功能開發中...')
}

const handleReceipt = (row) => {
  ElMessage.info('收款功能開發中...')
}

const handlePayment = (row) => {
  ElMessage.info('付款功能開發中...')
}

onMounted(() => {
  fetchReceivables()
  fetchPayables()
})
</script>

<style scoped lang="scss">
.finance-page {
  .page-header {
    margin-bottom: 20px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    padding: 15px 0;
    border-bottom: 1px solid #eee;

    &:last-child {
      border-bottom: none;
    }

    .stat-label {
      color: var(--text-secondary);
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;

      &.warning {
        color: #f59e0b;
      }

      &.danger {
        color: #ef4444;
      }
    }
  }

  .mt-20 {
    margin-top: 20px;
  }
}
</style>
