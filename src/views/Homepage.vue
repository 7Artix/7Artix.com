<template>
  <div class="waterfall-container" 
    @wheel.prevent="handleWheel" 
    @mousemove="handleMouseMove"
    @touchstart="handleTouchStart"
    @touchmove.prevent="handleTouchMove"
  >
    <!-- 背景流层 -->
    <div class="columns-wrapper" :class="{ 'blur-bg': showModal }">
      <div 
        v-for="(col, colIndex) in columns" 
        :key="colIndex" 
        class="column"
        :ref="el => { if(el) columnRefs[colIndex] = el }"
      >
        <div 
          class="inner-strip"
          :ref="el => { if(el) stripRefs[colIndex] = el }"
        >
          <!-- 渲染三倍数据以保证无缝 -->
          <div 
            v-for="(card, cardIndex) in col.tripledData" 
            :key="`${colIndex}-${cardIndex}`"
            class="card-item"
            @click="handleCardClick(card)"
          >
            <div class="card-image-wrapper" :class="{ 'is-loading': !card.loaded }">
              <!-- 加载中动画 -->
              <div v-if="!card.loaded" class="loading-placeholder">
                <div class="spinner"></div>
              </div>
              
              <!-- 图片：加载前透明，加载后淡入 -->
              <img 
                :src="card.imagePath" 
                class="card-img" 
                :class="{ 'img-visible': card.loaded }"
                @load="card.loaded = true"
                @error="card.loaded = true"
              />
            </div>
            <div class="card-info">
              <span class="card-name">{{ card.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情模态框 -->
    <Transition name="modal-fade">
      <div v-if="showModal && selectedObject" class="modal-overlay" @click="closeModal">
        <div class="modal-content" @click.stop>
          <ObjectProfile 
            :obj="selectedObject" 
            :allTags="tags"
            @view="navigateToDetail"
          />
        </div>
      </div>
    </Transition>

    <!-- 播放/暂停按钮 -->
    <div 
      class="play-pause-btn" 
      @click="togglePause"
      :title="isPaused ? 'Play' : 'Pause'"
    >
      <div class="icon-wrapper">
        <div class="icon-mask"
          :class="isPaused ? 'play-icon' : 'pause-icon'"
          :style="{ 
            maskImage: `url(/api/static/site/icons/${isPaused ? 'play.fill.svg' : 'pause.fill.svg'})`, 
            WebkitMaskImage: `url(/api/static/site/icons/${isPaused ? 'play.fill.svg' : 'pause.fill.svg'})` 
          }">
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import ObjectProfile from '../components/ObjectProfile.vue'

const router = useRouter()

// --- 数据状态 ---
const objects = ref([])
const tags = ref([]) // 传递给 Profile 用
const columns = ref([]) // 存储分列后的数据
const columnCount = ref(5) // 列数，可根据屏幕宽度动态调整

// [优化] 将 offsets 从 ref 改为普通数组，绕过 Vue 响应式系统，极大减少开销
let offsets = [] 
const columnHeights = ref([]) // 每列单份数据的高度

// [优化] 新增 stripRefs 和 observers 用于高性能高度检测
const stripRefs = ref([])
const stripHeights = [] // 缓存的高度，普通数组读取最快
let resizeObserver = null

// --- 动画物理引擎状态 ---
const BASE_SPEED = 1.2 // 基础流速
const HOVER_SPEED = 0.15 // 悬停时的慢速
const SCROLL_FACTOR = 2.0 // 滚轮力度系数

let animationFrameId = null
let lastTime = 0
let currentSpeed = BASE_SPEED // 当前实际速度
let targetSpeed = BASE_SPEED // 目标速度（用于 lerp 过渡）
let scrollVelocity = 0 // 滚轮带来的额外速度
let isHovering = false
let hoverEndTime = 0
let lastTouchY = 0
let isModalOpen = false
const isPaused = ref(sessionStorage.getItem('homepage_paused') === 'true')

// Modal 状态
const showModal = ref(false)
const selectedObject = ref(null)
const columnRefs = ref([])

// --- 初始化数据 ---
const initData = async () => {
  try {
    const token = localStorage.getItem('authToken')
    const config = token ? { headers: { 'Authorization': `Bearer ${token}` } } : {}
    
    // 获取对象列表
    const [objRes, tagRes] = await Promise.all([
      axios.get('/api/objects/list', config),
      axios.get('/api/tags/list').catch(() => ({ data: [] })) // 容错
    ])
    
    objects.value = objRes.data
    tags.value = tagRes.data

    generateCards()
    // 等待 DOM 渲染后启动监听
    nextTick(() => {
      initResizeObserver()
      startAnimation()
    })
  } catch (e) {
    console.error("Failed to load data", e)
  }
}

// --- 生成卡片并分列 ---
const generateCards = () => {
  // 1. 扁平化所有图片为卡片
  let allCards = []
  objects.value.forEach(obj => {
    if (obj.cardImages && obj.cardImages.length > 0) {
      obj.cardImages.forEach(img => {
        allCards.push({
          id: obj.id, // 用于查找原对象
          name: obj.name,
          imagePath: obj.basePath + img,
          originalObj: obj,
          loaded: false // 新增：初始加载状态
        })
      })
    }
  })

  // 2. 随机打乱
  allCards = allCards.sort(() => Math.random() - 0.5)

  // 3. 动态计算列数 (简单响应式)
  const w = window.innerWidth
  if (w < 600) columnCount.value = 2
  else if (w < 1000) columnCount.value = 3
  else if (w < 1400) columnCount.value = 4
  else columnCount.value = 5

  // 4. 初始化列数组
  const cols = Array.from({ length: columnCount.value }, () => [])
  
  // 5. 分配卡片 - 均衡分配算法
  allCards.forEach(card => {
    // 策略优化：
    // 1. 找出所有“合法”列（该列末尾不是同一个 Object 的列，避免垂直相邻重复）
    // 2. 在合法列中，找出当前长度最短的列填入，以保证视觉平衡
    
    let validCols = []
    for (let i = 0; i < columnCount.value; i++) {
      const col = cols[i]
      const lastCard = col.length > 0 ? col[col.length - 1] : null
      
      // 如果列为空，或者最后一个卡片属于不同的 object，就是合法的
      if (!lastCard || lastCard.id !== card.id) {
        validCols.push(i)
      }
    }

    // 如果没有合法列（极低概率，说明所有列末尾都是这个 ID），则放宽限制，允许所有列
    const candidates = validCols.length > 0 
      ? validCols 
      : Array.from({ length: columnCount.value }, (_, i) => i)

    // 在候选列中找最短的列 (根据卡片数量)
    // 使用 reduce 寻找最小值对应的索引
    const bestColIndex = candidates.reduce((bestIdx, currentIdx) => {
      return cols[currentIdx].length < cols[bestIdx].length ? currentIdx : bestIdx
    }, candidates[0])

    cols[bestColIndex].push(card)
  })

  // 6. 构建最终的 Columns 数据，每列包含三份数据用于无限滚动
  // [修复] 必须浅拷贝对象，否则 A-B-C 三段克隆体共享同一个 loaded 状态，导致图片状态互相干扰
  columns.value = cols.map(colData => ({
    rawData: colData,
    tripledData: [
      ...colData.map(c => ({ ...c })),
      ...colData.map(c => ({ ...c })),
      ...colData.map(c => ({ ...c }))
    ]
  }))

  // 初始化偏移量
  offsets = new Array(columnCount.value).fill(0)
  columnHeights.value = new Array(columnCount.value).fill(0)
  // 重置 ref 数组
  columnRefs.value = [] 
  stripRefs.value = []
}

// [优化] 使用 ResizeObserver 替代 loop 中的 offsetHeight 读取
const initResizeObserver = () => {
  if (resizeObserver) resizeObserver.disconnect()
  
  resizeObserver = new ResizeObserver(entries => {
    entries.forEach(entry => {
      // 找到对应的 index
      const index = stripRefs.value.indexOf(entry.target)
      if (index !== -1) {
        // 缓存高度，避免在 requestAnimationFrame 中读取 DOM
        stripHeights[index] = entry.contentRect.height
      }
    })
  })

  stripRefs.value.forEach(el => {
    if (el) resizeObserver.observe(el)
  })
}

// --- 动画循环 ---
const updatePhysics = () => {
  if (isHovering && performance.now() > hoverEndTime) {
    isHovering = false
  }

  // 1. 处理目标速度
  let target = (isModalOpen || isPaused.value) ? 0 : (isHovering ? HOVER_SPEED : BASE_SPEED)
  
  // 2. 速度平滑插值 (Lerp)
  // currentSpeed 趋向于 target
  currentSpeed += (target - currentSpeed) * 0.05

  // 3. 滚轮速度衰减
  scrollVelocity *= 0.92 // 阻尼系数
  if (Math.abs(scrollVelocity) < 0.1) scrollVelocity = 0

  // 最终应用速度 = 基础流速 + 滚轮冲量
  // [优化] 如果速度极小且没有滚轮输入，可以暂停计算（可选，这里为了流畅保持运行）
  
  // 4. 更新每一列
  const strips = stripRefs.value
  for (let index = 0; index < columnCount.value; index++) {
    let direction = index % 2 === 0 ? 1 : -1
    let moveStep = (currentSpeed * direction) + scrollVelocity

    // 更新位置 (操作普通数组)
    offsets[index] += moveStep

    // 5. 无限滚动重置逻辑
    // [优化] 直接读取缓存的高度变量，不再接触 DOM
    const totalHeight = stripHeights[index] || 0
    
    if (totalHeight > 0) {
      const singleHeight = totalHeight / 3
      
      if (offsets[index] > 0) {
        offsets[index] -= singleHeight
      } else if (offsets[index] < -singleHeight * 2) {
        offsets[index] += singleHeight
      }
    }

    // [优化] 直接操作 DOM style，跳过 Vue Diff
    const el = strips[index]
    if (el) {
      el.style.transform = `translate3d(0, ${offsets[index]}px, 0)`
    }
  }

  animationFrameId = requestAnimationFrame(updatePhysics)
}

const startAnimation = () => {
  // 初始稍微偏移一点，让它不完全对齐
  offsets = new Array(columnCount.value).fill(0).map((_, i) => i % 2 === 0 ? -100 : -200)
  updatePhysics()
}

// --- 事件处理 ---

const handleWheel = (e) => {
  // 滚轮向下(deltaY > 0)，页面内容应该向上走，看起来像是在浏览下面的内容
  // 或者：滚轮向下，瀑布流整体加速向下流？
  // 通常网页习惯：滚轮向下 -> 内容向上跑 -> 浏览下部。
  // 但这是自动播放的瀑布流。
  // 这里设定：滚轮向下(正) -> 产生负向速度 (内容向上)
  scrollVelocity -= e.deltaY * 0.05
  
  // 唤醒流速 (如果之前停了)
  resetIdleTimer()
}

const handleTouchStart = (e) => {
  if (e.touches.length > 0) {
    lastTouchY = e.touches[0].clientY
  }
  resetIdleTimer()
}

const handleTouchMove = (e) => {
  if (isModalOpen || e.touches.length === 0) return
  
  const currentY = e.touches[0].clientY
  const deltaY = currentY - lastTouchY
  lastTouchY = currentY
  
  // 触摸灵敏度系数，手动滑动
  scrollVelocity += deltaY * 0.1
  
  resetIdleTimer()
}

const handleMouseMove = () => {
  if (isModalOpen) return
  resetIdleTimer()
}

const resetIdleTimer = () => {
  hoverEndTime = performance.now() + 1500
  isHovering = true
}

const togglePause = () => {
  isPaused.value = !isPaused.value
  sessionStorage.setItem('homepage_paused', isPaused.value)
}

const handleCardClick = (card) => {
  selectedObject.value = card.originalObj
  showModal.value = true
  isModalOpen = true
}

const closeModal = () => {
  showModal.value = false
  setTimeout(() => {
    isModalOpen = false
    selectedObject.value = null
  }, 300) // 等待淡出动画
}

const navigateToDetail = (id) => {
  router.push(`/object/${id}`)
}

// 生命周期
onMounted(() => {
  initData()
  // 窗口大小改变重置列（简化版：直接刷新页面最安全，或者只更新高度计算）
  window.addEventListener('resize', generateCards)
})

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (resizeObserver) resizeObserver.disconnect() // 清理 Observer
  window.removeEventListener('resize', generateCards)
})
</script>

