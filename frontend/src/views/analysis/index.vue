<template>
  <div class="analysis-page">
    <div class="page-header">
      <h2>轻分析</h2>
      <span class="subtitle">数据分析中心</span>
    </div>

    <!-- 数据概览卡片 -->
    <el-row :gutter="20" class="overview-cards">
      <el-col :xs="24" :sm="12" :md="6">
        <div class="data-card">
          <div class="card-icon" style="background: #5470c6;">
            <el-icon :size="24" color="#fff"><TrendCharts /></el-icon>
          </div>
          <div class="card-info">
            <div class="card-title">今日销售额</div>
            <div class="card-value">¥{{ formatNumber(stats.todaySales) }}</div>
            <div class="card-change" :class="stats.salesGrowth >= 0 ? 'up' : 'down'">
              {{ stats.salesGrowth >= 0 ? '↑' : '↓' }} {{ Math.abs(stats.salesGrowth) }}%
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="data-card">
          <div class="card-icon" style="background: #91cc75;">
            <el-icon :size="24" color="#fff"><ShoppingCart /></el-icon>
          </div>
          <div class="card-info">
            <div class="card-title">今日订单数</div>
            <div class="card-value">{{ formatNumber(stats.todayOrders) }}</div>
            <div class="card-change" :class="stats.orderGrowth >= 0 ? 'up' : 'down'">
              {{ stats.orderGrowth >= 0 ? '↑' : '↓' }} {{ Math.abs(stats.orderGrowth) }}%
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="data-card">
          <div class="card-icon" style="background: #fac858;">
            <el-icon :size="24" color="#fff"><User /></el-icon>
          </div>
          <div class="card-info">
            <div class="card-title">今日客流</div>
            <div class="card-value">{{ formatNumber(stats.todayCustomers) }}</div>
            <div class="card-change" :class="stats.customerGrowth >= 0 ? 'up' : 'down'">
              {{ stats.customerGrowth >= 0 ? '↑' : '↓' }} {{ Math.abs(stats.customerGrowth) }}%
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="data-card">
          <div class="card-icon" style="background: #ee6666;">
            <el-icon :size="24" color="#fff"><Money /></el-icon>
          </div>
          <div class="card-info">
            <div class="card-title">客单价</div>
            <div class="card-value">¥{{ formatNumber(stats.avgOrderValue) }}</div>
            <div class="card-change" :class="stats.avgGrowth >= 0 ? 'up' : 'down'">
              {{ stats.avgGrowth >= 0 ? '↑' : '↓' }} {{ Math.abs(stats.avgGrowth) }}%
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="chart-row">
      <el-col :xs="24" :lg="16">
        <div class="chart-card">
          <div class="chart-header">
            <h3>销售趋势分析</h3>
            <el-radio-group v-model="trendPeriod" size="small">
              <el-radio-button label="week">本周</el-radio-button>
              <el-radio-button label="month">本月</el-radio-button>
              <el-radio-button label="year">本年</el-radio-button>
            </el-radio-group>
          </div>
          <div ref="trendChart" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="8">
        <div class="chart-card">
          <div class="chart-header">
            <h3>商品销售排行</h3>
          </div>
          <div class="rank-list">
            <div v-for="(item, index) in productRank" :key="index" class="rank-item">
              <div class="rank-number" :class="{ 'top3': index < 3 }">{{ index + 1 }}</div>
              <div class="rank-info">
                <div class="rank-name">{{ item.name }}</div>
                <div class="rank-bar">
                  <div class="rank-progress" :style="{ width: item.percentage + '%' }"></div>
                </div>
              </div>
              <div class="rank-value">¥{{ formatNumber(item.amount) }}</div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 第二行图表 -->
    <el-row :gutter="20" class="chart-row">
      <el-col :xs="24" :lg="12">
        <div class="chart-card">
          <div class="chart-header">
            <h3>支付方式占比</h3>
          </div>
          <div ref="paymentChart" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12">
        <div class="chart-card">
          <div class="chart-header">
            <h3>时段销售分析</h3>
          </div>
          <div ref="hourChart" class="chart-container"></div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { TrendCharts, ShoppingCart, User, Money } from '@element-plus/icons-vue'

// 统计数据
const stats = ref({
  todaySales: 12580,
  salesGrowth: 12.5,
  todayOrders: 156,
  orderGrowth: 8.3,
  todayCustomers: 189,
  customerGrowth: -2.1,
  avgOrderValue: 81,
  avgGrowth: 5.2
})

// 趋势周期
const trendPeriod = ref('week')

