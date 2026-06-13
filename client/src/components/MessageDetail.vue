<template>
  <Transition name="modal">
    <div v-if="isOpen && message" class="modal-overlay" @click.self="handleClose">
      <div 
        class="modal-content"
        :style="{ 
          '--neon-color': message.color,
          'borderColor': message.color + '30',
          'boxShadow': `0 0 40px ${message.color}25, inset 0 0 15px ${message.color}15`
        }"
      >
        <button class="close-btn" @click="handleClose">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <!-- 对话框发光底色 -->
        <div class="modal-glow" :style="{ backgroundColor: message.color }"></div>

        <div class="modal-body">
          <div class="nickname" :style="{ color: message.color }">
            @{{ message.nickname }}
          </div>
          
          <div class="message-content">
            {{ message.content }}
          </div>
          
          <div class="modal-footer">
            <span class="timestamp">发布于 {{ formatFullTime(message.createdAt) }}</span>
            <button class="done-btn" :style="{ backgroundColor: message.color }" @click="handleClose">
              已阅
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Message {
  id?: number;
  content: string;
  nickname: string;
  color: string;
  size: number;
  createdAt: string;
}

const props = defineProps<{
  isOpen: boolean;
  message: Message | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const handleClose = () => {
  emit('close');
};

const formatFullTime = (timeStr: string) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
</script>

<style scoped>
/* 模态框动画效果 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-enter-from {
  opacity: 0;
}
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content {
  transform: scale(0.9) translateY(20px);
}
.modal-leave-to .modal-content {
  transform: scale(0.9) translateY(20px);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1010;
  background: rgba(4, 6, 12, 0.7);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  position: relative;
  width: 100%;
  max-width: 500px;
  background: rgba(16, 22, 42, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  padding: 35px;
  overflow: hidden;
}

.modal-glow {
  position: absolute;
  top: -80px;
  left: -80px;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  filter: blur(45px);
  opacity: 0.15;
  pointer-events: none;
}

.close-btn {
  position: absolute;
  top: 25px;
  right: 25px;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  transition: color 0.2s, background-color 0.2s;
  z-index: 1;
}

.close-btn:hover {
  color: #f1f5f9;
  background-color: rgba(255, 255, 255, 0.05);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 25px;
  text-align: left;
}

.nickname {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-shadow: 0 0 10px currentColor;
}

.message-content {
  color: #f1f5f9;
  font-size: 1.1rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 5px;
}

/* 滚动条美化 */
.message-content::-webkit-scrollbar {
  width: 4px;
}
.message-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
.message-content::-webkit-scrollbar-thumb:hover {
  background: var(--neon-color);
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.timestamp {
  color: #64748b;
  font-size: 0.8rem;
  font-family: monospace;
}

.done-btn {
  border: none;
  color: #0b0f19;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 8px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
}

.done-btn:hover {
  color: #fff;
  box-shadow: 0 0 20px var(--neon-color);
  transform: translateY(-1px);
}

.done-btn:active {
  transform: translateY(0);
}
</style>