<style scoped>
.waterfall-container {
  position: fixed; /* 填满屏幕，禁止默认滚动 */
  top: 0; left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #f9f9f9;
  z-index: 1;
}

.columns-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 20px;
  padding: 0 20px;
  justify-content: center;
  transition: filter 0.5s ease;
}

.columns-wrapper.blur-bg {
  filter: blur(15px);
  transform: scale(0.98); /* 配合模糊做一点点后退效果 */
}

.column {
  flex: 1;
  height: 100%;
  position: relative;
  /* 也就是视口窗口 */
  overflow: visible; /* 为了调试，实际上我们在父级hidden了 */
}

.inner-strip {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  /* 高度由内容撑开 */
  will-change: transform;
}

.card-item {
  width: 100%;
  margin-bottom: 25px; /* 卡片间距 */
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 0px 15px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: transform 0.3s ease;
}

/* 鼠标悬停在卡片上时的效果 */
.card-item:hover .card-img {
  transform: scale(1.05);
}

/* 整个卡片流减速时，卡片不会变大，只有鼠标悬停的那个会变大 */

.card-image-wrapper {
  width: 100%;
  overflow: hidden;
  font-size: 0; /* 消除图片底部间隙 */
  position: relative; /* 为绝对定位的 placeholder 提供锚点 */
  background-color: #ffffff; /* [修改] 默认为白色背景，确保透明图片显示白底 */
}

