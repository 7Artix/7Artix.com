<template>
  <div class="objects-page">
    <transition name="bg-fade">
      <DynamicWave v-if="filteredObjects.length === 0"></DynamicWave>
    </transition>

    <!-- Profile List -->
    <section class="cards-container">
      <ObjectProfile
        v-for="obj in filteredObjects" 
        :key="obj.id" 
        :obj="obj"
        mode="view"
        :is-pinned="isPinned(obj.id)"
        :all-tags="allTags"
        @view="viewDetail"
        @toggle-pin="togglePin"
      />
    </section>

    <!-- footer -->
    <PageFooter/>

    <!-- Floating tools at the corner -->
    <div class="corner-stack">

      <!-- Back to Top -->
      <BackTop/>

      <SortControl 
        ref="sortControlRef"
        v-model="sortState"
        @open="handleSortOpen"
      />
      
      <!-- Backdrop for mobile interactions -->
      <Teleport to="body">
        <div v-if="showAllTags || (isHoveringSearch && searchQuery.length === 0)" class="page-backdrop" @click="closeBackdrop"></div>
      </Teleport>

      <!-- fixed tags -->
      <div v-if="selectedTags.length > 0" class="selected-tags-stack">
        <transition-group name="list-vertical">
          <span v-for="tid in selectedTags" :key="tid" class="tag-pill active" @click="toggleTag(tid)">
            {{ getTagName(tid) }} <span class="close-icon">×</span>
          </span>
        </transition-group>

        <!-- Limit Toast Notification -->
        <transition name="fade">
          <div v-if="showLimitToast" class="limit-toast">
            <span>Maximum 7 tags allowed</span>
          </div>
        </transition>
      </div>

      <!-- All tags box -->
      <div 
        class="tags-drawer-wrapper"
        ref="tagsDrawerRef"
        @mouseenter="handleTagsMouseEnter"
        @mouseleave="handleTagsMouseLeave"
        @click="toggleTags"
      >
        <div class="blur-glow-bg tags-glow" :class="{ visible: showAllTags }"></div>

        <div class="tags-drawer-content" :class="{ open: showAllTags }">
          <div class="hash-icon-wrapper" :class="{ hidden: showAllTags }">
            <div class="hash-icon-mask"
              :style="{ maskImage: `url(/api/static/site/icons/number.svg)`, WebkitMaskImage: `url(/api/static/site/icons/number.svg)` }">
            </div>
          </div>

          <div class="drawer-inner" :class="{ visible: showAllTags }">
            <div class="drawer-scroll-area">
              <div class="tags-flex-grid">
                <div v-for="tag in unselectedTags" :key="tag.id" class="tag-pill normal" @click.stop="toggleTag(tag.id)">
                  {{ tag.name }} <span class="count">{{ tag.count }}</span>
                </div>
              </div>
            </div>
            
            <div class="drawer-bottom-bar">
              <span v-if="selectedTags.length === 0">All Tags ({{ unselectedTags.length }})</span>
              <span v-else class="clear-btn" @click.stop="selectedTags = []">
                Clear Selection
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="search-wrapper" 
           ref="searchWrapperRef"
           @mouseenter="handleSearchMouseEnter"
           @mouseleave="handleSearchMouseLeave"
           @click="handleSearchClick">
        
        <div class="blur-glow-bg search-glow" :class="{ visible: isSearchExpanded }"></div>
        
        <div class="search-interactive-box" 
             :class="{ 
               'expanded-width': isSearchExpanded, 
               'expanded-list': showSearchResults 
             }">
          
          <div class="search-input-area">
            <input 
              v-model="searchQuery" 
              placeholder="Search..." 
              ref="searchInput"
              :class="{ visible: isSearchExpanded }"
            />
            <div class="search-icon-wrapper" @click="clearSearch">
              <div v-if="searchQuery" class="search-clear-icon-wrapper">
                <div class="search-clear-icon-mask"
                  :style="{ maskImage: `url(/api/static/site/icons/xmark.svg)`, WebkitMaskImage: `url(/api/static/site/icons/xmark.svg)` }">
                </div>
              </div>
              <div v-else="searchQuery" class="search-mag-icon-wrapper">
                <div class="search-mag-icon-mask"
                  :style="{ maskImage: `url(/api/static/site/icons/magnifyingglass.svg)`, WebkitMaskImage: `url(/api/static/site/icons/magnifyingglass.svg)` }">
                </div>
              </div>
            </div>
          </div>

          <div class="search-results-list">
            <div class="results-inner-padding">
              <div v-if="tagSuggestions.length > 0" class="tags-flex-grid">
                <div v-for="tag in tagSuggestions" :key="tag.id" class="tag-pill normal" @click="toggleTag(tag.id)">
                  {{ tag.name }}
                </div>
              </div>
              <div v-else class="no-results">No matching tags</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ObjectProfile from '../components/ObjectProfile.vue' 
