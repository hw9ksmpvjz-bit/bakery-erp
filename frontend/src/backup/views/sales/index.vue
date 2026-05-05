<template>
  <div class="sales-page">
    <div class="page-header">
      <h2>銷售管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>POS開單
      </el-button>
    </div>

    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="訂單日期">
          <el-date-picker v-model="searchForm.date" type="date" placeholder="選擇日期" />
        </el-form-item>
        <el-form-item label="會員">
          <el-input v-model="searchForm.member_keyword" placeholder="會員卡號/手機" clearable />
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
        <el-table-column prop="member_name" label="會員" width="120">
          <template #default="{ row }">{{ row.member_name || '非會員' }}</template>
        </el-table-column>
        <el-table-column prop="total_amount" label="商品金額" width="100">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
        <el-table-column prop="actual_amount" label="實收金額" width="100">
          <template #default="{ row }">¥{{ row.actual_amount }}</template>
        </el-table-column>
        <el-table-column prop="points_earned" label="獲得積分" width="90" />
        <el-table-column prop="status" label="狀態" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'danger'">{{ row.status === 'completed' ? '已完成' : '已退貨' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="創建時間" width="160" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">查看</el-button>
            <el-button type="danger" link @click="handleReturn(row)">退貨</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @size-change="handleSizeChange" @current-change="handleCurrentChange" />
      </div>
    </el-card>

    <!-- POS開單對話框 -->
    <el-dialog v-model="dialogVisible" title="POS開單" width="800px">
      <el-row :gutter="20">
        <el-col :span="16">
          <el-card>
            <template #header>商品列表</template>
            <el-input v-model="productSearch" placeholder="搜索商品" clearable style="margin-bottom: 10px" />
            <el-table :data="filteredProducts" height="300" @row-click="handleAddToCart">
              <el-table-column prop="sku" label="編號" width="100" />
              <el-table-column prop="name" label="商品名稱" />
              <el-table-column prop="retail_price" label="單價" width="80">
                <template #default="{ row }">¥{{ row.retail_price }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card>
            <template #header>購物車</template>
            <div v-for="(item, index) in cart" :key="index" class="cart-item">
              <div>{{ item.name }}</div>
              <div class="cart-item-controls">
                <el-input-number v-model="item.quantity" :min="1" size="small" style="width: 80px" />
                <span>¥{{ item.retail_price * item.quantity }}</span>
                <el-button type="danger" link @click="removeFromCart(index)">刪除</el-button>
              </div>
            </div>
            <div class="cart-total">
              <div>合計: ¥{{ cartTotal }}</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      <el-divider />
      <el-form :model="orderForm" label-width="80px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="會員">
              <el-select v-model="orderForm.member_id" placeholder="選擇會員（可選）" clearable style="width: 100%">
                <el-option v-for="m in members" :key="m.id" :label="`${m.name} (${m.phone})`" :value="m.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="使用積分">
              <el-input-number v-model="orderForm.points_to_use" :min="0" style="width: 150px" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="支付方式">
          <el-checkbox-group v-model="orderForm.payments">
            <el-checkbox label="cash">現金</el-checkbox>
            <el-checkbox label="wechat">微信支付</el-checkbox>
            <el-checkbox label="alipay">支付寶</el-checkbox>
            <el-checkbox label="balance">會員餘額</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">結算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import axios from 'axios'

const loading = ref(false)
const orderList = ref([])
const products = ref([])
const members = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const searchForm = reactive({ date: '', member_keyword: '' })
const dialogVisible = ref(false)
const productSearch = ref('')
const cart = ref([])
const orderForm = reactive({ member_id: '', points_to_use: 0, payments: ['cash'] })

const filteredProducts = computed(() => {
  if (!productSearch.value) return products.value
  return products.value.filter(p => p.name.includes(productSearch.value) || p.sku.includes(productSearch.value))
})

const cartTotal = computed(() => {
  return cart.value.reduce((sum, item) => sum + item.retail_price * item.quantity, 0)
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/sales/orders', { params: { page: page.value, pageSize: pageSize.value, ...searchForm } })
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
    const res = await axios.get('/api/products', { params: { type: 'finished', pageSize: 1000 } })
    products.value = res.data.data.list
  } catch (error) {
    console.error('獲取商品失敗')
  }
}

const fetchMembers = async () => {
  try {
    const res = await axios.get('/api/customers/members', { params: { pageSize: 1000 } })
    members.value = res.data.data.list
  } catch (error) {
    console.error('獲取會員失敗')
  }
}

const handleSearch = () => {
  page.value = 1
  fetchData()
}

const handleReset = () => {
  searchForm.date = ''
  searchForm.member_keyword = ''
  handleSearch()
}

const handleAdd = () => {
  cart.value = []
  orderForm.member_id = ''
  orderForm.points_to_use = 0
  orderForm.payments = ['cash']
  dialogVisible.value = true
  fetchProducts()
  fetchMembers()
}

const handleAddToCart = (row) => {
  const existing = cart.value.find(item => item.id === row.id)
  if (existing) {
    existing.quantity++
  } else {
    cart.value.push({ ...row, quantity: 1 })
  }
}

const removeFromCart = (index) => {
  cart.value.splice(index, 1)
}

const handleSubmit = async () => {
  if (cart.value.length === 0) {
    ElMessage.warning('請選擇商品')
    return
  }
  try {
    const items = cart.value.map(item => ({ product_id: item.id, quantity: item.quantity, unit_price: item.retail_price }))
    const payments = orderForm.payments.map(method => ({ method, amount: cartTotal.value / orderForm.payments.length }))
    await axios.post('/api/sales/orders', {
      store_id: 1,
      member_id: orderForm.member_id || null,
      items,
      payments,
      points_to_use: orderForm.points_to_use
    })
    ElMessage.success('開單成功')
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '開單失敗')
  }
}

const handleView = (row) => {
  ElMessage.info('查看功能開發中...')
}

const handleReturn = (row) => {
  ElMessage.info('退貨功能開發中...')
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
.sales-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .search-card {
    margin-bottom: 20px;
  }

  .cart-item {
    padding: 10px 0;
    border-bottom: 1px solid #eee;

    .cart-item-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 5px;
    }
  }

  .cart-total {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 2px solid #333;
    font-size: 18px;
    font-weight: bold;
    text-align: right;
  }

  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