/* 仅在加载未完成时应用最小高度，防止宽图下方出现灰条 */
.card-image-wrapper.is-loading {
  min-height: 150px;
  background-color: #f5f5f7; /* [新增] 仅在加载中显示灰色占位背景 */
}

/* 加载占位层 */
.loading-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

/* 复用 ObjectDetailPage 的动画，但调整颜色以适应白底 */
.spinner { 
  width: 24px; 
  height: 24px; 
  border: 2px solid #e1e1e1; 
  border-top-color: #666; 
  border-radius: 50%; 
  animation: s 0.8s linear infinite; 
}
@keyframes s { to { transform: rotate(360deg); } }

.card-img {
  width: 100%;
  height: auto;
  display: block;
  transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.4s ease;
  opacity: 0; /* 默认不可见 */
}

.card-img.img-visible {
  opacity: 1; /* 加载完成后显示 */
}

.card-info {
  padding: 10px 16px 12px 16px;
  background: white;
}

.card-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 背景透明，因为我们在 columns-wrapper 上加了 blur */
  background: rgba(255, 255, 255, 0.2); 
}

.modal-content {
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  position: relative;
  scrollbar-width: none;
  z-index: 1001;
}

/* Vue Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.play-pause-btn {
  position: fixed;
  bottom: 40px;
  right: 40px;
  z-index: 900;
  
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.4);
  
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease, transform 0.3s ease;
  color: #555;
}

.play-pause-btn:hover {
  background: rgba(200, 200, 200, 0.5); 
  transform: scale(1.05);
}

.icon-wrapper {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.1s;
}

.icon-mask {
  /* 通用属性 */
  box-sizing: content-box;
  -webkit-mask-origin: content-box;
  mask-origin: content-box;

  background-color: #555555;
  
  -webkit-mask-size: contain;
  mask-size: contain;
  
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  
  -webkit-mask-position: center;
  mask-position: center;

  transform: translateZ(0);
  
  flex-shrink: 0;
}

.play-icon {
  width: 20px; 
  height: 20px;
  padding: 2px;
  /* margin-left: 2px */
}

.pause-icon {
  width: 20px; 
  height: 20px;
  padding: 2px;
  margin-left: 0px
}
</style>