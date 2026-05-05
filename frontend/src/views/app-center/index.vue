<template>
  <div class="app-center-page">
    <div class="page-header">
      <h2>应用中心</h2>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索应用"
        prefix-icon="Search"
        clearable
        class="search-input"
      />
    </div>

    <!-- 应用分类标签 -->
    <div class="category-tabs">
      <el-radio-group v-model="currentCategory" size="large">
        <el-radio-button label="all">全部应用</el-radio-button>
        <el-radio-button label="installed">已安装</el-radio-button>
        <el-radio-button label="retail">零售</el-radio-button>
        <el-radio-button label="finance">财务</el-radio-button>
        <el-radio-button label="inventory">库存</el-radio-button>
        <el-radio-button label="marketing">营销</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 应用列表 -->
    <div class="app-list">
      <el-row :gutter="20">
        <el-col 
          v-for="app in filteredApps" 
          :key="app.id" 
          :xs="24" 
          :sm="12" 
          :md="8" 
          :lg="6"
        >
          <div class="app-card" :class="{ installed: app.installed }">
            <div class="app-header">
              <div class="app-icon" :style="{ backgroundColor: app.iconBg }">
                <el-icon :size="32" color="#fff">
                  <component :is="app.icon" />
                </el-icon>
              </div>
              <div class="app-info">
                <h4 class="app-name">{{ app.name }}</h4>
                <el-tag v-if="app.installed" type="success" size="small">已安装</el-tag>
                <el-tag v-else type="info" size="small">未安装</el-tag>
              </div>
            </div>
            <p class="app-desc">{{ app.description }}</p>
            <div class="app-footer">
              <span class="app-category">{{ app.categoryName }}</span>
              <el-button 
                :type="app.installed ? 'default' : 'primary'"
                size="small"
                @click="handleInstall(app)"
              >
                {{ app.installed ? '卸载' : '安装' }}
              </el-button>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 安装确认弹窗 -->
    <el-dialog
      v-model="installDialogVisible"
      title="安装应用"
      width="500px"
    >
      <div class="install-dialog-content">
        <div class="app-preview">
          <div class="app-icon-large" :style="{ backgroundColor: currentApp?.iconBg }">
            <el-icon :size="48" color="#fff">
              <component :is="currentApp?.icon" v-if="currentApp" />
            </el-icon>
          </div>
          <h3>{{ currentApp?.name }}</h3>
          <p>{{ currentApp?.description }}</p>
        </div>
        <el-divider />
        <div class="install-info">
          <h4>应用权限</h4>
          <ul>
            <li>访问商品数据</li>
            <li>访问订单数据</li>
            <li>访问客户数据</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button @click="installDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmInstall">确认安装</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  ShoppingCart, 
  Money, 
  Box, 
  TrendCharts, 
  User, 
  Setting,
  Document,
  Calendar
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const searchKeyword = ref('')
const currentCategory = ref('all')
const installDialogVisible = ref(false)
const currentApp = ref(null)

// 应用列表
const appList = ref([
  {
    id: 1,
    name: '智能补货',
    icon: 'Box',
    iconBg: '#5470c6',
    category: 'inventory',
    categoryName: '库存',
    description: '基于销售数据智能预测补货需求，自动生成采购建议',
    installed: true
  },
  {
    id: 2,
    name: '会员营销',
    icon: 'User',
    iconBg: '#91cc75',
    category: 'marketing',
    categoryName: '营销',
    description: '精准会员营销工具，支持短信、微信多渠道触达',
    installed: true
  },
  {
    id: 3,
    name: '财务报表',
    icon: 'Money',
    iconBg: '#fac858',
    category: 'finance',
    categoryName: '财务',
    description: '自动生成资产负债表、利润表、现金流量表',
    installed: false
  },
  {
    id: 4,
    name: '销售分析',
    icon: 'TrendCharts',
    iconBg: '#ee6666',
    category: 'retail',
    categoryName: '零售',
    description: '多维度销售数据分析，助力经营决策',
    installed: true
  },
  {
    id: 5,
    name: '门店管理',
    icon: 'ShoppingCart',
    iconBg: '#73c0de',
    category: 'retail',
    categoryName: '零售',
    description: '多门店统一管理，实时掌握各门店经营状况',
    installed: true
  },
  {
    id: 6,
    name: '审批流程',
    icon: 'Document',
    iconBg: '#3ba272',
    category: 'finance',
    categoryName: '财务',
    description: '自定义审批流程，提升企业运营效率',
    installed: false
  },
  {
    id: 7,
    name: '预约管理',
    icon: 'Calendar',
    iconBg: '#fc8452',
    category: 'retail',
    categoryName: '零售',
    description: '商品预订、寄存管理，提升客户体验',
    installed: false
  },
  {
    id: 8,
    name: '系统设置',
    icon: 'Setting',
    iconBg: '#9a60b4',
    category: 'inventory',
    categoryName: '库存',
    description: '系统参数配置，个性化定制您的ERP',
    installed: true
  }
])

// 过滤后的应用列表
const filteredApps = computed(() => {
  let result = appList.value
  
  // 按分类筛选
  if (currentCategory.value === 'installed') {
    result = result.filter(app => app.installed)
  } else if (currentCategory.value !== 'all') {
    result = result.filter(app => app.category === currentCategory.value)
  }
  
  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(app => 
      app.name.toLowerCase().includes(keyword) ||
      app.description.toLowerCase().includes(keyword)
    )
  }
  
  return result
})

// 安装/卸载应用
const handleInstall = (app) => {
  if (app.installed) {
    // 卸载
    app.installed = false
    ElMessage.success(`${app.name} 已卸载`)
  } else {
    // 显示安装确认
    currentApp.value = app
    installDialogVisible.value = true
  }
}

// 确认安装
const confirmInstall = () => {
  if (currentApp.value) {
    currentApp.value.installed = true
    installDialogVisible.value = false
    ElMessage.success(`${currentApp.value.name} 安装成功`)
  }
}
</script>

<style scoped lang="scss">
.app-center-page {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
    }

    .search-input {
      width: 300px;
    }
  }

  .category-tabs {
    margin-bottom: 24px;
  }

  .app-list {
    .app-card {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      }

      &.installed {
        border: 1px solid #e6f7ff;
        background: linear-gradient(135deg, #fff 0%, #f0f9ff 100%);
      }

      .app-header {
        display: flex;
        align-items: flex-start;
        margin-bottom: 12px;

        .app-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .app-info {
          flex: 1;

          .app-name {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin: 0 0 8px 0;
          }
        }
      }

      .app-desc {
        font-size: 13px;
        color: #666;
        line-height: 1.6;
        margin-bottom: 16px;
        min-height: 40px;
      }

      .app-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .app-category {
          font-size: 12px;
          color: #999;
        }
      }
    }
  }
}

// 安装弹窗样式
.install-dialog-content {
  .app-preview {
    text-align: center;
    padding: 20px 0;

    .app-icon-large {
      width: 80px;
      height: 80px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    p {
      font-size: 14px;
      color: #666;
    }
  }

  .install-info {
    h4 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    ul {
      margin: 0;
      padding-left: 20px;

      li {
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
      }
    }
  }
}
</style>
