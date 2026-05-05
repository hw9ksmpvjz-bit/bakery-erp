<template>
  <div class="products-page">
    <div class="page-header">
      <h2>商品信息</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增商品
      </el-button>
    </div>

    <!-- 搜索筛选区域 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="商品编码">
          <el-input v-model="searchForm.code" placeholder="请输入商品编码" clearable />
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="searchForm.name" placeholder="请输入商品名称" clearable />
        </el-form-item>
        <el-form-item label="商品分类">
          <el-select v-model="searchForm.category" placeholder="请选择分类" clearable>
            <el-option
              v-for="item in categoryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="启用" value="1" />
            <el-option label="禁用" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="table-card" shadow="never">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="code" label="商品编码" width="120" />
        <el-table-column prop="name" label="商品名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="商品分类" width="120" />
        <el-table-column prop="spec" label="规格型号" width="120" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="purchasePrice" label="采购价" width="100" align="right">
          <template #default="{ row }">
            ¥{{ row.purchasePrice?.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="salePrice" label="销售价" width="100" align="right">
          <template #default="{ row }">
            ¥{{ row.salePrice?.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" align="right" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '1' ? 'success' : 'info'">
              {{ row.status === '1' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="handleView(row)">查看</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pageParams.page"
          v-model:page-size="pageParams.pageSize"
          :total="pageParams.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增商品' : '编辑商品'"
      width="700px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品编码" prop="code">
              <el-input v-model="formData.code" placeholder="请输入商品编码" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="formData.name" placeholder="请输入商品名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品分类" prop="categoryId">
              <el-select v-model="formData.categoryId" placeholder="请选择分类" style="width: 100%">
                <el-option
                  v-for="item in categoryOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规格型号" prop="spec">
              <el-input v-model="formData.spec" placeholder="请输入规格型号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="单位" prop="unit">
              <el-select v-model="formData.unit" placeholder="请选择单位" style="width: 100%">
                <el-option label="个" value="个" />
                <el-option label="件" value="件" />
                <el-option label="箱" value="箱" />
                <el-option label="kg" value="kg" />
                <el-option label="g" value="g" />
                <el-option label="L" value="L" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="条形码" prop="barcode">
              <el-input v-model="formData.barcode" placeholder="请输入条形码" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="采购价" prop="purchasePrice">
              <el-input-number v-model="formData.purchasePrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="销售价" prop="salePrice">
              <el-input-number v-model="formData.salePrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="会员价" prop="memberPrice">
              <el-input-number v-model="formData.memberPrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="库存预警" prop="stockWarning">
              <el-input-number v-model="formData.stockWarning" :min="0" :precision="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="商品图片">
          <el-upload
            class="avatar-uploader"
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleImageChange"
          >
            <img v-if="formData.image" :src="formData.image" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio label="1">启用</el-radio>
            <el-radio label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 加载状态
const loading = ref(false)

// 搜索表单
const searchForm = reactive({
  code: '',
  name: '',
  category: '',
  status: ''
})

// 分类选项
const categoryOptions = [
  { label: '面包', value: '1' },
  { label: '蛋糕', value: '2' },
  { label: '饼干', value: '3' },
  { label: '甜点', value: '4' },
  { label: '饮品', value: '5' },
  { label: '原材料', value: '6' }
]

// 表格数据
const tableData = ref([
  {
    id: 1,
    code: 'SP001',
    name: '法式牛角包',
    categoryId: '1',
    categoryName: '面包',
    spec: '80g/个',
    unit: '个',
    barcode: '6901234567890',
    purchasePrice: 3.50,
    salePrice: 8.00,
    memberPrice: 7.20,
    stock: 156,
    stockWarning: 20,
    status: '1',
    image: '',
    remark: '招牌产品'
  },
  {
    id: 2,
    code: 'SP002',
    name: '巧克力蛋糕',
    categoryId: '2',
    categoryName: '蛋糕',
    spec: '6寸',
    unit: '个',
    barcode: '6901234567891',
    purchasePrice: 25.00,
    salePrice: 58.00,
    memberPrice: 52.00,
    stock: 23,
    stockWarning: 5,
    status: '1',
    image: '',
    remark: '生日蛋糕'
  },
  {
    id: 3,
    code: 'SP003',
    name: '抹茶曲奇',
    categoryId: '3',
    categoryName: '饼干',
    spec: '200g/盒',
    unit: '盒',
    barcode: '6901234567892',
    purchasePrice: 8.00,
    salePrice: 18.00,
    memberPrice: 16.00,
    stock: 89,
    stockWarning: 10,
    status: '1',
    image: '',
    remark: ''
  },
  {
    id: 4,
    code: 'SP004',
    name: '提拉米苏',
    categoryId: '4',
    categoryName: '甜点',
    spec: '120g/份',
    unit: '份',
    barcode: '6901234567893',
    purchasePrice: 12.00,
    salePrice: 28.00,
    memberPrice: 25.00,
    stock: 45,
    stockWarning: 8,
    status: '1',
    image: '',
    remark: ''
  },
  {
    id: 5,
    code: 'SP005',
    name: '美式咖啡',
    categoryId: '5',
    categoryName: '饮品',
    spec: '350ml/杯',
    unit: '杯',
    barcode: '6901234567894',
    purchasePrice: 4.00,
    salePrice: 15.00,
    memberPrice: 12.00,
    stock: 999,
    stockWarning: 50,
    status: '1',
    image: '',
    remark: '现磨咖啡'
  },
  {
    id: 6,
    code: 'SP006',
    name: '高筋面粉',
    categoryId: '6',
    categoryName: '原材料',
    spec: '25kg/袋',
    unit: '袋',
    barcode: '6901234567895',
    purchasePrice: 120.00,
    salePrice: 0,
    memberPrice: 0,
    stock: 12,
    stockWarning: 3,
    status: '1',
    image: '',
    remark: '原材料不对外销售'
  }
])

// 分页参数
const pageParams = reactive({
  page: 1,
  pageSize: 10,
  total: 6
})

// 弹窗控制
const dialogVisible = ref(false)
const dialogType = ref('add')
const formRef = ref(null)

// 表单数据
const formData = reactive({
  id: null,
  code: '',
  name: '',
  categoryId: '',
  spec: '',
  unit: '个',
  barcode: '',
  purchasePrice: 0,
  salePrice: 0,
  memberPrice: 0,
  stockWarning: 10,
  image: '',
  remark: '',
  status: '1'
})

// 表单校验规则
const formRules = {
  code: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择商品分类', trigger: 'change' }],
  unit: [{ required: true, message: '请选择单位', trigger: 'change' }]
}

// 选中的数据
const selectedRows = ref([])

// 搜索
const handleSearch = () => {
  ElMessage.success('查询成功')
  // 这里可以实现实际的搜索逻辑
}

// 重置
const handleReset = () => {
  searchForm.code = ''
  searchForm.name = ''
  searchForm.category = ''
  searchForm.status = ''
  handleSearch()
}

// 新增
const handleAdd = () => {
  dialogType.value = 'add'
  resetForm()
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row) => {
  dialogType.value = 'edit'
  Object.assign(formData, row)
  dialogVisible.value = true
}

// 查看
const handleView = (row) => {
  ElMessage.info(`查看商品：${row.name}`)
}

// 删除
const handleDelete = (row) => {
  ElMessageBox.confirm(
    `确定要删除商品「${row.name}」吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const index = tableData.value.findIndex(item => item.id === row.id)
    if (index > -1) {
      tableData.value.splice(index, 1)
      pageParams.total--
      ElMessage.success('删除成功')
    }
  }).catch(() => {
    // 取消删除
  })
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate((valid) => {
    if (valid) {
      if (dialogType.value === 'add') {
        // 新增
        const newId = Math.max(...tableData.value.map(item => item.id)) + 1
        const categoryName = categoryOptions.find(item => item.value === formData.categoryId)?.label || ''
        tableData.value.push({
          ...formData,
          id: newId,
          categoryName,
          stock: 0
        })
        pageParams.total++
        ElMessage.success('新增成功')
      } else {
        // 编辑
        const index = tableData.value.findIndex(item => item.id === formData.id)
        if (index > -1) {
          const categoryName = categoryOptions.find(item => item.value === formData.categoryId)?.label || ''
          tableData.value[index] = {
            ...tableData.value[index],
            ...formData,
            categoryName
          }
          ElMessage.success('修改成功')
        }
      }
      dialogVisible.value = false
    }
  })
}

// 重置表单
const resetForm = () => {
  formData.id = null
  formData.code = ''
  formData.name = ''
  formData.categoryId = ''
  formData.spec = ''
  formData.unit = '个'
  formData.barcode = ''
  formData.purchasePrice = 0
  formData.salePrice = 0
  formData.memberPrice = 0
  formData.stockWarning = 10
  formData.image = ''
  formData.remark = ''
  formData.status = '1'
}

// 图片上传
const handleImageChange = (file) => {
  // 模拟图片上传
  const reader = new FileReader()
  reader.onload = (e) => {
    formData.image = e.target.result
  }
  reader.readAsDataURL(file.raw)
}

// 表格选择
const handleSelectionChange = (selection) => {
  selectedRows.value = selection
}

// 分页大小变化
const handleSizeChange = (size) => {
  pageParams.pageSize = size
  handleSearch()
}

// 页码变化
const handleCurrentChange = (page) => {
  pageParams.page = page
  handleSearch()
}

onMounted(() => {
  handleSearch()
})
</script>

<style scoped lang="scss">
.products-page {
  padding: 20px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
    }
  }

  .search-card {
    margin-bottom: 20px;
  }

  .table-card {
    .pagination-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
  }

  .avatar-uploader {
    :deep(.el-upload) {
      border: 1px dashed var(--el-border-color);
      border-radius: 6px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: var(--el-transition-duration-fast);

      &:hover {
        border-color: var(--el-color-primary);
      }
    }

    .avatar-uploader-icon {
      font-size: 28px;
      color: #8c939d;
      width: 100px;
      height: 100px;
      text-align: center;
      line-height: 100px;
    }

    .avatar {
      width: 100px;
      height: 100px;
      display: block;
      object-fit: cover;
    }
  }
}
</style>
