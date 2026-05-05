<template>
  <div class="map-page">
    <div class="page-header">
      <h2>地图库</h2>
      <span class="subtitle">门店与客户分布可视化</span>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="24" :sm="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #5470c6;">
            <el-icon :size="24" color="#fff"><Shop /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-title">门店总数</div>
            <div class="stat-value">{{ stats.storeCount }}家</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #91cc75;">
            <el-icon :size="24" color="#fff"><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-title">客户分布</div>
            <div class="stat-value">{{ stats.customerCount }}个区域</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fac858;">
            <el-icon :size="24" color="#fff"><Van /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-title">配送范围</div>
            <div class="stat-value">{{ stats.deliveryRadius }}km</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 地图区域 -->
    <el-row :gutter="20" class="map-row">
      <el-col :xs="24" :lg="18">
        <div class="map-container">
          <div class="map-header">
            <h3>门店分布地图</h3>
            <el-radio-group v-model="mapType" size="small">
              <el-radio-button label="stores">门店分布</el-radio-button>
              <el-radio-button label="customers">客户热力</el-radio-button>
              <el-radio-button label="delivery">配送区域</el-radio-button>
            </el-radio-group>
          </div>
          <div ref="mapChart" class="map-chart"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="6">
        <div class="side-panel">
          <h4>门店列表</h4>
          <div class="store-list">
            <div 
              v-for="store in storeList" 
              :key="store.id"
              class="store-item"
              :class="{ active: selectedStore === store.id }"
              @click="selectStore(store)"
            >
              <div class="store-header">
                <span class="store-name">{{ store.name }}</span>
                <el-tag size="small" :type="store.status === '营业中' ? 'success' : 'info'">
                  {{ store.status }}
                </el-tag>
              </div>
              <div class="store-info">
                <p><el-icon><Location /></el-icon> {{ store.address }}</p>
                <p><el-icon><Phone /></el-icon> {{ store.phone }}</p>
                <p>销售额: ¥{{ formatNumber(store.sales) }}</p>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 区域分析 -->
    <el-row :gutter="20" class="analysis-row">
      <el-col :xs="24" :lg="12">
        <div class="chart-card">
          <h3>区域销售占比</h3>
          <div ref="regionChart" class="chart-content"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12">
        <div class="chart-card">
          <h3>门店业绩排行</h3>
          <div class="rank-list">
            <div v-for="(store, index) in storeRank" :key="store.id" class="rank-item">
              <div class="rank-num" :class="{ top3: index < 3 }">{{ index + 1 }}</div>
              <div class="rank-info">
                <div class="rank-name">{{ store.name }}</div>
                <el-progress :percentage="store.percentage" :color="progressColors" />
              </div>
              <div class="rank-value">¥{{ formatNumber(store.sales) }}</div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { Shop, User, Van, Location, Phone } from '@element-plus/icons-vue'

// 统计数据
const stats = ref({
  storeCount: 13,
  customerCount: 28,
  deliveryRadius: 50
})

// 地图类型
const mapType = ref('stores')
const selectedStore = ref(null)

// 门店列表
const storeList = ref([
  { id: 1, name: '旗舰店', address: '市中心商业街1号', phone: '400-001-0001', sales: 358000, status: '营业中', x: 500, y: 300 },
  { id: 2, name: '东区店', address: '东区购物广场2楼', phone: '400-001-0002', sales: 289000, status: '营业中', x: 650, y: 250 },
  { id: 3, name: '西区店', address: '西区步行街88号', phone: '400-001-0003', sales: 234000, status: '营业中', x: 350, y: 350 },
  { id: 4, name: '南区店', address: '南区万达广场1楼', phone: '400-001-0004', sales: 198000, status: '营业中', x: 520, y: 450 },
  { id: 5, name: '北区店', address: '北区商业街66号', phone: '400-001-0005', sales: 167000, status: '休息中', x: 480, y: 150 },
  { id: 6, name: '机场店', address: '国际机场T2航站楼', phone: '400-001-0006', sales: 145000, status: '营业中', x: 800, y: 200 },
  { id: 7, name: '高铁站店', address: '高铁站候车大厅', phone: '400-001-0007', sales: 132000, status: '营业中', x: 200, y: 400 }
])

// 门店排行
const storeRank = ref([
  { id: 1, name: '旗舰店', sales: 358000, percentage: 100 },
  { id: 2, name: '东区店', sales: 289000, percentage: 81 },
  { id: 3, name: '西区店', sales: 234000, percentage: 65 },
  { id: 4, name: '南区店', sales: 198000, percentage: 55 },
  { id: 5, name: '北区店', sales: 167000, percentage: 47 },
  { id: 6, name: '机场店', sales: 145000, percentage: 41 },
  { id: 7, name: '高铁站店', sales: 132000, percentage: 37 }
])

const progressColors = [
  { color: '#ff6b35', percentage: 100 },
  { color: '#ff8c5a', percentage: 80 },
  { color: '#91cc75', percentage: 60 },
  { color: '#5470c6', percentage: 40 },
  { color: '#73c0de', percentage: 20 }
]

// 图表引用
const mapChart = ref(null)
const regionChart = ref(null)
let mapChartInstance = null
let regionChartInstance = null

const formatNumber = (num) => {
  return (num || 0).toLocaleString('zh-CN')
}

// 初始化地图
const initMapChart = () => {
  if (!mapChart.value) return
  
  mapChartInstance = echarts.init(mapChart.value)
  updateMapChart()
}

