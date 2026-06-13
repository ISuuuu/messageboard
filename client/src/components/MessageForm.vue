<template>
  <Transition name="drawer">
    <div v-if="isOpen" class="drawer-overlay" @click.self="handleClose">
      <div class="drawer-content">
        <button class="close-btn" @click="handleClose">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <div class="drawer-header">
          <h2>留下您的痕迹</h2>
          <p>在这里写下您的所思所想，它们将永远漂浮在我们的 3D 球面上。</p>
        </div>

        <form @submit.prevent="handleSubmit" class="message-form">
          <!-- 昵称输入 -->
          <div class="form-group">
            <label for="nickname">昵称</label>
            <div class="input-wrapper">
              <input 
                type="text" 
                id="nickname" 
                v-model="form.nickname" 
                placeholder="匿名" 
                maxlength="20"
                autocomplete="off"
              />
              <span class="focus-border"></span>
            </div>
          </div>

          <!-- 内容输入 -->
          <div class="form-group">
            <label for="content">留言内容 <span class="required">*</span></label>
            <div class="input-wrapper">
              <textarea 
                id="content" 
                v-model="form.content" 
                rows="6" 
                placeholder="在此输入留言，请注意遵守互联网守则..." 
                maxlength="500"
                required
              ></textarea>
              <span class="focus-border"></span>
              <div class="char-counter">{{ form.content.length }}/500</div>
            </div>
          </div>

          <!-- 霓虹色彩选择 -->
          <div class="form-group">
            <label>霓虹气泡色彩</label>
            <div class="color-picker">
              <button 
                type="button"
                v-for="color in presetColors" 
                :key="color"
                class="color-dot"
                :class="{ active: form.color === color }"
                :style="{ 
                  backgroundColor: color, 
                  boxShadow: form.color === color ? `0 0 15px ${color}` : `0 0 5px ${color}40` 
                }"
                @click="form.color = color"
              ></button>
              <button 
                type="button" 
                class="random-color-btn" 
                :style="{ borderColor: form.color === randomBtnColor ? form.color : 'rgba(255,255,255,0.1)' }"
                @click="pickRandomColor"
              >
                随机
              </button>
            </div>
          </div>

          <!-- 提示信息 -->
          <Transition name="fade">
            <div v-if="errorMsg" class="error-alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{{ errorMsg }}</span>
            </div>
          </Transition>

          <!-- 提交按钮 -->
          <button type="submit" class="submit-btn" :disabled="isSubmitting" :style="{ '--glow-color': form.color }">
            <span v-if="isSubmitting" class="loading-spinner"></span>
            <span v-else>发布留言</span>
          </button>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  isSubmitting: boolean;
  errorMsg: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', data: { content: string; nickname: string; color: string }): void;
}>();

const presetColors = [
  '#ff007f', // 霓虹粉
  '#00f0ff', // 赛博蓝
  '#ffb700', // 金黄
  '#ab00ff', // 紫罗兰
  '#00ff66', // 荧光绿
  '#ff5500'  // 炽热橙
];

const form = reactive({
  nickname: '',
  content: '',
  color: presetColors[0]
});

const randomBtnColor = ref('#ffffff');

const pickRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  form.color = color;
  randomBtnColor.value = color;
};

const handleClose = () => {
  emit('close');
};

const handleSubmit = () => {
  if (!form.content.trim()) return;
  emit('submit', {
    content: form.content,
    nickname: form.nickname.trim(),
    color: form.color
  });
};

// 监听打开状态，重置表单
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.nickname = '';
    form.content = '';
    form.color = presetColors[Math.floor(Math.random() * presetColors.length)];
  }
});
</script>

<style scoped>
/* 抽屉弹出过渡效果 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.4s ease;
}

.drawer-enter-active .drawer-content,
.drawer-leave-active .drawer-content {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-enter-from {
  opacity: 0;
}
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer-content {
  transform: translateX(100%);
}
.drawer-leave-to .drawer-content {
  transform: translateX(100%);
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(4, 6, 12, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: flex-end;
}

.drawer-content {
  width: 100%;
  max-width: 450px;
  height: 100%;
  background: rgba(15, 20, 38, 0.75);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  padding: 40px;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-y: auto;
}

.close-btn {
  position: absolute;
  top: 30px;
  right: 30px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  transition: color 0.2s, background-color 0.2s;
}

.close-btn:hover {
  color: #f1f5f9;
  background-color: rgba(255, 255, 255, 0.05);
}

.drawer-header {
  margin-top: 20px;
  margin-bottom: 35px;
  text-align: left;
}

.drawer-header h2 {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
  background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.drawer-header p {
  color: #94a3b8;
  font-size: 0.9rem;
  line-height: 1.5;
}

.message-form {
  display: flex;
  flex-direction: column;
  gap: 25px;
  text-align: left;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  color: #e2e8f0;
  font-size: 0.9rem;
  font-weight: 600;
}

.required {
  color: #ff007f;
}

.input-wrapper {
  position: relative;
  width: 100%;
}

.input-wrapper input,
.input-wrapper textarea {
  width: 100%;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 12px 16px;
  color: #f1f5f9;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.3s ease, background-color 0.3s ease;
  font-family: inherit;
}

.input-wrapper textarea {
  resize: none;
}

.input-wrapper input:focus,
.input-wrapper textarea:focus {
  border-color: rgba(255, 255, 255, 0.25);
  background-color: rgba(30, 41, 59, 0.6);
}

.focus-border {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #ff007f, #00f0ff);
  transition: width 0.3s ease, left 0.3s ease;
  pointer-events: none;
  border-radius: 2px;
}

.input-wrapper input:focus ~ .focus-border,
.input-wrapper textarea:focus ~ .focus-border {
  width: 100%;
  left: 0;
}

.char-counter {
  position: absolute;
  bottom: 12px;
  right: 15px;
  color: #64748b;
  font-size: 0.75rem;
  font-family: monospace;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 5px;
}

.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s;
}

.color-dot:hover {
  transform: scale(1.15);
}

.color-dot.active {
  border-color: #fff;
  transform: scale(1.1);
}

.random-color-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.random-color-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-style: solid;
}

.error-alert {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  padding: 12px 16px;
  color: #f87171;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 10px;
  line-height: 1.4;
}

.submit-btn {
  background: #fff;
  color: #0b0f19;
  border: none;
  border-radius: 12px;
  padding: 15px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  margin-top: 15px;
}

.submit-btn:hover {
  background: var(--glow-color);
  color: #fff;
  box-shadow: 0 0 30px var(--glow-color);
  transform: translateY(-2px);
}

.submit-btn:active {
  transform: translateY(0);
}

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .drawer-content {
    padding: 24px 20px;
  }
  .drawer-header {
    margin-top: 10px;
    margin-bottom: 20px;
  }
  .close-btn {
    top: 20px;
    right: 20px;
  }
  .drawer-header h2 {
    font-size: 1.5rem;
  }
}
</style>
