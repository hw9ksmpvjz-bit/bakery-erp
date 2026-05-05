<template>
  <div class="settings-page">
    <div class="page-header">
      <h2>系統設置</h2>
    </div>

    <el-card>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="支付方式" name="payment">
          <el-table :data="paymentMethods" stripe>
            <el-table-column prop="name" label="支付方式" />
            <el-table-column prop="code" label="代碼" />
            <el-table-column label="狀態">
              <template #default="{ row }">
                <el-switch v-model="row.is_active" :active-value="1" :inactive-value="0" />
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="積分規則" name="points">
          <el-form label-width="120px">
            <el-form-item label="消費金額">
              <el-input-number v-model="pointsRule.consume_amount" :min="0.01" :precision="2" />
              <span class="form-unit">元</span>
            </el-form-item>
            <el-form-item label="獲得積分">
              <el-input-number v-model="pointsRule.points_earned" :min="1" />
              <span class="form-unit">積分</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="savePointsRule">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="系統信息" name="system">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="系統名稱">烘焙業ERP管理系統</el-descriptions-item>
            <el-descriptions-item label="系統版本">v1.0.0</el-descriptions-item>
            <el-descriptions-item label="開發週期">100小時</el-descriptions-item>
            <el-descriptions-item label="功能模塊">8大模塊</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const activeTab = ref('payment')
const paymentMethods = ref([])
const pointsRule = reactive({ consume_amount: 1, points_earned: 1 })

const fetchPaymentMethods = async () => {
  try {
    const res = await axios.get('/api/payment-methods')
    paymentMethods.value = res.data.data
  } catch (error) {
    // 使用默認數據
    paymentMethods.value = [
      { name: '現金', code: 'cash', is_active: 1 },
      { name: '微信支付', code: 'wechat', is_active: 1 },
      { name: '支付寶', code: 'alipay', is_active: 1 },
      { name: '會員餘額', code: 'balance', is_active: 1 }
    ]
  }
}

const savePointsRule = () => {
  ElMessage.success('保存成功')
}

onMounted(() => {
  fetchPaymentMethods()
})
</script>

<style scoped lang="scss">
.settings-page {
  .page-header {
    margin-bottom: 20px;
  }

  .form-unit {
    margin-left: 10px;
    color: var(--text-secondary);
  }
}
</style>
