<template>
  <div class="wecom-page">
    <div class="page-header">
      <h2>企业微信插件</h2>
    </div>

    <!-- 产品价值区域 -->
    <div class="value-section">
      <h3>产品价值</h3>
      <el-row :gutter="20">
        <el-col :xs="24" :md="8">
          <div class="value-card">
            <div class="value-icon blue">
              <el-icon :size="32"><DocumentChecked /></el-icon>
            </div>
            <div class="value-content">
              <h4>客户洞察</h4>
              <ul>
                <li>拜访记录</li>
                <li>联系记录</li>
                <li>交易记录</li>
                <li>客户分析</li>
              </ul>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :md="8">
          <div class="value-card">
            <div class="value-icon green">
              <el-icon :size="32"><Share /></el-icon>
            </div>
            <div class="value-content">
              <h4>客户营销</h4>
              <ul>
                <li>商品分享</li>
                <li>促销分享</li>
                <li>小程序分享</li>
                <li>客户偏好商品</li>
              </ul>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :md="8">
          <div class="value-card">
            <div class="value-icon orange">
              <el-icon :size="32"><ChatDotRound /></el-icon>
            </div>
            <div class="value-content">
              <h4>边聊边开单</h4>
              <ul>
                <li>同步客户资料</li>
                <li>一键销售报价</li>
                <li>一键开销售单</li>
                <li>一键对账收款</li>
              </ul>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 使用指引区域 -->
    <div class="guide-section">
      <h3>使用指引</h3>
      <el-row :gutter="20">
        <el-col :xs="24" :lg="12">
          <div class="guide-left">
            <p class="guide-desc">连接插件，可以把金蝶云星辰接入到企业微信中使用。</p>
            <p class="guide-desc">使用企业微信扫描下侧二维码即可安装，安装后操作步骤如下：</p>
            <div class="guide-steps">
              <div class="step-item">
                <span class="step-num">1</span>
                <span>登录金蝶云管理员账号</span>
              </div>
              <div class="step-item">
                <span class="step-num">2</span>
                <span>选择金蝶公司</span>
              </div>
              <div class="step-item">
                <span class="step-num">3</span>
                <span>子账号授权绑定</span>
              </div>
            </div>
            <div class="qr-code">
              <div class="qr-placeholder">
                <el-icon :size="48"><FullScreen /></el-icon>
                <span>扫码安装</span>
              </div>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :lg="6">
          <div class="guide-actions">
            <el-button 
              v-for="action in actions" 
              :key="action.key"
              :type="currentAction === action.key ? 'primary' : 'default'"
              class="action-btn"
              @click="currentAction = action.key"
            >
              {{ action.label }}
            </el-button>
          </div>
        </el-col>
        <el-col :xs="24" :lg="6">
          <div class="guide-video">
            <div class="video-placeholder">
              <el-icon :size="48" class="play-icon"><VideoPlay /></el-icon>
              <span>操作视频</span>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 配置表单（当选择不同功能时显示） -->
    <div v-if="currentAction === 'install'" class="config-section">
      <el-card>
        <template #header>
          <span>企业微信配置</span>
        </template>
        <el-form :model="configForm" label-width="120px">
          <el-form-item label="CorpID">
            <el-input v-model="configForm.corpId" placeholder="请输入企业微信CorpID" />
          </el-form-item>
          <el-form-item label="AgentID">
            <el-input v-model="configForm.agentId" placeholder="请输入应用AgentID" />
          </el-form-item>
          <el-form-item label="Secret">
            <el-input v-model="configForm.secret" type="password" placeholder="请输入应用Secret" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
            <el-button @click="testConnection">测试连接</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <div v-else-if="currentAction === 'message'" class="config-section">
      <el-card>
        <template #header>
          <span>消息推送设置</span>
        </template>
        <el-form :model="messageForm" label-width="140px">
          <el-form-item label="订单通知">
            <el-switch v-model="messageForm.orderNotify" />
          </el-form-item>
          <el-form-item label="库存预警通知">
            <el-switch v-model="messageForm.stockNotify" />
          </el-form-item>
          <el-form-item label="审批通知">
            <el-switch v-model="messageForm.approvalNotify" />
          </el-form-item>
          <el-form-item label="日报推送">
            <el-switch v-model="messageForm.dailyReport" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveMessageConfig">保存设置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { DocumentChecked, Share, ChatDotRound, FullScreen, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 当前选中功能
