<template>
    <nav 
        class="navbar-container"
        ref="navbarRef"
        @mouseleave="handleMouseLeave"
    >
        <div class="navbar-wrapper">
            <div class="navbar-content">
                <ul class="nav-links">
                    <li 
                        v-for="item in displayMenuItems" 
                        :key="item.path" 
                        @mouseenter="handleMouseEnter(item)"
                        :class="{ 'active-title': hoveredItem === item }"
                    >
                        <div class="nav-item-top" @click="handleItemClick(item)">
                            <!-- Case 1: Logo -->
                            <router-link v-if="item.label === 'logo'" :to="item.path" class="nav-search-logo" @click.native="closeMenu">
                                {{ item.name }}
                            </router-link>

                            <!-- Case 2: Has Icon -->
                            <router-link v-else-if="item.icon" :to="item.path" class="nav-icon-link" @click.native="closeMenu">
                                <img 
                                    v-if="item.label === 'account'" 
                                    :src="item.icon" 
                                    alt="Me"
                                    class="nav-avatar"
                                />
                                <img 
                                    v-else 
                                    :src="item.icon" 
                                    :alt="item.name"
                                    class="nav-icon"
                                />
                            </router-link>

                            <!-- Case 3: Normal Title -->
                            <router-link v-else :to="item.path" class="nav-title" @click.native="closeMenu">{{ item.name }}</router-link>
                        </div>
                    </li>
                </ul>
            </div>

            <!-- 动态下拉区 -->
            <Transition name="fade">
                <div v-if="isHovered && hoveredItem?.children?.length" class="navbar-dropdown">
                    <div class="dropdown-inner">
                        <div class="dropdown-column">
                            <span v-if="hoveredItem.label === 'object'" class="column-label">{{ `Explore ${hoveredItem.name}` }}</span>
                            <ul>
                                <li v-for="child in hoveredItem.children" :key="child.path" class="dropdown-li-link-wrapper">
                                    <router-link :to="child.path" class="dropdown-link" @click.native="closeMenu">
                                        {{ child.name }}
                                    </router-link>
                                </li>
                            </ul>
                        </div>
                        <div class="dropdown-desc">
                            {{ hoveredItem.desc }}
                        </div>
                    </div>
                </div>
            </Transition>

        </div>
    </nav>

    <Teleport to="body">
        <!-- Added click handler to close menu when tapping outside -->
        <div ref="backdropRef" class="nav-page-backdrop" @click="closeMenu"></div>
    </Teleport>

</template>

<script setup>
import { ref, watch, nextTick, onMounted, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'
import yaml from 'js-yaml'
import { NAV_HEIGHT } from '../config/constants'

const router = useRouter()
const isHovered = ref(false)
const hoveredItem = ref(null)
const navbarRef = ref(null)
const backdropRef = ref(null)
const isMobile = ref(false) // State for mobile detection

const menuItems = ref([])

// [NEW] 添加响应式状态来追踪认证状态变化
const authState = ref({
  token: localStorage.getItem('authToken'),
  userInfo: localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')) : null
})

// User system
const isAdmin = computed(() => {
    return authState.value.userInfo?.role === 'admin'
})

const isLoggedIn = computed(() => {
    return !!authState.value.token
})

const displayMenuItems = computed(() => {
    return menuItems.value.map(item => {
        if (item.label === 'account') {
            const children = [...(item.children || [])]
            
            // Remove Login if already logged in
            const loginIndex = children.findIndex(c => c.path === '/login')
            if (isLoggedIn.value && loginIndex > -1) {
                children.splice(loginIndex, 1)
            }

            // Add Admin if admin
            if (isAdmin.value) {
                children.push({ name: 'Admin Console', path: '/admin/objects' })
            }

            // Add Logout if logged in
            if (isLoggedIn.value) {
                children.push({ name: 'Log Out', path: '/logout' })
            } else if (loginIndex === -1) {
                children.push({ name: 'Log In', path: '/login' })
            }

            return { ...item, children }
        }
        return item
    })
})

// [NEW] 更新认证状态方法
const updateAuthState = () => {
    authState.value.token = localStorage.getItem('authToken')
    authState.value.userInfo = localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')) : null
}

const fetchNavData = async () => {
    try {
        const response = await fetch('/api/static/site/navbar.yaml')
        const text = await response.text()
        const data = yaml.load(text)

        const items = []
        
        // Items from YAML (including logo, avatar, search, and other menu items)
        if (data.items) {
            data.items.forEach(item => {
                items.push({
                    name: item.name,
                    path: item.path,
                    icon: item.icon || null,
                    label: item.label || null,
                    desc: item.desc || '',
                    children: item.subitems ? item.subitems.map(sub => ({
                        name: sub.name,
                        path: sub.path
                    })) : []
                })
            })
        }

        menuItems.value = items

    } catch (error) {
        console.error('Error fetching navbar configuration:', error)
    }
}

// Mobile Detection Logic
const checkMobile = () => {
    isMobile.value = window.innerWidth <= 768 || ('ontouchstart' in window)
}

onMounted(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    fetchNavData()
    
    // 初始化认证状态
    updateAuthState()
    
    // [NEW] 监听路由变化,每次路由变化时更新认证状态
    router.afterEach(() => {
        updateAuthState()
    })
    
    // [NEW] 监听 storage 事件(用于同一浏览器的多个标签页)
    window.addEventListener('storage', (e) => {
        if (e.key === 'authToken' || e.key === 'userInfo') {
            updateAuthState()
        }
    })
    
    // [NEW] 监听自定义认证状态改变事件
    window.addEventListener('auth-change', () => {
        updateAuthState()
    })
})

