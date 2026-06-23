import { createApp } from 'vue'
import App from './App.vue'
import { initTheme } from './utils/theme'
import { initSpeech } from './utils/speech'

// 初始化主题（适配 HA 暗色模式）
initTheme('auto')

// 预加载语音引擎
initSpeech()

const app = createApp(App)
app.mount('#app')
