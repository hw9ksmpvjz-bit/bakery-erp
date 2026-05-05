<template>
  <div class="reports-page">
    <div class="page-header">
      <h2>報表中心</h2>
    </div>

    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="開始日期">
          <el-date-picker v-model="searchForm.start_date" type="date" placeholder="選擇開始日期" />
        </el-form-item>
        <el-form-item label="結束日期">
          <el-date-picker v-model="searchForm.end_date" type="date" placeholder="選擇結束日期" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">生成報表</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="銷售報表" name="sales">
        <el-table :data="salesData" stripe>
          <el-table-column prop="date" label="日期" />
          <el-table-column prop="order_count" label="訂單數" />
          <el-table-column prop="total_amount" label="銷售額">
            <template #default="{ row }">¥{{ row.total_amount }}</template>
          </el-table-column>
          <el-table-column prop="profit" label="利潤">
            <template #default="{ row }">¥{{ row.profit }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="庫存報表" name="inventory">
        <el-alert title="庫存報表功能開發中" type="info" :closable="false" />
      </el-tab-pane>
      <el-tab-pane label="利潤報表" name="profit">
        <el-alert title="利潤報表功能開發中" type="info" :closable="false" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const activeTab = ref('sales')
const searchForm = reactive({ start_date: '', end_date: '' })
const salesData = ref([])

const handleSearch = async () => {
  try {
    const res = await axios.get('/api/reports/sales', {
      params: { ...searchForm, group_by: 'date' }
    })
    salesData.value = res.data.data.list
  } catch (error) {
    ElMessage.error('獲取報表失敗')
  }
}
</script>

<style scoped lang="scss">
.reports-page {
  .page-header {
    margin-bottom: 20px;
  }

  .search-card {
    margin-bottom: 20px;
  }
}
</style>