onUnmounted(() => {
    window.removeEventListener('resize', checkMobile)
    window.removeEventListener('auth-change', updateAuthState)
})

const closeMenu = () => {
    isHovered.value = false
    hoveredItem.value = null
}

const navigateTo = (path) => {
    // User system
    if (path === '/logout') {
        localStorage.removeItem('authToken')
        localStorage.removeItem('userInfo')
        // [NEW] 立即更新认证状态
        authState.value.token = null
        authState.value.userInfo = null
        router.push('/')
        closeMenu()
        return
    }
    
    router.push(path)
    closeMenu()
}

// Logic: On mobile, tap to expand first; tap again to navigate
const handleItemClick = (item) => {
    if (isMobile.value && item.children && item.children.length > 0) {
        // If this item is NOT currently open, open it and stop navigation
        if (hoveredItem.value !== item || !isHovered.value) {
            hoveredItem.value = item
            isHovered.value = true
            return
        }
    }
    // Otherwise navigate
    navigateTo(item.path)
}

const handleMouseEnter = (item) => {
    if (!isMobile.value) {
        isHovered.value = true
        hoveredItem.value = item
    }
}

const handleMouseLeave = () => {
    if (!isMobile.value) {
        closeMenu()
    }
}

watch([isHovered, hoveredItem], async () => {
    if (isHovered.value && hoveredItem.value?.children?.length > 0) {
        await nextTick()
        
        gsap.to(navbarRef.value, { height: 'auto', minHeight: 300, backgroundColor: 'rgba(255, 255, 255, 1)', duration: 0.4, ease: "expo.out", overwrite: true })
        // Added pointerEvents: 'auto' so the backdrop can capture clicks
        gsap.to(backdropRef.value, { autoAlpha: 1, pointerEvents: 'auto', duration: 0.4, ease: "expo.out", overwrite: true })
    } else {
        gsap.to(navbarRef.value, { height: NAV_HEIGHT, minHeight: NAV_HEIGHT, backgroundColor: 'rgba(255, 255, 255, 0.6)', duration: 0.3, ease: "power2.inOut", overwrite: true })
        gsap.to(backdropRef.value, { autoAlpha: 0, pointerEvents: 'none', duration: 0.3, ease: "power2.inOut", overwrite: true })
    }
})
</script>

<style scoped>
.navbar-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: v-bind(NAV_HEIGHT);
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(20px) saturate(120%);
    z-index: 9999;
    overflow: hidden;
    display: flex;
    justify-content: center;
    user-select: none;
    -webkit-user-select: none;
}

.navbar-wrapper {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    margin: 0 auto;
}

/* 主导航行 */
.navbar-content {
    padding: 0 30px; 
    width: 100%;
    height: v-bind(NAV_HEIGHT);
    display: flex;
    justify-content: center; 
    align-items: center;
    flex-shrink: 0;
    box-sizing: border-box;
}

/* 下拉区域样式 */
.navbar-dropdown {
    width: max-content;
    min-width: 100%;
    max-width: calc(50vw + 300px - 30px); 

    padding: 20px 30px 50px 30px;
    box-sizing: border-box;
}

/* 小屏幕适配，避免计算值在窄屏下失效 */
@media (max-width: 650px) {
    .navbar-dropdown {
        max-width: calc(100vw - 40px);
    }
}

.dropdown-inner {
    display: flex;
    gap: 80px;
    align-items: flex-start;
}

/* 确保左侧菜单项不被挤压 */
.dropdown-column {
    flex-shrink: 0;
}

.column-label {
    font-size: 10px;
    color: #8c8c8c;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 20px;
    display: block;
}

.dropdown-column ul { list-style: none; }
.dropdown-column li {
    color: #505050;
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 10px;
    cursor: pointer;
    transition: color 0.5s, text-shadow 0.5s;
}
.dropdown-column li:hover { color: #000000; text-shadow: 0 0 2px rgba(0, 0, 0, 0.2);}
.dropdown-desc { font-size: 12px; color: #86868b; line-height: 1.5; margin-top: -2px; text-align: justify; }

.nav-links { 
    display: flex; 
    list-style: none; 
    justify-content: space-between;
    width: 100%;
    padding: 0.;
    margin: 0;
}
.nav-links li { height: v-bind(NAV_HEIGHT); display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; }
.nav-item-top { height: v-bind(NAV_HEIGHT); display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.nav-title { font-size: 12px; color: #333333; line-height: 1; transition: font-weight 0.2s; text-decoration: none; }

.active-title .nav-title {
    color: #000000;
}

.nav-icon {
    height: 12px;
    width: 12px;
    display: block;
}

.nav-search-logo { cursor: pointer; font-size: 12px; font-weight: 700; text-decoration: none; color: inherit; }
.dropdown-link { color: inherit; text-decoration: none; display: block; width: 100%; }

.nav-avatar {
    cursor: pointer;
    width: 1.8em;
    height: 1.8em;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.8);
    display: block;
    position: relative;
    filter: drop-shadow(0 0px 2px rgba(0, 0, 0, 0.2));
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.nav-page-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9998;
    background: rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(12px);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}

.nav-icon-link { display: flex; align-items: center; justify-content: center; text-decoration: none; color: inherit; }
</style>