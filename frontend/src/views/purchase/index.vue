<template>
  <div class="page-container">
    <div class="page-header">
      <h2>採購管理</h2>
      <el-button type="primary">新增採購訂單</el-button>
    </div>
    <el-card>
      <div class="empty-state">
        <el-icon :size="64" color="#ccc"><Document /></el-icon>
        <p>採購管理模塊開發中</p>
        <p class="sub-text">敬請期待...</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { Document } from '@element-plus/icons-vue'
</script>

<style scoped>
.page-container {
  padding: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 {
  margin: 0;
  color: #ff6b35;
}
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}
.empty-state p {
  margin-top: 16px;
  font-size: 16px;
}
.sub-text {
  font-size: 14px;
  color: #bbb;
}
</style>
