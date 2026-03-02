import { createRouter, createWebHistory } from 'vue-router'
import Homepage from '../views/Homepage.vue'
import ObjectPage from '../views/ObjectDetailPage.vue'
import SearchPage from '../views/SearchPage.vue'
import MePage from '../views/MePage.vue'
import CVPage from '../views/CVPage.vue'
import LoginPage from '../views/LoginPage.vue' // 1. 引入登录组件

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Homepage
  },
  { 
    path: '/object/:id', 
    name: 'ObjectDetail',
    component: ObjectPage 
  },
  // 2. 添加登录路由
  {
    path: '/login',
    name: 'Login',
    component: LoginPage
  },
  { path: '/projects',
    name: 'Projects',
    component: () => import('../views/ObjectsPage.vue'),
    props: { type: 'project', mode: 'view' }
  },
  { path: '/posts',
    name: 'Posts',
    component: () => import('../views/ObjectsPage.vue'),
    props: { type: 'post', mode: 'view' }
  },
  { path: '/admin',
    component: () => import('../views/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: '/admin/objects'
      },
      {
        path: 'objects',
        name: 'AdminObjects',
        component: () => import('../views/AdminObjectsPage.vue')
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('../views/AdminUsersPage.vue')
      }
    ]
  },
  { path: '/cv',
    name: 'CV',
    component: CVPage
  },
  { path: '/search',
    name: 'Search',
    component: SearchPage
  },
  { path: '/me',
    name: 'Me',
    component: MePage
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 4. 添加全局路由守卫 (核心拦截逻辑)
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('authToken')

  if (to.meta.requiresAuth) {
    if (!token) {
      next('/login')
      return
    }

    // 🔥 核心修改：向后端验证 Token 是否有效
    try {
      const res = await fetch('/api/check-auth', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        const user = data.user
        
        // Check for admin requirement
        if (to.meta.requiresAdmin && user.role !== 'admin') {
          next('/')
          return
        }

        next() // 验证通过，放行
      } else {
        // Token 无效（过期或密码已改），清除本地存储并跳回登录页
        localStorage.removeItem('authToken')
        localStorage.removeItem('userInfo')
        next('/login')
      }
    } catch (e) {
      // 网络错误或其他异常，保险起见也跳回登录页
      console.error('Auth check failed:', e)
      next('/login')
    }
  } else {
    next()
  }
})

export default router