<template>
  <div class="app-container">
    <!-- 背景流光与网格层 -->
    <div class="cyber-grid"></div>
    <div class="glow-orb orb-1"></div>
    <div class="glow-orb orb-2"></div>
    <div class="glow-orb orb-3"></div>

    <!-- 顶部状态通知栏 (提示发布成功) -->
    <Transition name="slide-down">
      <div v-if="toastMsg" class="toast-notification">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <span>{{ toastMsg }}</span>
      </div>
    </Transition>

    <header class="app-header">
      <div class="brand">
        <span class="brand-tag">v1.0.0</span>
        <h1 class="glow-text">CYBER SPHERE</h1>
        <p class="subtitle">3D 交互式球形留言空间</p>
      </div>
      <div class="actions">
        <button class="write-btn" @click="isFormOpen = true">
          <span class="btn-glow"></span>
          <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          留下你的声音
        </button>
      </div>
    </header>

    <main class="app-main">
      <!-- Loading 占位状态 -->
      <div v-if="isLoading" class="loading-container">
        <div class="cyber-spinner"></div>
        <p>正在同步球面星轨留言...</p>
      </div>

      <!-- 空留言状态 -->
      <div v-else-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">🪐</div>
        <h3>星轨空无一物</h3>
        <p>目前还没有任何留言，点击右上角按钮成为第一个点亮这颗星球的人吧！</p>
        <button class="write-btn-large" @click="isFormOpen = true">点亮星球</button>
      </div>

      <!-- 3D 留言球 -->
      <div v-else class="ball-wrapper">
        <ThreeDMessageBall :messages="messages" @select="handleSelectMessage" />
      </div>
    </main>

    <footer class="app-footer">
      <p>Powered by Vite + Vue 3 // 智能云文本审查与大模型过滤系统内置</p>
    </footer>

    <!-- 侧边抽屉表单 -->
    <MessageForm 
      :is-open="isFormOpen" 
      :is-submitting="isSubmitting"
      :error-msg="errorMsg"
      @close="isFormOpen = false"
      @submit="handlePublish"
    />

    <!-- 详情弹窗 -->
    <MessageDetail 
      :is-open="isDetailOpen"
      :message="selectedMessage"
      @close="isDetailOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ThreeDMessageBall from './components/ThreeDMessageBall.vue';
import MessageForm from './components/MessageForm.vue';
import MessageDetail from './components/MessageDetail.vue';

interface Message {
  id?: number;
  content: string;
  nickname: string;
  color: string;
  size: number;
  createdAt: string;
}

const API_BASE_URL = 'http://localhost:3000/api';

const messages = ref<Message[]>([]);
const isLoading = ref(true);

// 表单与详情对话框控制
const isFormOpen = ref(false);
const isSubmitting = ref(false);
const errorMsg = ref('');

const isDetailOpen = ref(false);
const selectedMessage = ref<Message | null>(null);

// Toast 提示
const toastMsg = ref('');

// 获取所有已通过的留言列表
const fetchMessages = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/messages`);
    const result = await response.json();
    if (result.success) {
      messages.value = result.data;
    }
  } catch (error) {
    console.error('获取留言列表异常:', error);
  } finally {
    isLoading.value = false;
  }
};

// 提交新留言并进行安全审核
const handlePublish = async (formData: { content: string; nickname: string; color: string }) => {
  isSubmitting.value = ref(true).value;
  errorMsg.value = '';

  try {
    const response = await fetch(`${API_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: formData.content,
        nickname: formData.nickname,
        color: formData.color,
        size: Math.floor(Math.random() * 3) + 1 // 随机 1 到 3 的尺寸权重
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      // 发布成功
      isFormOpen.value = false;
      showToast('留言成功！您的心声已点亮星轨');
      fetchMessages(); // 重新加载数据
    } else {
      // 被内容安全拦截或有其他错误
      errorMsg.value = result.message || '发布留言失败';
    }
  } catch (error: any) {
    errorMsg.value = '服务器连接失败，请稍后再试';
    console.error('提交留言异常:', error);
  } finally {
    isSubmitting.value = false;
  }
};

// 显示 Toast 成功提示
const showToast = (msg: string) => {
  toastMsg.value = msg;
  setTimeout(() => {
    toastMsg.value = '';
  }, 4000);
};

