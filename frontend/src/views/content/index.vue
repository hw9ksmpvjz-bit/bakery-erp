<template>
  <div class="content-page">
    <div class="page-header">
      <h2>内容中心</h2>
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>新建内容
      </el-button>
    </div>

    <!-- 内容分类标签 -->
    <div class="content-tabs">
      <el-radio-group v-model="currentType" size="large">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="article">文章</el-radio-button>
        <el-radio-button label="video">视频</el-radio-button>
        <el-radio-button label="image">图片</el-radio-button>
        <el-radio-button label="activity">活动</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 内容列表 -->
    <div class="content-list">
      <el-row :gutter="20">
        <el-col
          v-for="item in filteredContent"
          :key="item.id"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <div class="content-card">
            <div class="content-cover">
              <div v-if="item.type === 'image'" class="cover-image" :style="{ backgroundColor: item.cover }">
                <el-icon :size="48" color="#fff"><Picture /></el-icon>
              </div>
              <div v-else-if="item.type === 'video'" class="cover-video" :style="{ backgroundColor: item.cover }">
                <el-icon :size="48" color="#fff"><VideoPlay /></el-icon>
                <span class="video-duration">{{ item.duration }}</span>
              </div>
              <div v-else class="cover-default" :style="{ backgroundColor: item.cover }">
                <el-icon :size="48" color="#fff"><Document /></el-icon>
              </div>
              <div class="content-status">
                <el-tag :type="item.status === 'published' ? 'success' : 'warning'" size="small">
                  {{ item.status === 'published' ? '已发布' : '草稿' }}
                </el-tag>
              </div>
            </div>
            <div class="content-info">
              <h4 class="content-title">{{ item.title }}</h4>
              <p class="content-desc">{{ item.description }}</p>
              <div class="content-meta">
                <span class="content-date">{{ item.date }}</span>
                <span class="content-views">
                  <el-icon><View /></el-icon> {{ item.views }}
                </span>
              </div>
            </div>
            <div class="content-actions">
              <el-button link type="primary" @click="handleEdit(item)">编辑</el-button>
              <el-button link type="primary" @click="handlePreview(item)">预览</el-button>
              <el-button link type="danger" @click="handleDelete(item)">删除</el-button>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 新建/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'create' ? '新建内容' : '编辑内容'"
      width="700px"
      destroy-on-close
    >
      <el-form :model="formData" label-width="80px">
        <el-form-item label="类型">
          <el-radio-group v-model="formData.type">
            <el-radio-button label="article">文章</el-radio-button>
            <el-radio-button label="video">视频</el-radio-button>
            <el-radio-button label="image">图片</el-radio-button>
            <el-radio-button label="activity">活动</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="formData.title" placeholder="请输入内容标题" />
        </el-form-item>
        <el-form-item label="封面">
          <el-upload
            class="cover-uploader"
            action="#"
            :auto-upload="false"
            :show-file-list="false"
          >
            <div class="upload-placeholder">
              <el-icon :size="32"><Plus /></el-icon>
              <span>上传封面</span>
            </div>
          </el-upload>
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="6"
            placeholder="请输入内容"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="formData.status">
            <el-radio label="draft">草稿</el-radio>
            <el-radio label="published">立即发布</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Plus, Picture, VideoPlay, Document, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const currentType = ref('all')
const dialogVisible = ref(false)
const dialogType = ref('create')

const formData = ref({
  type: 'article',
  title: '',
  content: '',
  status: 'draft'
})

