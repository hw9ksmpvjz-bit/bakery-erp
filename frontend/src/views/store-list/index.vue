<template>
  <div class="store-list-page">
    <!-- 顶部工具栏 -->
    <div class="page-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索编码/名称"
          prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-dropdown trigger="click" class="filter-dropdown">
          <el-button>
            常用条件过滤<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>全部门店</el-dropdown-item>
              <el-dropdown-item>已启用</el-dropdown-item>
              <el-dropdown-item>已禁用</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="showAdvancedFilter = true">
          <el-icon><Filter /></el-icon>展开过滤
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-dropdown trigger="click" class="action-dropdown">
          <el-button type="success">
            <el-icon><Plus /></el-icon>新增<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleAdd">新增门店</el-dropdown-item>
              <el-dropdown-item>新增组别</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown trigger="click" class="action-dropdown">
          <el-button>
            引出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>按列表引出</el-dropdown-item>
              <el-dropdown-item>按模板引出</el-dropdown-item>
              <el-dropdown-item>引出结果查询</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="handleRefresh">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <!-- 主体内容区 -->
    <div class="main-content">
      <!-- 左侧门店组别树 -->
      <div class="left-sidebar">
        <div class="sidebar-header">
          <span>门店组别</span>
          <el-button link type="primary" size="small">编辑</el-button>
        </div>
        <el-input
          v-model="groupFilter"
          placeholder="查找..."
          prefix-icon="Search"
          clearable
          size="small"
          class="group-search"
        />
        <div class="group-list">
          <div class="group-item active">全部</div>
          <div class="group-item">旗舰店</div>
          <div class="group-item">直营店</div>
          <div class="group-item">加盟店</div>
        </div>
      </div>

      <!-- 右侧表格区 -->
      <div class="right-content">
        <!-- 批量操作栏 -->
        <div class="batch-toolbar">
          <span class="batch-info">已选中 {{ selectedCount }} 条</span>
          <el-button type="primary" :disabled="!selectedCount" @click="handleBatchEnable">
            <el-icon><VideoPlay /></el-icon>启用
          </el-button>
          <el-button type="danger" :disabled="!selectedCount" @click="handleBatchDisable">
            <el-icon><CircleClose /></el-icon>禁用
          </el-button>
          <el-button type="danger" :disabled="!selectedCount" @click="handleBatchDelete">
            <el-icon><Delete /></el-icon>删除
          </el-button>
          <el-button :disabled="!selectedCount" @click="handleBatchCopy">
            <el-icon><DocumentCopy /></el-icon>复制
          </el-button>
          <el-dropdown trigger="click" :disabled="!selectedCount">
            <el-button>
              更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>批量修改</el-dropdown-item>
                <el-dropdown-item>导出选中</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <div class="pagination-info">
            <el-icon><ArrowLeft /></el-icon>
            <span>1/0</span>
            <el-icon><ArrowRight /></el-icon>
            <el-icon><DArrowRight /></el-icon>
          </div>
        </div>

        <!-- 数据表格 -->
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="tableData"
          stripe
          border
          @selection-change="handleSelectionChange"
          class="store-table"
        >
          <el-table-column type="selection" width="40" align="center" />
          <el-table-column prop="status" label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === '1' ? 'success' : 'danger'" size="small">
                {{ row.status === '1' ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="门店编码" width="120" />
          <el-table-column prop="name" label="门店名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="group" label="门店组别" width="100" />
          <el-table-column prop="warehouse" label="对应仓库" width="120" />
          <el-table-column prop="contact" label="联系人" width="100" />
          <el-table-column prop="customer" label="关联客户" width="120" />
          <el-table-column prop="department" label="所属部门" width="100" />
          <el-table-column prop="type" label="门店类型" width="100" />
          <el-table-column prop="businessMode" label="经营方式" width="100" />
          <el-table-column prop="memberGroup" label="会员共享组" width="120" />
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column prop="tags" label="标签" width="100" />
        </el-table>

        <!-- 底部工具栏 -->
        <div class="bottom-toolbar">
          <el-checkbox v-model="includeSub" size="small">包含下级</el-checkbox>
          <div class="pagination-wrapper">
            <span>共1页</span>
            <span>第</span>
            <el-input-number v-model="currentPage" :min="1" :max="1" size="small" class="page-input" />
            <span>页</span>
            <el-button-group>
              <el-button size="small" :icon="DArrowLeft" />
              <el-button size="small" :icon="ArrowLeft" />
              <el-button size="small" :icon="ArrowRight" />
              <el-button size="small" :icon="DArrowRight" />
            </el-button-group>
            <el-select v-model="pageSize" size="small" class="page-size-select">
              <el-option label="10条/页" :value="10" />
              <el-option label="20条/页" :value="20" />
              <el-option label="50条/页" :value="50" />
              <el-option label="100条/页" :value="100" />
            </el-select>
          </div>
          <el-button circle size="small" @click="showColumnSetting = true">
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 新增/编辑门店弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="门店"
      width="900px"
      destroy-on-close
    >
      <el-form :model="formData" label-width="100px">
        <!-- 基本信息 -->
        <el-collapse v-model="activeCollapse">
          <el-collapse-item title="基本信息" name="basic">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="门店编码" required>
                  <el-input v-model="formData.code" placeholder="MD00001" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="门店名称" required>
                  <el-input v-model="formData.name" placeholder="请输入门店名称">
                    <template #suffix>
                      <el-icon><MapLocation /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="门店组别" required>
                  <el-select v-model="formData.group" placeholder="请选择" style="width: 100%">
                    <el-option label="旗舰店" value="flagship" />
                    <el-option label="直营店" value="direct" />
                    <el-option label="加盟店" value="franchise" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="经营方式" required>
                  <el-select v-model="formData.businessMode" placeholder="请选择" style="width: 100%">
                    <el-option label="自营" value="self" />
                    <el-option label="加盟" value="franchise" />
                    <el-option label="联营" value="joint" />
                  </el-select>
                  <el-tooltip content="经营方式说明">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="对应仓库" required>
                  <el-select v-model="formData.warehouse" placeholder="请选择" style="width: 100%">
                    <el-option label="总仓库" value="main" />
                    <el-option label="分仓库" value="branch" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="所属部门">
                  <el-select v-model="formData.department" placeholder="请选择" style="width: 100%">
                    <el-option label="销售部" value="sales" />
                    <el-option label="运营部" value="operation" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="联系人" required>
                  <el-input v-model="formData.contact" placeholder="请输入联系人" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="手机号码" required>
                  <el-input v-model="formData.phone" placeholder="请输入手机号码" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="门店标签">
                  <el-input v-model="formData.tags" placeholder="请输入标签" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="建筑面积">
                  <el-input v-model="formData.buildArea" placeholder="平方米">
                    <template #append>m²</template>
                  </el-input>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="经营面积">
                  <el-input v-model="formData.businessArea" placeholder="平方米">
                    <template #append>m²</template>
                  </el-input>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="租金">
                  <el-input-number v-model="formData.rent" :min="0" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="备注">
              <el-input
                v-model="formData.remark"
                type="textarea"
                :rows="2"
                placeholder="请输入备注"
              />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>

        <!-- 地址信息 -->
        <div class="address-section">
          <h4>地址信息</h4>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="行政区划" required>
                <div class="region-select">
                  <el-select v-model="formData.country" style="width: 80px">
                    <el-option label="中国" value="CN" />
                  </el-select>
                  <el-cascader
                    v-model="formData.region"
                    :options="regionOptions"
                    placeholder="请选择省市区"
                    style="flex: 1; margin-left: 8px"
                  />
                </div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="详细地址" required>
                <el-input v-model="formData.address" placeholder="请输入详细地址">
                  <template #suffix>
                    <el-icon><MapLocation /></el-icon>
                  </template>
                </el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="经度" required>
                <el-input v-model="formData.longitude" placeholder="请输入经度" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="纬度" required>
                <el-input v-model="formData.latitude" placeholder="请输入纬度" />
              </el-form-item>
            </el-col>
          </el-row>
          <div class="map-hint">
            <el-icon color="#ff6b35"><Warning /></el-icon>
            <span>请务必通过地图搜索定位您的门店地址获取经纬度，以免影响您的在线支付交易</span>
          </div>
          <div class="map-search">
            <span class="label">加载地图中</span>
            <el-input placeholder="搜索分公司, 办事处, 总办" class="map-input">
              <template #append>
                <el-button type="primary"><el-icon><Search /></el-icon></el-button>
              </template>
            </el-input>
          </div>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="handleSave">保存</el-button>
          <el-button @click="handleSaveAndNew">保存并新增</el-button>
          <el-button @click="dialogVisible = false">取消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 列设置弹窗 -->
    <el-dialog
      v-model="showColumnSetting"
      title="列表控制"
      width="700px"
    >
      <el-tabs v-model="settingTab">
        <el-tab-pane label="表格设置" name="table">
          <div class="column-setting-actions">
            <el-button link type="primary">恢复默认</el-button>
            <el-button link type="primary">全部显示</el-button>
            <el-button link type="primary">全部冻结</el-button>
            <el-button link type="primary">全部解冻</el-button>
            <el-button link type="primary">移到</el-button>
            <el-button link type="primary">上移</el-button>
            <el-button link type="primary">下移</el-button>
          </div>
          <el-table :data="columnSettings" size="small" border>
            <el-table-column type="selection" width="40" />
            <el-table-column prop="index" label="序号" width="60" />
            <el-table-column prop="name" label="列名" />
            <el-table-column prop="align" label="对齐方式" width="100" />
            <el-table-column label="显示列" width="80" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.show" />
              </template>
            </el-table-column>
            <el-table-column label="列冻结" width="80" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.freeze" />
              </template>
            </el-table-column>
            <el-table-column label="是否表头" width="80" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.isHeader" />
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="选项" name="options">
          <div class="option-item">
            <span>数值列尾零显示</span>
            <el-switch v-model="showZero" />
          </div>
          <div class="option-item">
            <span>同一单据拆分显示</span>
            <el-tooltip content="说明">
              <el-icon><QuestionFilled /></el-icon>
            </el-tooltip>
            <el-switch v-model="splitDisplay" />
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button type="primary" @click="showColumnSetting = false">确定</el-button>
        <el-button @click="showColumnSetting = false">取消</el-button>
      </template>
    </el-dialog>

    <!-- 展开过滤抽屉 -->
    <el-drawer
      v-model="showAdvancedFilter"
      title="展开过滤"
      size="500px"
    >
      <el-form :model="filterForm" label-width="100px">
        <el-form-item label="方案名称">
          <el-input v-model="filterForm.schemeName" placeholder="请输入方案名称" />
        </el-form-item>
        <el-divider />
        <div class="filter-conditions">
          <el-button link type="primary" @click="addCondition">
            <el-icon><Plus /></el-icon>添加条件
          </el-button>
        </div>
      </el-form>
      <template #footer>
        <div style="flex: auto">
          <el-button @click="showAdvancedFilter = false">取消</el-button>
          <el-button type="primary" @click="handleFilter">查询</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import {
  Search, ArrowDown, Plus, Filter, Refresh, VideoPlay,
  CircleClose, Delete, DocumentCopy, ArrowLeft, ArrowRight,
  DArrowLeft, DArrowRight, Setting, MapLocation, QuestionFilled,
  Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 搜索表单
const searchForm = reactive({
  keyword: ''
})

// 左侧组别筛选
const groupFilter = ref('')

// 分页相关
const currentPage = ref(1)
const pageSize = ref(20)
const includeSub = ref(true)

// 加载状态
const loading = ref(false)

// 选中数量
const selectedCount = ref(0)

// 表格数据
const tableData = ref([
  {
    id: 1,
    status: '1',
    code: 'MD00001',
    name: '旗舰店',
    group: '旗舰店',
    warehouse: '总仓库',
    contact: '张三',
    customer: '零售客户',
    department: '销售部',
    type: '直营',
    businessMode: '自营',
    memberGroup: '默认组',
    remark: '主要门店',
    tags: '重要'
  },
  {
    id: 2,
    status: '1',
    code: 'MD00002',
    name: '东区店',
    group: '直营店',
    warehouse: '分仓库',
    contact: '李四',
    customer: '零售客户',
    department: '销售部',
    type: '直营',
    businessMode: '自营',
    memberGroup: '默认组',
    remark: '',
    tags: ''
  }
])

// 弹窗控制
const dialogVisible = ref(false)
const showColumnSetting = ref(false)
const showAdvancedFilter = ref(false)
const settingTab = ref('table')
const activeCollapse = ref(['basic'])

// 表单数据
const formData = reactive({
  code: 'MD00001',
  name: '',
  group: '',
  businessMode: 'self',
  warehouse: '',
  department: '',
  contact: '',
  phone: '',
  tags: '',
  buildArea: '',
  businessArea: '',
  rent: 0,
  remark: '',
  country: 'CN',
  region: [],
  address: '',
  longitude: '',
  latitude: ''
})

// 地区选项
const regionOptions = [
  {
    value: 'guangdong',
    label: '广东省',
    children: [
      {
        value: 'guangzhou',
        label: '广州市',
        children: [
          { value: 'tianhe', label: '天河区' },
          { value: 'yuexiu', label: '越秀区' }
        ]
      },
      {
        value: 'shenzhen',
        label: '深圳市',
        children: [
          { value: 'nanshan', label: '南山区' },
          { value: 'futian', label: '福田区' }
        ]
      }
    ]
  }
]

// 列设置数据
const columnSettings = ref([
  { index: 1, name: '状态', align: '居中', show: true, freeze: false, isHeader: true },
  { index: 2, name: '门店编码', align: '默认', show: true, freeze: false, isHeader: true },
  { index: 3, name: '门店名称', align: '默认', show: true, freeze: false, isHeader: true },
  { index: 4, name: '门店组别', align: '默认', show: true, freeze: false, isHeader: true },
  { index: 5, name: '对应仓库', align: '默认', show: true, freeze: false, isHeader: true },
  { index: 6, name: '联系人', align: '默认', show: true, freeze: false, isHeader: true },
  { index: 7, name: '关联客户', align: '默认', show: true, freeze: false, isHeader: true },
  { index: 8, name: '所属部门', align: '默认', show: true, freeze: false, isHeader: true },
  { index: 9, name: '门店类型', align: '默认', show: true, freeze: false, isHeader: true },
  { index: 10, name: '经营方式', align: '默认', show: true, freeze: false, isHeader: true }
])

// 选项设置
const showZero = ref(true)
const splitDisplay = ref(false)

// 过滤表单
const filterForm = reactive({
  schemeName: ''
})

// 表格选择变化
const handleSelectionChange = (selection) => {
  selectedCount.value = selection.length
}

// 新增门店
const handleAdd = () => {
  dialogVisible.value = true
}

// 刷新
const handleRefresh = () => {
  ElMessage.success('刷新成功')
}

// 批量启用
const handleBatchEnable = () => {
  ElMessage.success(`已启用 ${selectedCount.value} 个门店`)
}

// 批量禁用
const handleBatchDisable = () => {
  ElMessage.success(`已禁用 ${selectedCount.value} 个门店`)
}

// 批量删除
const handleBatchDelete = () => {
  ElMessageBox.confirm(
    `确定要删除选中的 ${selectedCount.value} 个门店吗？`,
    '提示',
    { type: 'warning' }
  ).then(() => {
    ElMessage.success('删除成功')
  })
}

// 批量复制
const handleBatchCopy = () => {
  ElMessage.success(`已复制 ${selectedCount.value} 个门店`)
}

// 保存
const handleSave = () => {
  ElMessage.success('保存成功')
  dialogVisible.value = false
}

// 保存并新增
const handleSaveAndNew = () => {
  ElMessage.success('保存成功')
  // 重置表单
  formData.name = ''
  formData.contact = ''
  formData.phone = ''
}

// 添加过滤条件
const addCondition = () => {
  ElMessage.info('添加条件')
}

// 查询
const handleFilter = () => {
  showAdvancedFilter.value = false
  ElMessage.success('查询成功')
}
</script>

<style scoped lang="scss">
.store-list-page {
  padding: 16px;
  background: #f5f7fa;
  min-height: 100vh;

  .page-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    background: #fff;
    padding: 12px 16px;
    border-radius: 4px;

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;

      .search-input {
        width: 240px;
      }
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .main-content {
    display: flex;
    background: #fff;
    border-radius: 4px;
    min-height: calc(100vh - 140px);

    .left-sidebar {
      width: 200px;
      border-right: 1px solid #e8e8e8;
      padding: 12px;

      .sidebar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-weight: 600;
      }

      .group-search {
        margin-bottom: 12px;
      }

      .group-list {
        .group-item {
          padding: 8px 12px;
          cursor: pointer;
          border-radius: 4px;
          margin-bottom: 4px;

          &:hover {
            background: #f5f7fa;
          }

          &.active {
            background: #e6f7ff;
            color: #1890ff;
          }
        }
      }
    }

    .right-content {
      flex: 1;
      padding: 12px;
      overflow: auto;

      .batch-toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding: 8px;
        background: #fafafa;
        border: 1px solid #e8e8e8;
        border-radius: 4px;

        .batch-info {
          color: #666;
          margin-right: 12px;
        }

        .pagination-info {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #666;
        }
      }

      .store-table {
        margin-bottom: 12px;
      }

      .bottom-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;

        .pagination-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;

          .page-input {
            width: 60px;
          }

          .page-size-select {
            width: 100px;
          }
        }
      }
    }
  }

  .address-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e8e8e8;

    h4 {
      margin-bottom: 16px;
      font-weight: 600;
    }

    .region-select {
      display: flex;
    }

    .map-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ff6b35;
      margin: 12px 0;
      font-size: 13px;
    }

    .map-search {
      display: flex;
      align-items: center;
      gap: 12px;

      .label {
        color: #666;
        font-size: 13px;
      }

      .map-input {
        flex: 1;
      }
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .column-setting-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .option-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .help-icon {
    margin-left: 4px;
    color: #999;
    cursor: pointer;
  }
}
</style>
