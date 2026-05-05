<template>
  <div class="units-page">
    <div class="page-header">
      <h2>计量单位</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增单位
      </el-button>
    </div>

    <!-- 数据表格 -->
    <el-card class="table-card" shadow="never">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
      >
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column prop="name" label="单位名称" min-width="150" />
        <el-table-column prop="code" label="单位编码" width="120" />
        <el-table-column prop="category" label="类别" width="120">
          <template #default="{ row }">
            <el-tag :type="row.category === '重量' ? 'success' : row.category === '体积' ? 'warning' : 'info'">
              {{ row.category }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="conversionRate" label="换算率" width="120" align="right">
          <template #default="{ row }">
            {{ row.conversionRate }} {{ row.baseUnit }}
          </template>
        </el-table-column>
        <el-table-column prop="isBase" label="基本单位" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isBase" type="success">是</el-tag>
            <span v-else>-</span>
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
      :title="dialogType === 'add' ? '新增计量单位' : '编辑计量单位'"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="单位名称" prop="name">
          <el-input v-model="formData.name" placeholder="如：个、件、箱、kg" />
        </el-form-item>
        <el-form-item label="单位编码" prop="code">
          <el-input v-model="formData.code" placeholder="如：PC、BOX、KG" />
        </el-form-item>
        <el-form-item label="类别" prop="category">
          <el-select v-model="formData.category" placeholder="请选择类别" style="width: 100%">
            <el-option label="数量" value="数量" />
            <el-option label="重量" value="重量" />
            <el-option label="体积" value="体积" />
            <el-option label="长度" value="长度" />
          </el-select>
        </el-form-item>
        <el-form-item label="基本单位">
          <el-radio-group v-model="formData.isBase">
            <el-radio :label="true">是</el-radio>
            <el-radio :label="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!formData.isBase" label="换算率" prop="conversionRate">
          <el-input-number v-model="formData.conversionRate" :min="0.001" :precision="3" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="!formData.isBase" label="基本单位" prop="baseUnit">
          <el-select v-model="formData.baseUnit" placeholder="请选择基本单位" style="width: 100%">
            <el-option
              v-for="unit in baseUnits"
              :key="unit.code"
              :label="unit.name"
              :value="unit.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注" />
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

// 表单数据
const formData = reactive({
  id: null,
  name: '',
  code: '',
  category: '数量',
  isBase: true,
  conversionRate: 1,
  baseUnit: '',
  remark: '',
  status: '1'
})

// 表单校验规则
const formRules = {
  name: [{ required: true, message: '请输入单位名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入单位编码', trigger: 'blur' }],
  category: [{ required: true, message: '请选择类别', trigger: 'change' }]
}

// 表格数据
const tableData = ref([
  { id: 1, name: '个', code: 'PC', category: '数量', isBase: true, conversionRate: 1, baseUnit: '', status: '1', remark: '基本单位' },
  { id: 2, name: '件', code: 'ITEM', category: '数量', isBase: false, conversionRate: 1, baseUnit: '个', status: '1', remark: '' },
  { id: 3, name: '箱', code: 'BOX', category: '数量', isBase: false, conversionRate: 12, baseUnit: '个', status: '1', remark: '1箱=12个' },
  { id: 4, name: 'kg', code: 'KG', category: '重量', isBase: true, conversionRate: 1, baseUnit: '', status: '1', remark: '千克' },
  { id: 5, name: 'g', code: 'G', category: '重量', isBase: false, conversionRate: 0.001, baseUnit: 'kg', status: '1', remark: '克' },
  { id: 6, name: 'L', code: 'L', category: '体积', isBase: true, conversionRate: 1, baseUnit: '', status: '1', remark: '升' },
  { id: 7, name: 'ml', code: 'ML', category: '体积', isBase: false, conversionRate: 0.001, baseUnit: 'L', status: '1', remark: '毫升' }
])

// 计算基本单位列表
const baseUnits = computed(() => {
  return tableData.value.filter(item => item.isBase)
})

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
    `确定要删除单位「${row.name}」吗？`,
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
      ElMessage.success('删除成功')
    }
  })
}

// 状态变更
const handleStatusChange = (row, val) => {
  const statusText = val === '1' ? '启用' : '禁用'
  ElMessage.success(`${row.name} 已${statusText}`)
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate((valid) => {
    if (valid) {
      if (dialogType.value === 'add') {
        const newId = Math.max(...tableData.value.map(item => item.id), 0) + 1
        tableData.value.push({
          ...formData,
          id: newId
        })
        ElMessage.success('新增成功')
      } else {
        const index = tableData.value.findIndex(item => item.id === formData.id)
        if (index > -1) {
          tableData.value[index] = { ...tableData.value[index], ...formData }
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
  formData.category = '数量'
  formData.isBase = true
  formData.conversionRate = 1
  formData.baseUnit = ''
  formData.remark = ''
  formData.status = '1'
}
</script>

<style scoped lang="scss">
.units-page {
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

  .table-card {
    .el-table {
      margin-top: 10px;
    }
  }
}
</style>