// 内容列表
const contentList = ref([
  {
    id: 1,
    type: 'article',
    title: '新品上市：春季限定草莓蛋糕',
    description: '精选新鲜草莓，搭配进口奶油，口感细腻丝滑',
    cover: '#ff6b35',
    status: 'published',
    date: '2024-03-15',
    views: 1234
  },
  {
    id: 2,
    type: 'video',
    title: '法式烘焙技法教学',
    description: '专业烘焙师教你制作正宗法式牛角包',
    cover: '#5470c6',
    duration: '15:30',
    status: 'published',
    date: '2024-03-14',
    views: 3456
  },
  {
    id: 3,
    type: 'image',
    title: '门店环境展示',
    description: '温馨舒适的用餐环境，欢迎莅临品尝',
    cover: '#91cc75',
    status: 'published',
    date: '2024-03-13',
    views: 892
  },
  {
    id: 4,
    type: 'activity',
    title: '周年庆大酬宾',
    description: '全场商品8折优惠，会员更享折上折',
    cover: '#fac858',
    status: 'published',
    date: '2024-03-12',
    views: 5678
  },
  {
    id: 5,
    type: 'article',
    title: '烘焙小知识：如何保存面包',
    description: '掌握这些技巧，让面包保持新鲜口感',
    cover: '#73c0de',
    status: 'draft',
    date: '2024-03-11',
    views: 0
  },
  {
    id: 6,
    type: 'video',
    title: '蛋糕装饰技巧分享',
    description: '简单易学，让蛋糕瞬间提升颜值',
    cover: '#ee6666',
    duration: '08:45',
    status: 'published',
    date: '2024-03-10',
    views: 2234
  }
])

// 过滤后的内容
const filteredContent = computed(() => {
  if (currentType.value === 'all') {
    return contentList.value
  }
  return contentList.value.filter(item => item.type === currentType.value)
})

// 新建
const handleCreate = () => {
  dialogType.value = 'create'
  formData.value = {
    type: 'article',
    title: '',
    content: '',
    status: 'draft'
  }
  dialogVisible.value = true
}

// 编辑
const handleEdit = (item) => {
  dialogType.value = 'edit'
  formData.value = { ...item }
  dialogVisible.value = true
}

// 预览
const handlePreview = (item) => {
  ElMessage.info(`预览：${item.title}`)
}

// 删除
const handleDelete = (item) => {
  ElMessageBox.confirm(
    `确定要删除「${item.title}」吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const index = contentList.value.findIndex(i => i.id === item.id)
    if (index > -1) {
      contentList.value.splice(index, 1)
      ElMessage.success('删除成功')
    }
  })
}

// 提交
const handleSubmit = () => {
  if (!formData.value.title) {
    ElMessage.warning('请输入标题')
    return
  }

  if (dialogType.value === 'create') {
    const newId = Math.max(...contentList.value.map(i => i.id), 0) + 1
    const colors = ['#ff6b35', '#5470c6', '#91cc75', '#fac858', '#73c0de', '#ee6666']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    contentList.value.unshift({
      id: newId,
      ...formData.value,
      cover: randomColor,
      date: new Date().toISOString().split('T')[0],
      views: 0
    })
    ElMessage.success('创建成功')
  } else {
    const index = contentList.value.findIndex(i => i.id === formData.value.id)
    if (index > -1) {
      contentList.value[index] = { ...contentList.value[index], ...formData.value }
      ElMessage.success('更新成功')
    }
  }
  dialogVisible.value = false
}
</script>

<style scoped lang="scss">
.content-page {
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
  }

  .content-tabs {
    margin-bottom: 24px;
  }

  .content-list {
    .content-card {
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 20px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      }

      .content-cover {
        position: relative;
        height: 160px;

        .cover-image,
        .cover-video,
        .cover-default {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cover-video {
          position: relative;

          .video-duration {
            position: absolute;
            bottom: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
          }
        }

        .content-status {
          position: absolute;
          top: 8px;
          left: 8px;
        }
      }

      .content-info {
        padding: 16px;

        .content-title {
          font-size: 15px;
          font-weight: 600;
          color: #333;
          margin: 0 0 8px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .content-desc {
          font-size: 13px;
          color: #666;
          line-height: 1.5;
          margin-bottom: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .content-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #999;

          .content-views {
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }
      }

      .content-actions {
        padding: 12px 16px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
    }
  }
}

// 弹窗样式
.cover-uploader {
  :deep(.el-upload) {
    border: 1px dashed #d9d9d9;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: var(--el-transition-duration-fast);

    &:hover {
      border-color: var(--el-color-primary);
    }
  }

  .upload-placeholder {
    width: 200px;
    height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #8c939d;

    span {
      margin-top: 8px;
      font-size: 14px;
    }
  }
}
</style>
