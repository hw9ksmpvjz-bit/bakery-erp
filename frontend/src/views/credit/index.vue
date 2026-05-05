<template>
  <div class="credit-page">
    <div class="page-header">
      <h2>金蝶信用中心</h2>
      <span class="subtitle">企业信用服务与额度管理</span>
    </div>

    <el-row :gutter="20" class="service-cards">
      <el-col :xs="24" :md="8">
        <div class="service-card">
          <div class="card-icon yellow">
            <el-icon :size="40"><TrendCharts /></el-icon>
          </div>
          <h3>信用评估</h3>
          <p>基于企业经营数据，智能评估企业信用等级</p>
          <el-button type="primary" @click="showComingSoon">立即评估</el-button>
        </div>
      </el-col>
      <el-col :xs="24" :md="8">
        <div class="service-card">
          <div class="card-icon blue">
            <el-icon :size="40"><Money /></el-icon>
          </div>
          <h3>信用额度</h3>
          <p>申请信用额度，享受先货后款服务</p>
          <el-button type="primary" @click="showComingSoon">申请额度</el-button>
        </div>
      </el-col>
      <el-col :xs="24" :md="8">
        <div class="service-card">
          <div class="card-icon green">
            <el-icon :size="40"><Document /></el-icon>
          </div>
          <h3>信用报告</h3>
          <p>查询企业信用报告，了解信用状况</p>
          <el-button type="primary" @click="showComingSoon">查询报告</el-button>
        </div>
      </el-col>
    </el-row>

    <el-card class="intro-card">
      <template #header>
        <span>关于金蝶信用中心</span>
      </template>
      <p>金蝶信用中心是金蝶云星辰与金融机构合作推出的企业信用服务平台，帮助企业：</p>
      <ul>
        <li>建立企业信用档案，提升企业信用形象</li>
        <li>获取信用额度，解决资金周转问题</li>
        <li>查询信用报告，掌握企业信用状况</li>
        <li>享受金融服务，助力企业发展</li>
      </ul>
      <div class="contact-info">
        <p><strong>服务热线：</strong>400-830-0755</p>
        <p><strong>服务时间：</strong>工作日 9:00-18:00</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { TrendCharts, Money, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const showComingSoon = () => {
  ElMessage.info('功能开发中，敬请期待')
}
</script>

<style scoped lang="scss">
.credit-page {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;

  .page-header {
    margin-bottom: 24px;
    
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

  .service-cards {
    margin-bottom: 24px;

    .service-card {
      background: #fff;
      border-radius: 8px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

      .card-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        color: #fff;

        &.yellow {
          background: linear-gradient(135deg, #fac858, #f5a623);
        }

        &.blue {
          background: linear-gradient(135deg, #5470c6, #3d5fc7);
        }

        &.green {
          background: linear-gradient(135deg, #91cc75, #67c23a);
        }
      }

      h3 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
      }

      p {
        font-size: 14px;
        color: #666;
        margin-bottom: 20px;
        line-height: 1.6;
        min-height: 44px;
      }

      .el-button {
        width: 120px;
      }
    }
  }

  .intro-card {
    ul {
      margin: 16px 0;
      padding-left: 20px;

      li {
        margin-bottom: 8px;
        color: #666;
        line-height: 1.6;
      }
    }

    .contact-info {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;

      p {
        margin: 8px 0;
        color: #666;
      }
    }
  }
}
</style>
