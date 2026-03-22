<template>
    <article ref="markdownRef" class="markdown-body" v-html="renderedMarkdown"></article>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import katex from '@traptitech/markdown-it-katex'
import 'github-markdown-css/github-markdown-light.css'
import hljs from 'highlight.js'
import 'highlight.js/styles/monokai.css'

const props = defineProps({
    // 方式1：直接传入 Markdown 文本
    content: {
        type: String,
        default: ''
    },
    // 方式2：传入 Markdown 文件路径
    src: {
        type: String,
        default: ''
    },
    assetBase: {
        type: String,
        default: ''
    }
})

const markdownRef = ref(null)
const remoteContent = ref('')

// 监听 src 变化，自动拉取文件内容
watch(() => props.src, async (newPath) => {
    if (newPath) {
        try {
            const res = await fetch(newPath)
            if (res.ok) {
                remoteContent.value = await res.text()
            } else {
                console.warn(`Failed to load markdown from ${newPath}`)
            }
        } catch (e) {
            console.error('Markdown fetch error:', e)
        }
    } else {
        remoteContent.value = ''
    }
}, { immediate: true })

// 语言映射表
const languageMap = {
    'js': 'JavaScript', 'ts': 'TypeScript', 'py': 'Python', 'cpp': 'C++',
    'html': 'HTML', 'css': 'CSS', 'vue': 'Vue', 'sh': 'Shell',
    'bash': 'Bash', 'json': 'JSON', 'md': 'Markdown'
}
const getFullLanguageName = (lang) => {
    if (!lang) return 'CODE'
    return languageMap[lang.toLowerCase()] || lang.toUpperCase()
}

// 初始化 MarkdownIt
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre class="hljs"><code class="language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
            } catch (__) {}
        }
        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
}).use(katex)

const rawContent = computed(() => props.content || remoteContent.value || '')

// 渲染 Markdown 并修复资源路径
const renderedMarkdown = computed(() => {
    if (!rawContent.value) return ''
    
    let raw = rawContent.value
    const baseUrl = props.assetBase
    
    if (baseUrl) {
        raw = raw.replace(/(!\[.*?\]\()(.+?)(\))/g, (match, p1, p2, p3) => {
            const fullPath = p2.startsWith('http') ? p2 : baseUrl + p2
            return p1 + fullPath + p3
        })

        raw = raw.replace(/(<(?:img|video)\b[^>]*?\bsrc\s*=\s*["'])([^"']+?)(["'])/gi, (match, p1, p2, p3) => {
            const fullPath = p2.startsWith('http') || p2.startsWith('/') ? p2 : baseUrl + p2
            return p1 + fullPath + p3
        })
    }

    return md.render(raw)
})

const enhanceCodeBlocks = () => {
    if (!markdownRef.value) return
    const blocks = markdownRef.value.querySelectorAll('pre')
    blocks.forEach((block) => {
        if (block.parentElement.classList.contains('code-wrapper')) return
        const codeNode = block.querySelector('code')
        let lang = '' 
        if (codeNode) {
            const langClass = Array.from(codeNode.classList).find(c => c.startsWith('language-') || c.startsWith('lang-'))
            if (langClass) lang = langClass.replace('language-', '').replace('lang-', '')
        }
        
        const wrapper = document.createElement('div')
        wrapper.className = 'code-wrapper'
        block.parentNode.insertBefore(wrapper, block)
        wrapper.appendChild(block)

        const actionBtn = document.createElement('button')
        actionBtn.className = 'code-action-btn'
        const displayLang = getFullLanguageName(lang)
        actionBtn.innerText = displayLang
        
        actionBtn.onclick = (e) => {
            e.preventDefault()
            const text = codeNode ? codeNode.innerText : block.innerText
            navigator.clipboard.writeText(text).then(() => {
                actionBtn.innerText = 'Copied'
                actionBtn.classList.add('copied')
                setTimeout(() => actionBtn.innerText = displayLang && actionBtn.classList.remove('copied'), 2000)
            })
        }
        wrapper.appendChild(actionBtn)
    })
}

watch(renderedMarkdown, (newContent) => {
    if (newContent) nextTick(enhanceCodeBlocks)
}, { immediate: true })
</script>

<style scoped>
@import "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.4/katex.min.css";

.markdown-body {
    background: transparent;
    font-family: 'Noto Sans SC Variable', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif !important;
    text-align: justify;
}

:deep(.code-wrapper) {
    position: relative;
    margin: 1.5rem 0;
    border-radius: 16px;
    background: #232323;
    border: 6px solid #333333;
    line-height: 0;
    color: #f8f8f2 !important;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.4);
}

:deep(.code-action-btn) {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 6px;
    font-size: 10px;
    font-weight: 500;
    color: #c2c2c2;
    background: transparent;
    border: 0px;
    border-radius: 3px;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;
    backdrop-filter: blur(4px);
    line-height: 1.2;
    font-family: inherit;
}
:deep(.code-action-btn:hover) { background: #555555; }
:deep(.code-action-btn.copied) { color: #73e677; }

:deep(pre.hljs) {
    margin: 0 !important;
    padding: 16px !important;
    background: transparent !important;
    font-size: 13.5px;
    line-height: 1.6 !important;
    overflow-x: auto;
    display: block;
    width: 100%;
    color: inherit !important;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace !important;
}

/* KaTeX 样式微调，保留数学公式字体 */
:deep(.katex) { padding-right: 0.15em !important; padding-left: 0.05em !important; line-height: 1.2; }
:deep(.katex-display) { padding: 1em 0.5em !important; margin: 1em 0; overflow-x: auto; overflow-y: hidden; }
:deep(.katex-html) { overflow: visible !important; }

:deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    text-align: left;
    line-height: 1.5;
}

:deep(h2) {
    font-size: 1.5em;
    border-bottom: none;
}
</style>