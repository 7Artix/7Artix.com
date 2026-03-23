<template>
  <div class="login-page">
    <DynamicWave/>
    <div class="login-card">
      <h2>Log in</h2>
      <!-- 状态 1: 未登录，显示输入框 -->
      <div v-if="!isLoggedIn" class="form-group">
        <input 
          type="text" 
          v-model="username" 
          placeholder="Username" 
          @keydown.enter="e => !e.isComposing && handleLogin()"
          class="login-input"
        />
        <input 
          type="password" 
          v-model="password" 
          placeholder="Password" 
          @keydown.enter="e => !e.isComposing && handleLogin()"
          ref="passwordInput"
          class="login-input"
        />
        <button @click="handleLogin" :disabled="loading">
          {{ loading ? 'Verifying...' : 'Log in' }}
        </button>
      </div>

      <!-- 状态 2: 已登录，显示操作面板 -->
      <div v-else class="action-group">
        <p class="status-text">Artifact Validated</p>
        <div class="buttons">
          <button @click="goToAdmin">Go to Console</button>
          <button @click="handleLogout" class="logout-btn">Logout</button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import DynamicWave from '../components/DynamicWave.vue'

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const isLoggedIn = ref(false)
const router = useRouter()
const passwordInput = ref(null)

// 检查登录状态
onMounted(() => {
  const token = localStorage.getItem('authToken')
  if (token) {
    isLoggedIn.value = true
  }
})

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = 'Please enter username and password'
    return
  }

  loading.value = true
  error.value = ''
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: username.value,
        password: password.value 
      })
    })
    const data = await res.json()
    
    if (data.success) {
      localStorage.setItem('authToken', data.token)
      // Store user info if needed
      localStorage.setItem('userInfo', JSON.stringify(data.user))
      isLoggedIn.value = true
      
      if (data.user.role === 'admin') {
        window.dispatchEvent(new Event('auth-change'))
        router.push('/admin/objects')
      } else {
        window.dispatchEvent(new Event('auth-change'))
        router.push('/')
      }
    } else {
      error.value = data.message || 'Access Denied'
    }
  } catch (e) {
    error.value = 'Server Error'
  } finally {
    loading.value = false
  }
}

const goToAdmin = () => {
  router.push('/admin')
}

const handleLogout = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('userInfo')
  window.dispatchEvent(new Event('auth-change'))
  isLoggedIn.value = false
  password.value = ''
  error.value = ''
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: #f0f0f0;
}
.login-card {
  padding: 40px;
  border-radius: 40px;
  display: flex; flex-direction: column; gap: 15px;
  width: 400px; text-align: center;
  z-index: 10;
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.4); 
  backdrop-filter: blur(16px);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255,255,255,0.4);
}
.form-group, .action-group {
  display: flex; flex-direction: column; gap: 20px; padding-top: 20px;
}
.buttons {
  display: flex; gap: 10px; justify-content: center;
}
input {
  padding: 12px; border: 1px solid #ddd; border-radius: 10px; outline: none;
  font-family: inherit;
  font-size: 12px;
}
button {
  padding: 12px; background: #333333; color: white; border: none; border-radius: 10px; cursor: pointer; flex: 1;
  font-family: inherit;
  font-size: 16px;
}
.logout-btn {
  background: #ff4757;
}
.status-text {
  color: #2ecc71; font-weight: bold; margin: 0;
}
.error { color: red; font-size: 12px; margin: 0; }
</style>