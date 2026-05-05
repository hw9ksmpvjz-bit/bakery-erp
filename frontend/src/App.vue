<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script setup>
// 根組件
</script>

<style>
/* 全局樣式在 main.scss 中定義 */
</style>
