<template>
  <div class="products-page">
    <div class="page-header">
      <h2>商品管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增商品
      </el-button>
    </div>

    <!-- 搜索表單 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="關鍵詞">
          <el-input v-model="searchForm.keyword" placeholder="商品名稱/編號" clearable />
        </el-form-item>
        <el-form-item label="分類">
          <el-select v-model="searchForm.category_id" placeholder="選擇分類" clearable>
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="類型">
          <el-select v-model="searchForm.type" placeholder="選擇類型" clearable>
            <el-option label="成品" value="finished" />
            <el-option label="半成品" value="semi" />
            <el-option label="原料" value="material" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 數據表格 -->
    <el-card>
      <el-table :data="productList" v-loading="loading" stripe>
        <el-table-column prop="sku" label="商品編號" width="120" />
        <el-table-column prop="name" label="商品名稱" min-width="150" />
        <el-table-column prop="category_name" label="分類" width="100" />
        <el-table-column prop="type" label="類型" width="80">
          <template #default="{ row }">
            <el-tag :type="getTypeType(row.type)">{{ getTypeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="retail_price" label="零售價" width="100">
          <template #default="{ row }">¥{{ row.retail_price }}</template>
        </el-table-column>
        <el-table-column prop="stock_quantity" label="庫存" width="80" />
        <el-table-column prop="shelf_life_days" label="保質期" width="80">
          <template #default="{ row }">{{ row.shelf_life_days }}天</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">編輯</el-button>
            <el-button type="primary" link @click="handleViewRecipe(row)">配方</el-button>
            <el-button type="danger" link @click="handleDelete(row)">刪除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分頁 -->
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

    <!-- 新增/編輯對話框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px">
      <el-form :model="form" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品編號" required>
              <el-input v-model="form.sku" placeholder="請輸入商品編號" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品名稱" required>
              <el-input v-model="form.name" placeholder="請輸入商品名稱" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="分類" required>
              <el-select v-model="form.category_id" placeholder="選擇分類" style="width: 100%">
                <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="類型" required>
              <el-select v-model="form.type" placeholder="選擇類型" style="width: 100%">
                <el-option label="成品" value="finished" />
                <el-option label="半成品" value="semi" />
                <el-option label="原料" value="material" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="零售價" required>
              <el-input-number v-model="form.retail_price" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="保質期(天)" required>
              <el-input-number v-model="form.shelf_life_days" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="預警天數">
          <el-input-number v-model="form.warning_days" :min="1" style="width: 200px" />
          <span class="form-tip">效期提前預警天數（烘焙專屬）</span>
        </el-form-item>
        <el-form-item label="可生產">
          <el-switch v-model="form.is_producible" />
          <span class="form-tip">是否可通過配方生產</span>
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
const productList = ref([])
const categories = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const searchForm = reactive({
  keyword: '',
  category_id: '',
  type: ''
})

const dialogVisible = ref(false)
const dialogTitle = ref('新增商品')
const form = reactive({
  id: null,
  sku: '',
  name: '',
  category_id: '',
  type: 'finished',
  retail_price: 0,
  shelf_life_days: 3,
  warning_days: 1,
  is_producible: true
})

const getTypeType = (type) => {
  const map = { finished: 'success', semi: 'warning', material: 'info' }
  return map[type] || 'info'
}

const getTypeText = (type) => {
  const map = { finished: '成品', semi: '半成品', material: '原料' }
  return map[type] || type
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/products', {
      params: { page: page.value, pageSize: pageSize.value, ...searchForm }
    })
    productList.value = res.data.data.list
    total.value = res.data.data.pagination.total
  } catch (error) {
    ElMessage.error('獲取數據失敗')
  } finally {
    loading.value = false
  }
}

const fetchCategories = async () => {
  try {
    const res = await axios.get('/api/categories')
    categories.value = res.data.data.list
  } catch (error) {
    console.error('獲取分類失敗')
  }
}

const handleSearch = () => {
  page.value = 1
  fetchData()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.category_id = ''
  searchForm.type = ''
  handleSearch()
}

const handleAdd = () => {
  dialogTitle.value = '新增商品'
  Object.assign(form, {
    id: null,
    sku: '',
    name: '',
    category_id: '',
    type: 'finished',
    retail_price: 0,
    shelf_life_days: 3,
    warning_days: 1,
    is_producible: true
  })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '編輯商品'
  Object.assign(form, row)
  dialogVisible.value = true
}

const handleSubmit = async () => {
  try {
    if (form.id) {
      await axios.put(`/api/products/${form.id}`, form)
    } else {
      await axios.post('/api/products', form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '保存失敗')
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('確定要刪除該商品嗎？', '提示', { type: 'warning' })
    await axios.delete(`/api/products/${row.id}`)
    ElMessage.success('刪除成功')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('刪除失敗')
    }
  }
}

const handleViewRecipe = (row) => {
  ElMessage.info('配方功能開發中...')
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
  fetchCategories()
})
</script>

<style scoped lang="scss">
.products-page {
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

  .form-tip {
    margin-left: 10px;
    color: var(--text-muted);
    font-size: 12px;
  }
}
</style>
