<template>
  <div class="admin-logs-page">
    <div class="logs-header">
      <h2>Access Logs</h2>
      <button @click="fetchLogs" class="refresh-btn">Refresh</button>
    </div>
    
    <div class="logs-container" ref="logsContainer">
      <pre class="logs-content">{{ logsContent }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'

const logsContent = ref('Loading logs...')
const logsContainer = ref(null)

const fetchLogs = async () => {
  const token = localStorage.getItem('authToken')
  try {
    const res = await fetch('/api/admin/logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const rawText = await res.text()
      // 将日志中的 UTC 时间正则替换为浏览器当前的本地时间（在中国访问就是东八区）
      logsContent.value = rawText.replace(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/g, (match, isoStr) => {
        const date = new Date(isoStr)
        return `[${date.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')}]`
      })
      // 自动滚动到最底部
      nextTick(() => {
        if (logsContainer.value) {
          logsContainer.value.scrollTop = logsContainer.value.scrollHeight
        }
      })
    } else {
      logsContent.value = 'Failed to load logs. Permission denied or error.'
    }
  } catch (err) {
    logsContent.value = 'Error fetching logs: ' + err.message
  }
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.admin-logs-page {
  padding: 20px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.refresh-btn {
  padding: 8px 12px;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.refresh-btn:hover {
  background-color: #555;
}

/* 包含日志的控制台风格滚动框 */
.logs-container {
  background-color: #1e1e1e;
  border-radius: 8px;
  height: 600px;
  overflow-y: auto;
  padding: 15px;
}

/* 等宽字体展示 */
.logs-content {
  color: #d4d4d4;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap; /* 允许自动换行 */
  word-wrap: break-word;
  margin: 0;
}
</style>
