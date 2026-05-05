<template>
  <div class="quick-app-page">
    <!-- 我的收藏区域 -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">我的收藏</span>
        <el-button type="primary" link class="collect-btn" @click="showCollectDialog = true">
          收藏
        </el-button>
      </div>
      
      <!-- 空状态 -->
      <div v-if="!myFavorites.length" class="empty-state">
        你还没有添加收藏
      </div>
      
      <!-- 收藏列表 -->
      <div v-else class="app-grid">
        <div 
          v-for="item in myFavorites" 
          :key="item.id"
          class="app-card"
          @click="navigateTo(item.route)"
        >
          <div class="app-icon" :style="{ backgroundColor: item.iconBg }">
            <el-icon :size="24" color="#fff">
              <StarFilled v-if="item.icon === 'StarFilled'" />
              <DataAnalysis v-else-if="item.icon === 'DataAnalysis'" />
              <MapLocation v-else-if="item.icon === 'MapLocation'" />
              <UserFilled v-else-if="item.icon === 'UserFilled'" />
              <Lock v-else-if="item.icon === 'Lock'" />
              <ShoppingBag v-else-if="item.icon === 'ShoppingBag'" />
              <Document v-else-if="item.icon === 'Document'" />
              <HomeFilled v-else-if="item.icon === 'HomeFilled'" />
              <Goods v-else-if="item.icon === 'Goods'" />
              <ShoppingCart v-else-if="item.icon === 'ShoppingCart'" />
              <Box v-else-if="item.icon === 'Box'" />
              <Sell v-else-if="item.icon === 'Sell'" />
              <User v-else-if="item.icon === 'User'" />
              <Shop v-else-if="item.icon === 'Shop'" />
              <OfficeBuilding v-else-if="item.icon === 'OfficeBuilding'" />
              <Money v-else-if="item.icon === 'Money'" />
              <Setting v-else-if="item.icon === 'Setting'" />
              <TrendCharts v-else-if="item.icon === 'TrendCharts'" />
            </el-icon>
          </div>
          <span class="app-name">{{ item.name }}</span>
        </div>
      </div>
    </div>

    <!-- 增值服务区域 -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">增值服务</span>
      </div>
      <div class="app-grid">
        <div 
          v-for="item in valueAddedServices" 
          :key="item.id"
          class="app-card"
          @click="navigateTo(item.route)"
        >
          <div class="app-icon" :style="{ backgroundColor: item.iconBg }">
            <el-icon :size="24" color="#fff">
              <DataAnalysis v-if="item.icon === 'DataAnalysis'" />
              <MapLocation v-else-if="item.icon === 'MapLocation'" />
              <UserFilled v-else-if="item.icon === 'UserFilled'" />
              <Lock v-else-if="item.icon === 'Lock'" />
            </el-icon>
          </div>
          <span class="app-name">{{ item.name }}</span>
        </div>
      </div>
    </div>

    <!-- 生态服务区域 -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">生态服务</span>
      </div>
      <div class="app-grid">
        <div 
          v-for="item in ecoServices" 
          :key="item.id"
          class="app-card"
          @click="navigateTo(item.route)"
        >
          <div class="app-icon" :style="{ backgroundColor: item.iconBg }">
            <el-icon :size="24" color="#fff">
              <ShoppingBag v-if="item.icon === 'ShoppingBag'" />
              <Document v-else-if="item.icon === 'Document'" />
            </el-icon>
          </div>
          <span class="app-name">{{ item.name }}</span>
        </div>
      </div>
    </div>

    <!-- 收藏对话框 -->
    <el-dialog
      v-model="showCollectDialog"
      title="添加收藏"
      width="600px"
      destroy-on-close
    >
      <div class="collect-dialog-content">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索功能"
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <div class="function-list">
          <div 
            v-for="func in filteredFunctions" 
            :key="func.id"
            class="function-item"
            :class="{ 'is-collected': isCollected(func.id) }"
            @click="toggleCollect(func)"
          >
            <div class="func-icon" :style="{ backgroundColor: func.iconBg }">
              <el-icon :size="18" color="#fff">
                <StarFilled v-if="func.icon === 'StarFilled'" />
                <DataAnalysis v-else-if="func.icon === 'DataAnalysis'" />
                <MapLocation v-else-if="func.icon === 'MapLocation'" />
                <UserFilled v-else-if="func.icon === 'UserFilled'" />
                <Lock v-else-if="func.icon === 'Lock'" />
                <ShoppingBag v-else-if="func.icon === 'ShoppingBag'" />
                <Document v-else-if="func.icon === 'Document'" />
                <HomeFilled v-else-if="func.icon === 'HomeFilled'" />
                <Goods v-else-if="func.icon === 'Goods'" />
                <ShoppingCart v-else-if="func.icon === 'ShoppingCart'" />
                <Box v-else-if="func.icon === 'Box'" />
                <Sell v-else-if="func.icon === 'Sell'" />
                <User v-else-if="func.icon === 'User'" />
                <Shop v-else-if="func.icon === 'Shop'" />
                <OfficeBuilding v-else-if="func.icon === 'OfficeBuilding'" />
                <Money v-else-if="func.icon === 'Money'" />
                <Setting v-else-if="func.icon === 'Setting'" />
                <TrendCharts v-else-if="func.icon === 'TrendCharts'" />
              </el-icon>
            </div>
            <span class="func-name">{{ func.name }}</span>
            <el-icon v-if="isCollected(func.id)" class="check-icon" color="#409eff">
              <Check />
            </el-icon>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  DataAnalysis, 
  MapLocation, 
  UserFilled, 
  Lock,
  ShoppingBag,
  Document,
  Check,
  Search,
  StarFilled,
  HomeFilled,
  Goods,
  ShoppingCart,
  Box,
  Sell,
  User,
  Shop,
  OfficeBuilding,
  Money,
  Setting,
  TrendCharts
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const router = useRouter()
const showCollectDialog = ref(false)
const searchKeyword = ref('')