// 商品排行
const productRank = ref([
  { name: '法式牛角包', amount: 3580, percentage: 100 },
  { name: '巧克力蛋糕', amount: 2890, percentage: 81 },
  { name: '提拉米苏', amount: 2340, percentage: 65 },
  { name: '草莓慕斯', amount: 1890, percentage: 53 },
  { name: '芝士面包', amount: 1560, percentage: 44 },
  { name: '奶油泡芙', amount: 1230, percentage: 34 },
  { name: '抹茶蛋糕', amount: 980, percentage: 27 },
  { name: '水果塔', amount: 760, percentage: 21 }
])

// 图表引用
const trendChart = ref(null)
const paymentChart = ref(null)
const hourChart = ref(null)

let trendChartInstance = null
let paymentChartInstance = null
let hourChartInstance = null

// 格式化数字
const formatNumber = (num) => {
  return (num || 0).toLocaleString('zh-CN')
}

// 初始化趋势图
const initTrendChart = () => {
  if (!trendChart.value) return
  
  trendChartInstance = echarts.init(trendChart.value)
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['销售额', '订单数'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { color: '#666' }
    },
    yAxis: [
      {
        type: 'value',
        name: '销售额',
        position: 'left',
        axisLine: { show: true, lineStyle: { color: '#5470c6' } },
        axisLabel: { formatter: '¥{value}' }
      },
      {
        type: 'value',
        name: '订单数',
        position: 'right',
        axisLine: { show: true, lineStyle: { color: '#91cc75' } },
        axisLabel: { formatter: '{value}笔' }
      }
    ],
    series: [
      {
        name: '销售额',
        type: 'line',
        smooth: true,
        data: [8200, 9320, 9010, 9340, 12900, 13300, 12580],
        itemStyle: { color: '#5470c6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(84, 112, 198, 0.3)' },
              { offset: 1, color: 'rgba(84, 112, 198, 0.05)' }
            ]
          }
        }
      },
      {
        name: '订单数',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: [120, 132, 101, 134, 190, 210, 156],
        itemStyle: { color: '#91cc75' }
      }
    ]
  }
  trendChartInstance.setOption(option)
}

// 初始化支付方式饼图
const initPaymentChart = () => {
  if (!paymentChart.value) return
  
  paymentChartInstance = echarts.init(paymentChart.value)
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'center'
    },
    series: [
      {
        name: '支付方式',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold'
          }
        },
        labelLine: { show: false },
        data: [
          { value: 5230, name: '微信支付', itemStyle: { color: '#91cc75' } },
          { value: 4120, name: '支付宝', itemStyle: { color: '#5470c6' } },
          { value: 1890, name: '现金', itemStyle: { color: '#fac858' } },
          { value: 890, name: '银行卡', itemStyle: { color: '#ee6666' } },
          { value: 450, name: '会员余额', itemStyle: { color: '#73c0de' } }
        ]
      }
    ]
  }
  paymentChartInstance.setOption(option)
}

// 初始化时段分析图
const initHourChart = () => {
  if (!hourChart.value) return
  
  hourChartInstance = echarts.init(hourChart.value)
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { color: '#666', interval: 2 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { color: '#666' },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    series: [
      {
        name: '销售额',
        type: 'bar',
        data: [320, 580, 920, 1250, 1680, 1420, 890, 650, 720, 980, 1350, 1580, 1200, 520],
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#ff8c5a' },
              { offset: 1, color: '#ff6b35' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  }
  hourChartInstance.setOption(option)
}

// 监听窗口大小变化
const handleResize = () => {
  trendChartInstance?.resize()
  paymentChartInstance?.resize()
  hourChartInstance?.resize()
}

onMounted(() => {
  nextTick(() => {
    initTrendChart()
    initPaymentChart()
    initHourChart()
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChartInstance?.dispose()
  paymentChartInstance?.dispose()
  hourChartInstance?.dispose()
})
</script>

<style scoped lang="scss">
.analysis-page {
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

  .overview-cards {
    margin-bottom: 20px;

    .data-card {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      align-items: center;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

      .card-icon {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;
        flex-shrink: 0;
      }

      .card-info {
        flex: 1;

        .card-title {
          font-size: 14px;
          color: #999;
          margin-bottom: 8px;
        }

        .card-value {
          font-size: 24px;
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .card-change {
          font-size: 12px;
          
          &.up {
            color: #52c41a;
          }
          
          &.down {
            color: #ff4d4f;
          }
        }
      }
    }
  }

  .chart-row {
    margin-bottom: 20px;
  }

  .chart-card {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

    .chart-header {
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

    .chart-container {
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

        .rank-number {
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
            margin-bottom: 6px;
          }

          .rank-bar {
            height: 4px;
            background: #f0f0f0;
            border-radius: 2px;
            overflow: hidden;

            .rank-progress {
              height: 100%;
              background: linear-gradient(90deg, #ff8c5a, #ff6b35);
              border-radius: 2px;
              transition: width 0.3s;
            }
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
</style>