import PageFooter from '../components/PageFooter.vue'
import { NAV_HEIGHT } from '../config/constants'
import BackTop from '../components/BackTop.vue'
import DynamicWave from '../components/DynamicWave.vue'
import SortControl from '../components/SortControl.vue' // Import SortControl

const props = defineProps(['type'])
const router = useRouter()
const route = useRoute()

const allObjects = ref([])
const allTags = ref([])
const pinnedIds = ref([])
const searchQuery = ref('')
const selectedTags = ref([])
const showAllTags = ref(false)
const showLimitToast = ref(false)
const sortState = ref({ field: 'date', order: 'desc' }) // Add sort state

const isHoveringSearch = ref(false)
const searchInput = ref(null)
const tagsDrawerRef = ref(null)
const searchWrapperRef = ref(null)
const sortControlRef = ref(null)
const isMobile = ref(false)

const isSearchExpanded = computed(() => isHoveringSearch.value || searchQuery.value.length > 0)
const showSearchResults = computed(() => isHoveringSearch.value && searchQuery.value.length > 0 && tagSuggestions.value.length > 0)

const filteredObjects = computed(() => {
  let list = allObjects.value.filter(obj => {
    if (props.type && props.type !== 'all' && obj.type !== props.type) return false
    const q = searchQuery.value.toLowerCase()
    const matchText = obj.name.toLowerCase().includes(q) || (obj.description && obj.description.toLowerCase().includes(q))
    const matchTags = selectedTags.value.every(tid => obj.tags && obj.tags.includes(tid))
    return matchText && matchTags
  })

  return list.sort((a, b) => {
    const isAPinned = pinnedIds.value.includes(a.id)
    const isBPinned = pinnedIds.value.includes(b.id)
    if (isAPinned && !isBPinned) return -1
    if (!isAPinned && isBPinned) return 1
    
    // Internal Sort Logic
    let valA, valB
    
    if (sortState.value.field === 'views') {
        valA = a.views || 0
        valB = b.views || 0
    } else {
        // Default: Date Created
        // Ensure we parse the date string correctly and handle potential errors
        const dA = new Date(a.dateCreated)
        const dB = new Date(b.dateCreated)
        valA = isNaN(dA.getTime()) ? 0 : dA.getTime()
        valB = isNaN(dB.getTime()) ? 0 : dB.getTime()
    }

    if (valA !== valB) {
        return sortState.value.order === 'asc' ? valA - valB : valB - valA
    }
    
    // Tie-breaker: stable sort using ID if values are equal
    return a.id.localeCompare(b.id)
  })
})

const unselectedTags = computed(() => allTags.value.filter(t => !selectedTags.value.includes(t.id)))
const tagSuggestions = computed(() => {
  if (!searchQuery.value) return []
  return allTags.value.filter(t => t.name.toLowerCase().includes(searchQuery.value.toLowerCase()) && !selectedTags.value.includes(t.id))
})

