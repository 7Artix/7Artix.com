<template>
  <div class="object-card">
    <router-link :to="`/object/${obj.id}`" class="card-hero">
      <div class="hero-img" :style="{ backgroundImage: `url(${obj.basePath + obj.coverImage})` }"></div>
      <div class="hero-overlay">
        <p class="description">{{ obj.description }}</p>
      </div>
      
      <!-- Tags Container (Top Left) -->
      <div class="hero-badges">
        <!-- [NEW] Type Badge -->
        <div class="badge-capsule type" :class="getTypeClass(obj.type)">
          <span>{{ obj.type }}</span>
        </div>
        <!-- ID Badge (admin only) -->
        <div v-if="mode === 'admin'" class="badge-capsule id-badge">
          <span>{{ obj.id }}</span>
        </div>
      </div>

      <!-- Pinned Badge (Top Right) -->
      <div v-if="isPinned" class="badge-capsule pinned" :class="{ 'admin-offset': mode === 'admin' }">
        <span>Pinned</span>
      </div>

      <!-- View Counter (Bottom Left of Image Area - Admin Only) -->
      <div v-if="mode === 'admin' && obj.views !== undefined" class="view-counter">
        <svg viewBox="0 0 24 24"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" /></svg>
        <span>{{ obj.views }}</span>
      </div>
    </router-link>

    <!-- Admin Controls -->
    <div v-if="mode === 'admin'" class="admin-traffic-lights">
      <button class="traffic-btn pin" :class="{ active: isPinned }" @click.stop="$emit('toggle-pin', obj.id)">
        <svg viewBox="0 0 24 24"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg>
      </button>
      <button class="traffic-btn edit" @click.stop="$emit('edit', obj)">
        <svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" /></svg>
      </button>
      <button class="traffic-btn close" @click.stop="$emit('delete', obj.id)">
        <svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" /></svg>
      </button>
    </div>

    <div class="card-footer">
      <router-link :to="`/object/${obj.id}`" class="title-link">
        <h3 class="title scroll-fade">{{ obj.name }}</h3>
      </router-link>
      <div class="meta-bottom">
        <div class="tag-list scroll-fade">
          <!-- 修改部分: 使用 MiniTag 组件 -->
          <MiniTag 
            v-for="tid in obj.tags" 
            :key="tid" 
            :id="tid" 
            :name="getTagName(tid)" 
          />
        </div>
        <span class="date">{{ formatDate(obj.dateCreated) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import MiniTag from './MiniTag.vue'

const props = defineProps({
  obj: { type: Object, required: true },
  mode: { type: String, default: '' },
  isPinned: { type: Boolean, default: false },
  allTags: { type: Array, default: () => [] }
})

const emit = defineEmits(['view', 'toggle-pin', 'edit', 'delete'])

const getTagName = (id) => props.allTags.find(t => t.id === id)?.name || id
const formatDate = (iso) => new Date(iso).toLocaleDateString()

const getTypeClass = (type) => {
  if (type === 'post') return 'blue-bg'
  if (type === 'project') return 'orange-bg'
  return ''
}
</script>

<style scoped>
.object-card { background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.05); transition: box-shadow 0.4s; position: relative; z-index: 1000; user-select: none; -webkit-user-select: none; }
.card-hero { position: relative; aspect-ratio: 1 / 1; cursor: pointer; overflow: hidden; display: block; text-decoration: none; color: inherit; }
.hero-img { width: 100%; height: 100%; background-size: cover; background-position: center; transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1); }
.hero-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; padding: 30px; opacity: 0; transition: 0.4s; backdrop-filter: blur(8px); }
@media (hover: hover) {
  .object-card:hover .hero-img { transform: scale(1.05); }
  .object-card:hover .hero-overlay { opacity: 1; }
}
.description { color: white; text-align: start; font-size: 18px; line-height: 1.5; }

/* Badges Container */
.hero-badges { position: absolute; top: 15px; left: 15px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }

.badge-capsule {
  backdrop-filter: blur(10px);
  padding: 4px 10px; border-radius: 20px;
  color: white; font-size: 12px; font-weight: 600; text-transform: uppercase;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.5;
}
.badge-capsule.pinned { 
  background: rgba(50, 215, 75, 0.6); 
  position: absolute;
  top: 15px;
  right: 15px;
  transition: top 0.3s ease;
  z-index: 5;
}
.badge-capsule.pinned.admin-offset {
  top: 55px;
}
.badge-capsule.type { background: rgba(0, 0, 0, 0.4); }
.badge-capsule.type.blue-bg { background: rgba(0, 122, 255, 0.6); }
.badge-capsule.type.orange-bg { background: rgba(255, 149, 0, 0.6); }

/* object id */
.badge-capsule.id-badge {
  background: rgba(120, 120, 120, 0.6);
  letter-spacing: 0.5px;
}

.admin-traffic-lights {
  position: absolute; top: 15px; right: 15px;
  display: flex; gap: 8px; z-index: 10;
  background: rgba(0,0,0,0.15); backdrop-filter: blur(8px);
  padding: 6px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
}
.traffic-btn { width: 14px; height: 14px; border-radius: 50%; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; transition: 0.2s; position: relative; }
.traffic-btn svg { width: 8px; height: 8px; fill: rgba(0,0,0,0.5); display: none; }
.traffic-btn:hover { transform: scale(1.1); }
.traffic-btn:hover svg { display: block; }
.traffic-btn.pin { background: #32d74b; }
.traffic-btn.pin.active { box-shadow: inset 0 0 0 2px rgba(0,0,0,0.3); }
.traffic-btn.edit { background: #ffcc00; }
.traffic-btn.close { background: #ff453a; }
.traffic-btn.close svg { fill: rgba(50,0,0,0.6); }

.view-counter {
  position: absolute; bottom: 15px; left: 15px;
  background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px);
  padding: 4px 10px; border-radius: 20px;
  display: flex; align-items: center; gap: 6px;
  color: rgba(255, 255, 255, 0.9); font-size: 12px; font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 10; pointer-events: none;
}
.view-counter svg { width: 14px; height: 14px; fill: currentColor; display: block; }
.view-counter span { line-height: 1; padding-bottom: 2px; }

.card-footer { padding: 8px 16px 16px 16px; }
.title { font-weight: 600; font-size: 22px; margin-bottom: 12px; margin-top: 0px; color: #1d1d1f; }
.meta-bottom { display: flex; align-items: center; justify-content: space-between; overflow: hidden; }
.scroll-fade { white-space: nowrap; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; mask-image: linear-gradient(to right, black 95%, transparent 100%); -webkit-mask-image: linear-gradient(to right, black 95%, transparent 100%); }
.scroll-fade::-webkit-scrollbar { display: none; }
.tag-list { display: flex;
  align-items: center;
  flex: 1;
  margin-right: 15px;
  padding: 5px;
}

.date { font-size: 12px; color: #86868b; flex-shrink: 0; }
.title-link { text-decoration: none; color: inherit; display: block; }
</style>