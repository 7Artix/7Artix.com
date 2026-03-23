<template>
  <div class="users-page">
    <div class="action-bar">
      <button class="btn-primary" @click="showCreateModal = true">Add New User</button>
    </div>

    <table class="users-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Username</th>
          <th>Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.id }}</td>
          <td>{{ user.username }}</td>
          <td><span :class="['role-badge', user.role]">{{ user.role }}</span></td>
          <td>
            <button @click="editUser(user)">Edit</button>
            <button @click="deleteUser(user)" class="btn-danger" :disabled="user.id === currentUserId">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- User Edit/Create Modal -->
    <div v-if="showCreateModal || editingUser" class="modal-overlay">
      <div class="modal">
        <h3>{{ editingUser ? 'Edit User' : 'Create New User' }}</h3>
        <div class="form-group">
          <label>Username</label>
          <input v-model="userForm.username" type="text" />
        </div>
        <div class="form-group">
          <label>Password {{ editingUser ? '(Leave blank to keep same)' : '' }}</label>
          <input v-model="userForm.password" type="password" />
        </div>
        <div class="form-group">
          <label>Role</label>
          <select v-model="userForm.role">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="modal-actions">
          <button @click="saveUser">Save</button>
          <button @click="closeModal" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

const users = ref([])
const showCreateModal = ref(false)
const editingUser = ref(null)
const userForm = ref({ username: '', password: '', role: 'user' })

const currentUserId = computed(() => {
  const userInfo = localStorage.getItem('userInfo')
  return userInfo ? JSON.parse(userInfo).id : null
})

const fetchUsers = async () => {
  const token = localStorage.getItem('authToken')
  const res = await fetch('/api/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (res.status === 401) {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userInfo')
    window.dispatchEvent(new Event('auth-change'))
    window.location.href = '/login'
    return
  }
  if (res.ok) {
    users.value = await res.json()
  }
}

const editUser = (user) => {
  editingUser.value = user
  userForm.value = { username: user.username, password: '', role: user.role }
}

const deleteUser = async (user) => {
  if (!confirm(`Are you sure you want to delete user ${user.username}?`)) return
  
  const token = localStorage.getItem('authToken')
  const res = await fetch(`/api/users/${user.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (res.ok) {
    fetchUsers()
  } else {
    const data = await res.json()
    alert(data.message || 'Failed to delete user')
  }
}

const saveUser = async () => {
  const token = localStorage.getItem('authToken')
  const url = editingUser.value ? `/api/users/${editingUser.value.id}` : '/api/users'
  const method = editingUser.value ? 'PUT' : 'POST'
  
  const res = await fetch(url, {
    method,
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify(userForm.value)
  })

  if (res.ok) {
    closeModal()
    fetchUsers()
  } else {
    const data = await res.json()
    alert(data.message || 'Failed to save user')
  }
}

const closeModal = () => {
  showCreateModal.value = false
  editingUser.value = null
  userForm.value = { username: '', password: '', role: 'user' }
}

onMounted(fetchUsers)
</script>

<style scoped>
.users-page {
  padding: 20px;
}

.action-bar {
  margin-bottom: 20px;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th, .users-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.role-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.role-badge.admin { background: #fee2e2; color: #b91c1c; }
.role-badge.user { background: #f3f4f6; color: #374151; }

.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 30px;
  border-radius: 8px;
  width: 400px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block; margin-bottom: 5px; font-weight: bold;
}

.form-group input, .form-group select {
  width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;
}

.modal-actions {
  display: flex; gap: 10px; margin-top: 20px;
}

.btn-primary { background: #333; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
.btn-secondary { background: #eee; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
.btn-danger { background: #fee2e2; color: #b91c1c; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }

button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
