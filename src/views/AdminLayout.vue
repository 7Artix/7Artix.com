<template>
  <div class="admin-layout">
    <div class="admin-container">
      <div class="admin-header">
        <h1>Management Console</h1>
        <nav class="admin-tabs">
          <router-link to="/admin/objects" class="tab-item" active-class="active">Objects</router-link>
          <router-link to="/admin/users" class="tab-item" active-class="active">Users</router-link>
        </nav>
      </div>
      <div class="admin-content">
        <router-view />
      </div>
    </div>
    <PageFooter />
  </div>
</template>

<script setup>
import PageFooter from '../components/PageFooter.vue'
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.admin-container {
  flex: 1;
  padding: 40px 5% 50px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.admin-header {
  margin-bottom: 30px;
}

.admin-header h1 {
  font-size: 2rem;
  margin-bottom: 20px;
  color: #333;
}

.admin-tabs {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.tab-item {
  padding: 8px 20px;
  text-decoration: none;
  color: #666;
  border-radius: 12px;
  transition: all 0.3s;
}

.tab-item:hover {
  background: #f5f5f5;
}

.tab-item.active {
  background: #333;
  color: white;
}

.admin-content {
  background: white;
  border-radius: 8px;
  min-height: 500px;
}
</style>