// 查看留言详情
const handleSelectMessage = (message: Message) => {
  selectedMessage.value = message;
  isDetailOpen.value = true;
};

onMounted(() => {
  fetchMessages();
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Outfit:wght@600;800;900&display=swap');

/* 全局重置与基本变量 */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  background-color: #080b16;
  color: #f1f5f9;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow-x: hidden;
}

/* 主容器 */
.app-container {
  min-height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding: 30px;
}

/* 霓虹发光底色球 */
.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  z-index: 0;
  opacity: 0.15;
  pointer-events: none;
}
.orb-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #ff007f 0%, transparent 70%);
  top: -100px;
  left: -100px;
  animation: floatOrb 20s infinite alternate;
}
.orb-2 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #00f0ff 0%, transparent 70%);
  bottom: -200px;
  right: -100px;
  animation: floatOrb 25s infinite alternate-reverse;
}
.orb-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #ab00ff 0%, transparent 70%);
  top: 40%;
  left: 60%;
  animation: floatOrb 18s infinite alternate;
}

@keyframes floatOrb {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(50px, 30px) scale(1.1); }
}

/* 赛博网格层 */
.cyber-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 50px 50px;
  background-position: center;
  z-index: 0;
  pointer-events: none;
  mask-image: radial-gradient(ellipse 60% 50% at 50% 50%, #000 60%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 50%, #000 60%, transparent 100%);
}

/* 头部样式 */
.app-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto 30px auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 20px;
}

.brand {
  text-align: left;
}

.brand-tag {
  background: linear-gradient(90deg, rgba(255, 0, 127, 0.2), rgba(0, 240, 255, 0.2));
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 20px;
  color: #00f0ff;
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  display: inline-block;
  margin-bottom: 10px;
}

.glow-text {
  font-family: 'Outfit', sans-serif;
  font-weight: 900;
  font-size: 2.5rem;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #fff 30%, #00f0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 30px rgba(0, 240, 255, 0.2);
}

.subtitle {
  color: #64748b;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 1px;
}

/* 按钮效果 */
.write-btn {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  padding: 14px 28px;
  border-radius: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.btn-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #ff007f, #00f0ff);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 0;
}

.write-btn:hover {
  border-color: transparent;
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(0, 240, 255, 0.35);
}

.write-btn:hover .btn-glow {
  opacity: 0.85;
}

.write-btn .icon,
.write-btn span {
  position: relative;
  z-index: 1;
}

.write-btn:hover {
  color: #080b16;
}

/* 主内容区 */
.app-main {
  position: relative;
  z-index: 10;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.ball-wrapper {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Loading 效果 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.cyber-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.05);
  border-top-color: #00f0ff;
  border-radius: 50%;
  animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
}

.loading-container p {
  color: #94a3b8;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 1px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 450px;
  gap: 20px;
  padding: 40px;
  background: rgba(15, 20, 38, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(15px);
  border-radius: 24px;
}

.empty-icon {
  font-size: 3rem;
  animation: pulsePlanet 3s ease-in-out infinite;
}

@keyframes pulsePlanet {
  0% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.1) rotate(10deg); }
  100% { transform: scale(1) rotate(0deg); }
}

.empty-state h3 {
  font-size: 1.4rem;
  font-weight: 800;
}

.empty-state p {
  color: #94a3b8;
  font-size: 0.9rem;
  line-height: 1.6;
}

.write-btn-large {
  background: linear-gradient(135deg, #ff007f, #00f0ff);
  color: #fff;
  border: none;
  font-weight: 700;
  font-size: 1rem;
  padding: 14px 35px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 5px 20px rgba(255, 0, 127, 0.25);
}

.write-btn-large:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 25px rgba(0, 240, 255, 0.45);
}

/* Toast 提示滑入动画 */
.toast-notification {
  position: fixed;
  top: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 14px 28px;
  color: #34d399;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-down-enter-from {
  transform: translate(-50%, -100px);
  opacity: 0;
}
.slide-down-leave-to {
  transform: translate(-50%, -100px);
  opacity: 0;
}

/* 页脚 */
.app-footer {
  position: relative;
  z-index: 10;
  margin-top: 30px;
  color: #475569;
  font-size: 0.8rem;
  font-family: monospace;
}
</style>