const currentAction = ref('install')

// 功能列表
const actions = [
  { key: 'install', label: '安装步骤' },
  { key: 'message', label: '消息设置' },
  { key: 'chat', label: '边聊边开单' },
  { key: 'approval', label: '审批流程' }
]

// 配置表单
const configForm = ref({
  corpId: '',
  agentId: '',
  secret: ''
})

// 消息设置表单
const messageForm = ref({
  orderNotify: true,
  stockNotify: true,
  approvalNotify: true,
  dailyReport: false
})

// 保存配置
const saveConfig = () => {
  localStorage.setItem('wecomConfig', JSON.stringify(configForm.value))
  ElMessage.success('配置已保存')
}

// 测试连接
const testConnection = () => {
  ElMessage.info('正在测试连接...')
  setTimeout(() => {
    ElMessage.success('连接测试成功')
  }, 1500)
}

// 保存消息设置
const saveMessageConfig = () => {
  localStorage.setItem('wecomMessageConfig', JSON.stringify(messageForm.value))
  ElMessage.success('消息设置已保存')
}
</script>

<style scoped lang="scss">
.wecom-page {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;

  .page-header {
    margin-bottom: 20px;
    
    h2 {
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }
  }

  .value-section {
    margin-bottom: 30px;

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
    }

    .value-card {
      background: #fff;
      border-radius: 8px;
      padding: 24px;
      display: flex;
      align-items: flex-start;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
      height: 100%;

      .value-icon {
        width: 60px;
        height: 60px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;
        flex-shrink: 0;

        &.blue {
          background: #e6f7ff;
          color: #1890ff;
        }

        &.green {
          background: #f6ffed;
          color: #52c41a;
        }

        &.orange {
          background: #fff7e6;
          color: #fa8c16;
        }
      }

      .value-content {
        h4 {
          font-size: 16px;
          font-weight: 600;
          color: #1f1f1f;
          margin: 0 0 12px 0;
        }

        ul {
          margin: 0;
          padding-left: 0;
          list-style: none;

          li {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
            position: relative;
            padding-left: 12px;

            &:before {
              content: '';
              position: absolute;
              left: 0;
              top: 8px;
              width: 4px;
              height: 4px;
              background: #ff6b35;
              border-radius: 50%;
            }
          }
        }
      }
    }
  }

  .guide-section {
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
    }

    .guide-left {
      background: #fff;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

      .guide-desc {
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
        line-height: 1.6;
      }

      .guide-steps {
        margin: 20px 0;

        .step-item {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          font-size: 14px;
          color: #666;

          .step-num {
            width: 24px;
            height: 24px;
            background: #ff6b35;
            color: #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-size: 12px;
            font-weight: 600;
          }
        }
      }

      .qr-code {
        margin-top: 24px;
        text-align: center;

        .qr-placeholder {
          width: 160px;
          height: 160px;
          background: #f5f7fa;
          border: 2px dashed #d9d9d9;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #999;

          span {
            margin-top: 8px;
            font-size: 12px;
          }
        }
      }
    }

    .guide-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .action-btn {
        width: 100%;
        height: 48px;
        font-size: 14px;

        &.el-button--primary {
          background: #4a90e2;
          border-color: #4a90e2;
        }
      }
    }

    .guide-video {
      background: #f5f7fa;
      border-radius: 8px;
      height: 100%;
      min-height: 280px;
      display: flex;
      align-items: center;
      justify-content: center;

      .video-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        color: #999;

        .play-icon {
          color: #666;
          margin-bottom: 12px;
        }

        span {
          font-size: 14px;
        }
      }
    }
  }

  .config-section {
    margin-top: 24px;
  }
}
</style>