// 我的收藏数据（从localStorage读取）
const myFavorites = ref(JSON.parse(localStorage.getItem('myFavorites') || '[]'))

// 增值服务列表
const valueAddedServices = ref([
  { id: 'light-analysis', name: '轻分析', icon: 'DataAnalysis', iconBg: '#5470c6', route: '/analysis' },
  { id: 'map-library', name: '地图库', icon: 'MapLocation', iconBg: '#91cc75', route: '/map' },
  { id: 'wecom-plugin', name: '企业微信插件', icon: 'UserFilled', iconBg: '#73c0de', route: '/wecom' },
  { id: 'credit-center', name: '金蝶信用中心', icon: 'Lock', iconBg: '#fac858', route: '/credit' }
])

// 生态服务列表
const ecoServices = ref([
  { id: 'app-center', name: '应用中心', icon: 'ShoppingBag', iconBg: '#ff6b35', route: '/app-center' },
  { id: 'content-center', name: '内容中心', icon: 'Document', iconBg: '#73c0de', route: '/content' }
])

// 所有可收藏的功能
const allFunctions = ref([
  ...valueAddedServices.value,
  ...ecoServices.value,
  { id: 'products', name: '商品信息', icon: 'Goods', iconBg: '#ff6b35', route: '/products' },
  { id: 'purchase', name: '采购订单', icon: 'ShoppingCart', iconBg: '#91cc75', route: '/purchase' },
  { id: 'sales', name: '销售订单', icon: 'Sell', iconBg: '#5470c6', route: '/sales' },
  { id: 'inventory', name: '库存查询', icon: 'OfficeBuilding', iconBg: '#fac858', route: '/inventory' },
  { id: 'members', name: '会员管理', icon: 'User', iconBg: '#73c0de', route: '/members' },
  { id: 'finance', name: '财务报表', icon: 'Money', iconBg: '#ff6b35', route: '/finance' }
])

// 过滤后的功能列表
const filteredFunctions = computed(() => {
  if (!searchKeyword.value) return allFunctions.value
  return allFunctions.value.filter(func => 
    func.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 判断是否已收藏
const isCollected = (id) => {
  return myFavorites.value.some(item => item.id === id)
}

// 切换收藏状态
const toggleCollect = (func) => {
  const index = myFavorites.value.findIndex(item => item.id === func.id)
  if (index > -1) {
    myFavorites.value.splice(index, 1)
    ElMessage.success(`已取消收藏：${func.name}`)
  } else {
    if (myFavorites.value.length >= 10) {
      ElMessage.warning('最多只能收藏10个功能')
      return
    }
    myFavorites.value.push(func)
    ElMessage.success(`已添加收藏：${func.name}`)
  }
  // 保存到localStorage
  localStorage.setItem('myFavorites', JSON.stringify(myFavorites.value))
}

// 导航到对应页面
const navigateTo = (route) => {
  if (route) {
    router.push(route)
  } else {
    ElMessage.info('功能开发中...')
  }
}
</script>

<style scoped lang="scss">
.quick-app-page {
  padding: 20px;
  background: #1e1e2d;
  min-height: 100vh;
  color: #fff;

  .section {
    margin-bottom: 30px;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);

      .section-title {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
      }

      .collect-btn {
        color: #409eff;
        font-size: 14px;
        
        &:hover {
          color: #66b1ff;
        }
      }
    }

    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: 14px;
    }

    .app-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 20px;

      .app-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.3s;

        &:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
        }

        .app-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .app-name {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          text-align: center;
        }
      }
    }
  }
}

// 对话框样式
.collect-dialog-content {
  .search-input {
    margin-bottom: 20px;
  }

  .function-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;

    .function-item {
      display: flex;
      align-items: center;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      border: 1px solid transparent;

      &:hover {
        background: #f5f7fa;
      }

      &.is-collected {
        border-color: #409eff;
        background: #ecf5ff;
      }

      .func-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
      }

      .func-name {
        flex: 1;
        font-size: 14px;
        color: #606266;
      }

      .check-icon {
        font-size: 18px;
      }
    }
  }
}
</style>
