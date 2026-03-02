<template>
  <div id="app-wrapper">
    <NavBar />
    <main class="page-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import '@fontsource-variable/noto-sans-sc'
import yaml from 'js-yaml'

const fetchSiteInfo = async () => {
  try {
    const response = await fetch('/api/static/site/info.yaml')
    const text = await response.text()
    const data = yaml.load(text)
    
    if (data.site_name) {
      document.title = data.site_name
    }
    
    if (data.site_icon) {
      // 同时更新标准图标和 Apple 图标
      const iconLink = document.querySelector('link[rel="icon"]')
      const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]')
      
      if (iconLink) iconLink.setAttribute('href', data.site_icon)
      if (appleIconLink) appleIconLink.setAttribute('href', data.site_icon)
    }
  } catch (error) {
    console.error('Error fetching site info:', error)
  }
}

onMounted(() => {
  fetchSiteInfo()
})

const viewportMeta = document.querySelector('meta[name="viewport"]')
const viewportContent = 'width=720, user-scalable=yes'

if (viewportMeta) {
  viewportMeta.setAttribute('content', viewportContent)
} else {
  const meta = document.createElement('meta')
  meta.name = 'viewport'
  meta.content = viewportContent
  document.head.appendChild(meta)
}

</script>

<style>
/* 彻底清除边距，确保坐标系一致 */
* { 
  margin: 0;
  padding: 0;
  box-sizing: border-box; 
}

body, html, #app {
  font-family: 'Noto Sans SC Variable', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #333333;
  background-color: #f9f9f9;
  z-index: -2;
}

.page-main {
  width: 100%;
  min-height: 100%;
  padding: 42px 0 0 0;
}
</style>