// 更新地图
const updateMapChart = () => {
  if (!mapChartInstance) return

  let option = {}

  if (mapType.value === 'stores') {
    // 门店分布图
    option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.data) {
            return `<strong>${params.data.name}</strong><br/>销售额: ¥${formatNumber(params.data.sales)}<br/>状态: ${params.data.status}`
          }
          return params.name
        }
      },
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { show: false, min: 0, max: 1000 },
      yAxis: { show: false, min: 0, max: 600 },
      series: [
        {
          type: 'scatter',
          symbolSize: (data) => Math.sqrt(data[2]) / 3,
          data: storeList.value.map(s => ({
            name: s.name,
            value: [s.x, s.y, s.sales],
            sales: s.sales,
            status: s.status,
            itemStyle: {
              color: s.status === '营业中' ? '#ff6b35' : '#999'
            }
          })),
          label: {
            show: true,
            formatter: '{b}',
            position: 'top',
            color: '#333'
          }
        }
      ]
    }
  } else if (mapType.value === 'customers') {
    // 客户热力图
    option = {
      backgroundColor: 'transparent',
      tooltip: {},
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { show: false, min: 0, max: 1000 },
      yAxis: { show: false, min: 0, max: 600 },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        inRange: {
          color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695']
        }
      },
      series: [{
        type: 'heatmap',
        data: generateHeatmapData(),
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        }
      }]
    }
  } else if (mapType.value === 'delivery') {
    // 配送区域图
    option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}'
      },
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { show: false, min: 0, max: 1000 },
      yAxis: { show: false, min: 0, max: 600 },
      series: [
        {
          type: 'effectScatter',
          symbolSize: 20,
          data: [[500, 300]],
          rippleEffect: { brushType: 'stroke' },
          itemStyle: { color: '#ff6b35' }
        },
        {
          type: 'scatter',
          symbolSize: (data) => data[2] * 2,
          data: [
            [500, 300, 50],
            [650, 250, 30],
            [350, 350, 40],
            [520, 450, 35]
          ],
          itemStyle: {
            color: 'rgba(255, 107, 53, 0.2)',
            borderColor: '#ff6b35',
            borderWidth: 2
          }
        }
      ]
    }
  }

  mapChartInstance.setOption(option, true)
}

// 生成热力图数据
const generateHeatmapData = () => {
  const data = []
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 30; j++) {
      const x = i * 50 + Math.random() * 30
      const y = j * 20 + Math.random() * 10
      const value = Math.random() * 100
      data.push([x, y, value.toFixed(2)])
    }
  }
  return data
}

// 初始化区域图表
const initRegionChart = () => {
  if (!regionChart.value) return
  
  regionChartInstance = echarts.init(regionChart.value)
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: { show: false },
      data: [
        { value: 358000, name: '市中心区', itemStyle: { color: '#ff6b35' } },
        { value: 289000, name: '东区', itemStyle: { color: '#91cc75' } },
        { value: 234000, name: '西区', itemStyle: { color: '#5470c6' } },
        { value: 198000, name: '南区', itemStyle: { color: '#fac858' } },
        { value: 167000, name: '北区', itemStyle: { color: '#73c0de' } },
        { value: 277000, name: '其他', itemStyle: { color: '#ee6666' } }
      ]
    }]
  }
  regionChartInstance.setOption(option)
}

// 选择门店
const selectStore = (store) => {
  selectedStore.value = store.id
}

// 监听地图类型变化
watch(mapType, () => {
  updateMapChart()
})

const handleResize = () => {
  mapChartInstance?.resize()
  regionChartInstance?.resize()
}

onMounted(() => {
  nextTick(() => {
    initMapChart()
    initRegionChart()
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  mapChartInstance?.dispose()
  regionChartInstance?.dispose()
})
</script>

<style scoped lang="scss">
.map-page {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;

  .page-header {
    margin-bottom: 20px;
    
    h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .subtitle {
      font-size: 12px;
      color: #999;
    }
  }

  .stat-cards {
    margin-bottom: 20px;

    .stat-card {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      align-items: center;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

      .stat-icon {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;
      }

      .stat-info {
        .stat-title {
          font-size: 14px;
          color: #999;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #333;
        }
      }
    }
  }

  .map-row {
    margin-bottom: 20px;

    .map-container {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

      .map-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;

        h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
      }

      .map-chart {
        height: 400px;
        background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
        border-radius: 8px;
      }
    }

    .side-panel {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
      height: 100%;
      max-height: 480px;
      overflow-y: auto;

      h4 {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 16px 0;
        padding-bottom: 12px;
        border-bottom: 1px solid #eee;
      }

      .store-list {
        .store-item {
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.3s;
          border: 1px solid transparent;

          &:hover {
            background: #f5f7fa;
          }

          &.active {
            border-color: #ff6b35;
            background: #fff5f0;
          }

          .store-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;

            .store-name {
              font-weight: 600;
              font-size: 14px;
            }
          }

          .store-info {
            p {
              margin: 4px 0;
              font-size: 12px;
              color: #666;
              display: flex;
              align-items: center;
              gap: 4px;
            }
          }
        }
      }
    }
  }

  .analysis-row {
    .chart-card {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

      h3 {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 20px 0;
      }

      .chart-content {
        height: 300px;
      }

      .rank-list {
        .rank-item {
          display: flex;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;

          &:last-child {
            border-bottom: none;
          }

          .rank-num {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #f0f0f0;
            color: #666;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            margin-right: 12px;
            flex-shrink: 0;

            &.top3 {
              background: #ff6b35;
              color: #fff;
            }
          }

          .rank-info {
            flex: 1;
            margin-right: 12px;

            .rank-name {
              font-size: 14px;
              color: #333;
              margin-bottom: 8px;
            }
          }

          .rank-value {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            flex-shrink: 0;
          }
        }
      }
    }
  }
}
</style>
