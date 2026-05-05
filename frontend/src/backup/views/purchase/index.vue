<template>
  <div class="purchase-page">
    <div class="page-header">
      <h2>採購管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增採購訂單
      </el-button>
    </div>

    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="訂單狀態">
          <el-select v-model="searchForm.status" placeholder="選擇狀態" clearable>
            <el-option label="草稿" value="draft" />
            <el-option label="待審批" value="pending" />
            <el-option label="已審批" value="approved" />
            <el-option label="部分入庫" value="partial" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="供應商">
          <el-select v-model="searchForm.supplier_id" placeholder="選擇供應商" clearable>
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="orderList" v-loading="loading" stripe>
        <el-table-column prop="order_no" label="訂單號" width="150" />
        <el-table-column prop="supplier_name" label="供應商" width="150" />
        <el-table-column prop="total_amount" label="訂單金額" width="120">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="狀態" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="order_date" label="訂單日期" width="120" />
        <el-table-column prop="created_by_name" label="創建人" width="100" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">查看</el-button>
            <el-button v-if="row.status === 'draft'" type="primary" link @click="handleSubmit(row)">提交</el-button>
            <el-button v-if="row.status === 'pending'" type="success" link @click="handleApprove(row)">審批</el-button>
            <el-button v-if="['approved', 'partial'].includes(row.status)" type="warning" link @click="handleReceive(row)">入庫</el-button>
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

    <!-- 新增訂單對話框 -->
    <el-dialog v-model="dialogVisible" title="新增採購訂單" width="800px">
      <el-form :model="form" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="供應商" required>
              <el-select v-model="form.supplier_id" placeholder="選擇供應商" style="width: 100%">
                <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="訂單日期" required>
              <el-date-picker v-model="form.order_date" type="date" placeholder="選擇日期" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="訂單明細" required>
          <el-table :data="form.items" border size="small">
            <el-table-column type="index" width="50" />
            <el-table-column label="商品">
              <template #default="{ $index }">
                <el-select v-model="form.items[$index].product_id" placeholder="選擇商品" @change="handleProductChange($index)">
                  <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="數量" width="120">
              <template #default="{ $index }">
                <el-input-number v-model="form.items[$index].quantity" :min="1" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="單價" width="120">
              <template #default="{ $index }">
                <el-input-number v-model="form.items[$index].unit_price" :min="0" :precision="2" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ $index }">
                <el-button type="danger" link @click="removeItem($index)">刪除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button type="primary" link @click="addItem" style="margin-top: 10px">
            <el-icon><Plus /></el-icon>添加商品
          </el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">確定</el-button>
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
const suppliers = ref([])
const products = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const searchForm = reactive({
  status: '',
  supplier_id: ''
})

const dialogVisible = ref(false)
const form = reactive({
  supplier_id: '',
  order_date: '',
  items: []
})

const getStatusType = (status) => {
  const map = {
    draft: 'info',
    pending: 'warning',
    approved: 'success',
    partial: 'warning',
    completed: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    draft: '草稿',
    pending: '待審批',
    approved: '已審批',
    partial: '部分入庫',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/purchase/orders', {
      params: { page: page.value, pageSize: pageSize.value, ...searchForm }
    })
    orderList.value = res.data.data.list
    total.value = res.data.data.pagination.total
  } catch (error) {
    ElMessage.error('獲取數據失敗')
  } finally {
    loading.value = false
  }
}

const fetchSuppliers = async () => {
  try {
    const res = await axios.get('/api/suppliers')
    suppliers.value = res.data.data.list
  } catch (error) {
    console.error('獲取供應商失敗')
  }
}

const fetchProducts = async () => {
  try {
    const res = await axios.get('/api/products', { params: { pageSize: 1000, type: 'material' } })
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
  searchForm.supplier_id = ''
  handleSearch()
}

const handleAdd = () => {
  form.supplier_id = ''
  form.order_date = new Date().toISOString().split('T')[0]
  form.items = [{ product_id: '', quantity: 1, unit_price: 0 }]
  dialogVisible.value = true
}

const addItem = () => {
  form.items.push({ product_id: '', quantity: 1, unit_price: 0 })
}

const removeItem = (index) => {
  form.items.splice(index, 1)
}

const handleProductChange = (index) => {
  const product = products.value.find(p => p.id === form.items[index].product_id)
  if (product) {
    form.items[index].unit_price = product.purchase_price
  }
}

const handleSubmit = async () => {
  try {
    await axios.post('/api/purchase/orders', form)
    ElMessage.success('創建成功')
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '創建失敗')
  }
}

const handleView = (row) => {
  ElMessage.info('查看功能開發中...')
}

const handleSubmitOrder = async (row) => {
  try {
    await axios.post(`/api/purchase/orders/${row.id}/submit`)
    ElMessage.success('提交成功')
    fetchData()
  } catch (error) {
    ElMessage.error('提交失敗')
  }
}

const handleApprove = async (row) => {
  try {
    await ElMessageBox.confirm('確定要審批通過嗎？', '提示')
    await axios.post(`/api/purchase/orders/${row.id}/approve`, { action: 'approve' })
    ElMessage.success('審批成功')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('審批失敗')
    }
  }
}

const handleReceive = (row) => {
  ElMessage.info('入庫功能開發中...')
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
  fetchSuppliers()
  fetchProducts()
})
</script>

<style scoped lang="scss">
.purchase-page {
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
