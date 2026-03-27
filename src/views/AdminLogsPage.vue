<template>
  <div class="admin-logs-page">
    <div class="logs-header">
      <h2>Server Access Logs (Current Month)</h2>
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
      logsContent.value = await res.text()
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
  padding: 6px 16px;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 6px;
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