const init = async () => {
  const token = localStorage.getItem('authToken')
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
  
  const [oRes, tRes, pRes] = await Promise.all([
    fetch('/api/objects/list', { headers }), 
    fetch('/api/tags/list'),
    fetch('/api/pinned/list')
  ])
  allObjects.value = await oRes.json()
  allTags.value = await tRes.json()
  pinnedIds.value = await pRes.json()
  applyUrlParams()
}

const applyUrlParams = () => {
  const tagParam = route.query.tag
  if (tagParam && allTags.value.length > 0) {
    const targetTag = allTags.value.find(t => t.name.toLowerCase() === tagParam.toLowerCase())
    if (targetTag) selectedTags.value = [targetTag.id]
  } else {
    selectedTags.value = []
  }
}

watch(() => route.query.tag, applyUrlParams)

const checkMobile = () => {
    isMobile.value = window.innerWidth <= 768 || ('ontouchstart' in window)
}

const closeOthers = (exclude) => {
    if (exclude !== 'tags') showAllTags.value = false
    if (exclude !== 'search') isHoveringSearch.value = false
    if (exclude !== 'sort' && sortControlRef.value) sortControlRef.value.close()
}

const handleTagsMouseEnter = () => { 
    if (!isMobile.value) { 
        showAllTags.value = true 
        closeOthers('tags')
    } 
}
const handleTagsMouseLeave = () => { if (!isMobile.value) showAllTags.value = false }
const toggleTags = () => { 
    if (isMobile.value) { 
        showAllTags.value = !showAllTags.value 
        if (showAllTags.value) closeOthers('tags')
    }
}

const handleSearchMouseEnter = () => { 
    if (!isMobile.value) { 
        isHoveringSearch.value = true 
        closeOthers('search')
    } 
}
const handleSearchMouseLeave = () => { if (!isMobile.value) isHoveringSearch.value = false }
const handleSearchClick = () => { 
    if (isMobile.value && !isSearchExpanded.value) {
        isHoveringSearch.value = true
        closeOthers('search')
    }
}

const handleSortOpen = () => {
    closeOthers('sort')
}

const closeBackdrop = () => {
    showAllTags.value = false
    isHoveringSearch.value = false
}

onMounted(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    init()
})

onUnmounted(() => {
    window.removeEventListener('resize', checkMobile)
})

const clearSearch = () => {
  if (searchQuery.value) {
    searchQuery.value = ''
    searchInput.value?.focus()
  }
}

const toggleTag = (id) => {
  const index = selectedTags.value.indexOf(id)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    if (selectedTags.value.length >= 7) {
      showLimitToast.value = true
      setTimeout(() => showLimitToast.value = false, 2500)
      return
    }
    selectedTags.value.unshift(id)
  }
  searchQuery.value = ''
}

const getTagName = (id) => allTags.value.find(t => t.id === id)?.name || id
const isPinned = (id) => pinnedIds.value.includes(id)

const togglePin = async (id) => {
  const token = localStorage.getItem('authToken')
  if (!token) return

  let newPinned = [...pinnedIds.value]
  if (newPinned.includes(id)) newPinned = newPinned.filter(pid => pid !== id)
  else newPinned.push(id)
  
  const res = await fetch('/api/pinned/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(newPinned)
  })
  if ((await res.json()).success) pinnedIds.value = newPinned
}

const viewDetail = (id) => router.push(`/object/${id}`)
</script>

<style scoped>
.bg-fade-enter-active,
.bg-fade-leave-active {
    transition: opacity 1s ease;
}

.bg-fade-enter-from,
.bg-fade-leave-to {
    opacity: 0;
}
/* --- Layout --- */
.objects-page {
  display: flex;
  flex-direction: column;
  padding-top: 0;
  min-height: calc(100vh - v-bind(NAV_HEIGHT));
  background: #f9f9f9;
  padding-bottom: 0;
}
.cards-container { 
  flex: 1; 
  display: grid; 
  /* 修改: 减小最小宽度 (350px -> 260px)，让电脑端排列更密 */
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
  gap: 30px; 
  padding: 30px; 
  align-content: flex-start; 
}

