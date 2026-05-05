<template>
  <div class="brands-page">
    <div class="page-header">
      <h2>商品品牌</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增品牌
      </el-button>
    </div>

    <!-- 搜索区域 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="品牌名称">
          <el-input v-model="searchForm.name" placeholder="请输入品牌名称" clearable />
        </el-form-item>
        <el-form-item label="品牌状态">
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

    <!-- 品牌列表 -->
    <el-card class="table-card" shadow="never">
      <el-table :data="filteredBrands" stripe border v-loading="loading">
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column label="品牌LOGO" width="120" align="center">
          <template #default="{ row }">
            <div class="brand-logo" :style="{ backgroundColor: row.logo || '#ff6b35' }">
              <span class="logo-text">{{ row.name?.charAt(0) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="品牌名称" min-width="150" />
        <el-table-column prop="code" label="品牌编码" width="120" />
        <el-table-column prop="description" label="品牌描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="productCount" label="关联商品" width="100" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewProducts(row)">
              {{ row.productCount || 0 }} 个
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              active-value="1"
              inactive-value="0"
              @change="(val) => handleStatusChange(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增品牌' : '编辑品牌'"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="品牌名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入品牌名称" />
        </el-form-item>
        <el-form-item label="品牌编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入品牌编码" />
        </el-form-item>
        <el-form-item label="品牌LOGO">
          <el-upload
            class="logo-uploader"
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleLogoChange"
          >
            <div v-if="formData.logo" class="logo-preview" :style="{ backgroundColor: formData.logo }">
              <span class="logo-text">{{ formData.name?.charAt(0) || '品' }}</span>
            </div>
            <div v-else class="upload-placeholder">
              <el-icon :size="28"><Plus /></el-icon>
              <span>上传LOGO</span>
            </div>
          </el-upload>
        </el-form-item>
        <el-form-item label="品牌描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入品牌描述"
          />
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
import { ref, reactive, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const dialogVisible = ref(false)
const dialogType = ref('add')
const formRef = ref(null)

// 搜索表单
const searchForm = reactive({
  name: '',
  status: ''
})

// 表单数据
const formData = reactive({
  id: null,
  name: '',
  code: '',
  logo: '',
  description: '',
  status: '1'
})

// 表单校验规则
const formRules = {
  name: [{ required: true, message: '请输入品牌名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入品牌编码', trigger: 'blur' }]
}

// 品牌列表
const brandList = ref([
  { id: 1, name: '法国总统', code: 'PRÉSIDENT', logo: '#ff6b35', description: '法国知名乳制品品牌', productCount: 12, status: '1' },
  { id: 2, name: '安佳', code: 'ANCHOR', logo: '#5470c6', description: '新西兰恒天然集团旗下品牌', productCount: 8, status: '1' },
  { id: 3, name: '铁塔', code: 'ELLE&VIRE', logo: '#91cc75', description: '法国专业奶油品牌', productCount: 6, status: '1' },
  { id: 4, name: '雀巢', code: 'NESTLE', logo: '#fac858', description: '全球知名食品品牌', productCount: 15, status: '1' },
  { id: 5, name: '蓝风车', code: 'BLUEWIND', logo: '#73c0de', description: '英国传统奶油品牌', productCount: 4, status: '0' }
])

// 过滤后的品牌列表
const filteredBrands = computed(() => {
  let result = brandList.value
  if (searchForm.name) {
    result = result.filter(item => item.name.includes(searchForm.name))
  }
  if (searchForm.status) {
    result = result.filter(item => item.status === searchForm.status)
  }
  return result
})

// 搜索
const handleSearch = () => {
  ElMessage.success('查询成功')
}

// 重置
const handleReset = () => {
  searchForm.name = ''
  searchForm.status = ''
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

// 删除
const handleDelete = (row) => {
  ElMessageBox.confirm(
    `确定要删除品牌「${row.name}」吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const index = brandList.value.findIndex(item => item.id === row.id)
    if (index > -1) {
      brandList.value.splice(index, 1)
      ElMessage.success('删除成功')
    }
  })
}

// 状态变更
const handleStatusChange = (row, val) => {
  const statusText = val === '1' ? '启用' : '禁用'
  ElMessage.success(`${row.name} 已${statusText}`)
}

// 查看关联商品
const viewProducts = (row) => {
  ElMessage.info(`${row.name} 关联 ${row.productCount} 个商品`)
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate((valid) => {
    if (valid) {
      if (dialogType.value === 'add') {
        const newId = Math.max(...brandList.value.map(item => item.id), 0) + 1
        const colors = ['#ff6b35', '#5470c6', '#91cc75', '#fac858', '#73c0de', '#ee6666']
        const randomColor = colors[Math.floor(Math.random() * colors.length)]
        
        brandList.value.push({
          ...formData,
          id: newId,
          logo: formData.logo || randomColor,
          productCount: 0
        })
        ElMessage.success('新增成功')
      } else {
        const index = brandList.value.findIndex(item => item.id === formData.id)
        if (index > -1) {
          brandList.value[index] = { ...brandList.value[index], ...formData }
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
  formData.name = ''
  formData.code = ''
  formData.logo = ''
  formData.description = ''
  formData.status = '1'
}

// LOGO上传
const handleLogoChange = (file) => {
  const colors = ['#ff6b35', '#5470c6', '#91cc75', '#fac858', '#73c0de', '#ee6666']
  const randomColor = colors[Math.floor(Math.random() * colors.length)]
  formData.logo = randomColor
}
</script>

<style scoped lang="scss">
.brands-page {
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
    .brand-logo {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;

      .logo-text {
        font-size: 20px;
        font-weight: 600;
        color: #fff;
      }
    }
  }
}

.logo-uploader {
  :deep(.el-upload) {
    border: 1px dashed #d9d9d9;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: var(--el-transition-duration-fast);

    &:hover {
      border-color: var(--el-color-primary);
    }
  }

  .logo-preview {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    .logo-text {
      font-size: 32px;
      font-weight: 600;
      color: #fff;
    }
  }

  .upload-placeholder {
    width: 100px;
    height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #8c939d;

    span {
      margin-top: 8px;
      font-size: 12px;
    }
  }
}
</style>
