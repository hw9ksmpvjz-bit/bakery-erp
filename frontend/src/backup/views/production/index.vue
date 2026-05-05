<template>
  <div class="production-page">
    <div class="page-header">
      <h2>生產管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增生產計劃
      </el-button>
    </div>

    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="計劃狀態">
          <el-select v-model="searchForm.status" placeholder="選擇狀態" clearable>
            <el-option label="草稿" value="draft" />
            <el-option label="待審批" value="pending" />
            <el-option label="已審批" value="approved" />
            <el-option label="生產中" value="processing" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="計劃日期">
          <el-date-picker v-model="searchForm.date" type="date" placeholder="選擇日期" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="orderList" v-loading="loading" stripe>
        <el-table-column prop="order_no" label="計劃單號" width="150" />
        <el-table-column prop="product_name" label="生產商品" min-width="150" />
        <el-table-column prop="plan_quantity" label="計劃數量" width="100" />
        <el-table-column prop="actual_quantity" label="實際數量" width="100" />
        <el-table-column prop="status" label="狀態" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plan_date" label="計劃日期" width="120" />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'draft'" type="primary" link @click="handleSubmit(row)">提交</el-button>
            <el-button v-if="row.status === 'pending'" type="success" link @click="handleApprove(row)">審批</el-button>
            <el-button v-if="row.status === 'approved'" type="warning" link @click="handleStart(row)">開始生產</el-button>
            <el-button v-if="row.status === 'processing'" type="primary" link @click="handleRequisition(row)">原料領料</el-button>
            <el-button v-if="row.status === 'processing'" type="success" link @click="handleComplete(row)">完成生產</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @size-change="handleSizeChange" @current-change="handleCurrentChange" />
      </div>
    </el-card>

    <!-- 新增計劃對話框 -->
    <el-dialog v-model="dialogVisible" title="新增生產計劃" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="生產商品" required>
          <el-select v-model="form.product_id" placeholder="選擇商品" style="width: 100%">
            <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="計劃數量" required>
          <el-input-number v-model="form.plan_quantity" :min="1" style="width: 200px" />
        </el-form-item>
        <el-form-item label="計劃日期" required>
          <el-date-picker v-model="form.plan_date" type="date" placeholder="選擇日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="使用配方">
          <el-select v-model="form.recipe_id" placeholder="選擇配方（可選）" style="width: 100%" clearable>
            <el-option v-for="r in recipes" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitForm">確定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import axios from 'axios'

const loading = ref(false)
const orderList = ref([])
const products = ref([])
const recipes = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const searchForm = reactive({ status: '', date: '' })
const dialogVisible = ref(false)
const form = reactive({ product_id: '', plan_quantity: 1, plan_date: '', recipe_id: '' })

const getStatusType = (status) => {
  const map = { draft: 'info', pending: 'warning', approved: 'success', processing: 'primary', completed: 'success', cancelled: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { draft: '草稿', pending: '待審批', approved: '已審批', processing: '生產中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/production/orders', { params: { page: page.value, pageSize: pageSize.value, ...searchForm } })
    orderList.value = res.data.data.list
    total.value = res.data.data.pagination.total
  } catch (error) {
    ElMessage.error('獲取數據失敗')
  } finally {
    loading.value = false
  }
}

const fetchProducts = async () => {
  try {
    const res = await axios.get('/api/products', { params: { is_producible: 1, pageSize: 1000 } })
    products.value = res.data.data.list
  } catch (error) {
    console.error('獲取商品失敗')
  }
}

const handleSearch = () => {
  page.value = 1
  fetchData()
}

const handleReset = () => {
  searchForm.status = ''
  searchForm.date = ''
  handleSearch()
}

const handleAdd = () => {
  form.product_id = ''
  form.plan_quantity = 1
  form.plan_date = new Date().toISOString().split('T')[0]
  form.recipe_id = ''
  dialogVisible.value = true
}

const handleSubmitForm = async () => {
  try {
    await axios.post('/api/production/orders', form)
    ElMessage.success('創建成功')
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '創建失敗')
  }
}

const handleSubmit = async (row) => {
  try {
    await axios.post(`/api/production/orders/${row.id}/submit`)
    ElMessage.success('提交成功')
    fetchData()
  } catch (error) {
    ElMessage.error('提交失敗')
  }
}

const handleApprove = async (row) => {
  try {
    await ElMessageBox.confirm('確定要審批通過嗎？', '提示')
    await axios.post(`/api/production/orders/${row.id}/approve`, { action: 'approve' })
    ElMessage.success('審批成功')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('審批失敗')
  }
}

const handleStart = async (row) => {
  try {
    await axios.post(`/api/production/orders/${row.id}/start`)
    ElMessage.success('開始生產')
    fetchData()
  } catch (error) {
    ElMessage.error('操作失敗')
  }
}

const handleRequisition = (row) => {
  ElMessage.info('原料領料功能開發中...')
}

const handleComplete = (row) => {
  ElMessage.info('完成生產功能開發中...')
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
  fetchProducts()
})
</script>

<style scoped lang="scss">
.production-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .search-card {
    margin-bottom: 20px;
  }

  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