/* 新增: 针对手机屏幕的优化 (两列显示) */
@media (max-width: 768px) {
  .cards-container {
    padding: 30px;
    gap: 30px;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
}

/* --- Corner Stack --- */
.corner-stack { position: fixed; bottom: 40px; right: 40px; z-index: 3000; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; pointer-events: none; }
.corner-stack > * { pointer-events: auto; }

.blur-glow-bg {
  position: absolute; pointer-events: none; z-index: -1;
  background: rgba(255, 255, 255, 0.4); 
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  mask-image: radial-gradient(closest-side, black 40%, transparent 100%);
  -webkit-mask-image: radial-gradient(closest-side, black 40%, transparent 100%);
  opacity: 0; transition: opacity 0.4s;
}
.blur-glow-bg.visible { opacity: 1; }
.search-glow { top: 50%; left: 50%; width: 350px; height: 100px; transform: translate(-50%, -50%); }
.tags-glow { top: auto; bottom: 0; right: 0; width: 350px; height: 350px; }
.create-glow { top: 50%; left: 50%; width: 80px; height: 80px; transform: translate(-50%, -50%); mask-image: radial-gradient(circle, black 30%, transparent 70%); }

/* Limit Toast */
.limit-toast {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  color: white; padding: 8px 16px; border-radius: 20px;
  font-size: 12px; font-weight: 500;
  pointer-events: none; margin-bottom: 5px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.2);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Selected Tags */
.selected-tags-stack {
  display: flex; flex-direction: column-reverse;
  gap: 8px; align-items: flex-end;
  padding: 20px; margin-right: -20px; margin-bottom: -20px; margin-top: -20px;
}

.tag-pill { cursor: pointer; font-size: 12px; padding: 6px 10px 6px 12px; border-radius: 20px; transition: 0.2s; white-space: nowrap; user-select: none; }
.tag-pill.active { 
  background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  color: #1d1d1f; border: 1px solid rgba(255,255,255,0.4);
  display: flex; align-items: center; gap: 8px;
}
.tag-pill.active:hover { background: rgba(255, 255, 255, 0.6); }

.close-icon { font-style: normal; font-size: 16px; line-height: 1; color: #555555; transition: color 0.2s; }
.tag-pill.active:hover .close-icon { color: #000; }

/* --- All Tags Drawer --- */
.tags-drawer-wrapper { position: relative; display: flex; flex-direction: column; align-items: flex-end; }
.tags-drawer-content {
  width: 50px; height: 50px; border-radius: 25px;
  background: rgba(255, 255, 255, 0.4); 
  backdrop-filter: blur(16px);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255,255,255,0.4);
  display: flex; flex-direction: column; position: relative; overflow: hidden;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: bottom right;
}
.tags-drawer-content.open { width: 320px; height: 320px; }

.hash-icon-wrapper {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    transition: opacity 0.1s;
    overflow: visible;
}
.hash-icon-wrapper.hidden { opacity: 0; pointer-events: none; }

.hash-icon-mask {
  width: 20px; 
  height: 20px;
  
  background-color: #555555;
  
  -webkit-mask-size: contain;
  mask-size: contain;
  
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  
  -webkit-mask-position: center;
  mask-position: center;
  
  flex-shrink: 0;
}

.search-mag-icon-wrapper {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    transition: opacity 0.1s;
    overflow: visible;
}
.search-mag-icon-wrapper.hidden { opacity: 0; pointer-events: none; }

.search-mag-icon-mask {
  width: 18px; 
  height: 18px;
  
  background-color: #555555;
  
  -webkit-mask-size: contain;
  mask-size: contain;
  
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  
  -webkit-mask-position: center;
  mask-position: center;
  position: relative;
  left: 1px;
  
  flex-shrink: 0;
}

.search-clear-icon-wrapper {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    transition: opacity 0.1s;
    overflow: visible;
}
.search-clear-icon-wrapper.hidden { opacity: 0; pointer-events: none; }

.search-clear-icon-mask {
  width: 12px; 
  height: 12px;
  
  background-color: #555555;
  
  -webkit-mask-size: contain;
  mask-size: contain;
  
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  
  -webkit-mask-position: center;
  mask-position: center;
  position: relative;
  left: 1px;
  
  flex-shrink: 0;
}

.drawer-inner { display: flex; flex-direction: column; height: 100%; width: 100%; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.drawer-inner.visible { opacity: 1; transition-delay: 0.1s; pointer-events: auto; }
.drawer-bottom-bar { padding: 10px 16px; font-size: 11px; color: #888; border-top: 1px solid rgba(0,0,0,0.04); text-transform: uppercase; letter-spacing: 0.5px; margin-top: auto; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; }
.clear-btn { color: #ff3b30; cursor: pointer; transition: 0.2s; }
.clear-btn:hover { opacity: 0.7; }
.drawer-scroll-area { flex: 1; overflow-y: auto; padding: 12px; min-height: 0; }
.tags-flex-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-pill.normal { background: rgba(0, 0, 0, 0.05); color: #555555; display: inline-flex; align-items: center; padding: 6px 10px 6px 12px; }
.tag-pill.normal:hover { background: #fff; border-color: rgba(0,0,0,0.1); box-shadow: 0 0 20px rgba(0, 0, 0, 0.1); }
.tag-pill .count { font-size: 9px; opacity: 0.4; margin-left: 4px; vertical-align: top; }
.tag-mini-actions { margin-left: 6px; display: flex; gap: 4px; opacity: 0.4; transition: 0.2s; }
.tag-pill.normal:hover .tag-mini-actions { opacity: 1; }
.mini-btn { cursor: pointer; padding: 0 2px; }
.mini-btn.danger:hover { color: red; }

/* --- Search Bar (Refactored) --- */
.search-wrapper { position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-end; }

.search-interactive-box {
  background: rgba(255, 255, 255, 0.4); 
  backdrop-filter: blur(16px);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 25px; /* Circle State */
  width: 50px; /* Circle State */
  height: auto; /* Allow growth */
  max-height: 50px; /* Circle State limit */
  display: flex; flex-direction: column-reverse; /* Key to expanding upwards */
  overflow: hidden;
  transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), 
              max-height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), 
              background 0.2s, 
              border-radius 0.4s;
  position: relative; z-index: 2;
}

/* State 2: Capsule (Expanded Width) */
.search-interactive-box.expanded-width {
  width: 280px;
}

/* State 3: Square/List (Expanded Height) */
.search-interactive-box.expanded-list {
  max-height: 300px; /* Allow height to grow */
}

/* Input Area (Always at bottom) */
.search-input-area {
  height: 50px; flex-shrink: 0; /* Fixed height footer */
  display: flex; align-items: center;
  position: relative; width: 100%;
}

.search-input-area input {
  flex: 1; height: 100%; border: none; background: transparent; outline: none;
  padding-left: 20px; padding-right: 50px; font-size: 15px; width: 100%;
  opacity: 0; transition: opacity 0.3s; pointer-events: none; 
}
.search-input-area input.visible { opacity: 1; pointer-events: auto; }

.search-icon-wrapper {
  width: 50px; height: 50px; position: absolute; right: 0; bottom: 0; 
  display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 3;
}

/* Results List (Top part) */
.search-results-list {
  width: 100%;
  overflow-y: auto;
  /* Scrollbar hidden */
  scrollbar-width: none; -ms-overflow-style: none;
}
.search-results-list::-webkit-scrollbar { display: none; }

.results-inner-padding { padding: 12px; padding-bottom: 0; }
.no-results { font-size: 12px; color: #888; text-align: center; padding: 10px; }

.page-sort-control {
  position: fixed;
  top: 80px;
  right: 40px;
  z-index: 9900;
}

.page-backdrop {
    position: fixed; inset: 0; background: transparent; z-index: 2500;
}
</style>