<template>
  <div 
    class="ball-container" 
    ref="containerRef"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @wheel.prevent="handleWheel"
  >
    <div 
      class="message-item-wrapper"
      v-for="(item, index) in items"
      :key="item.id || index"
      :style="getStyle(item)"
      @click="handleItemClick(item)"
    >
      <div 
        class="message-card" 
        :style="{ 
          '--neon-color': item.color, 
          'borderColor': item.color + '40', 
          'boxShadow': '0 0 15px ' + item.color + '20, inset 0 0 10px ' + item.color + '10'
        }"
      >
        <div class="card-glow" :style="{ backgroundColor: item.color }"></div>
        <div class="nickname" :style="{ color: item.color }">@{{ item.nickname }}</div>
        <div class="content">{{ truncate(item.content, 30) }}</div>
        <div class="time">{{ formatTime(item.createdAt) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

interface Message {
  id?: number;
  content: string;
  nickname: string;
  color: string;
  size: number;
  createdAt: string;
  // 3D 坐标及属性
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  opacity?: number;
  blur?: number;
}

const props = defineProps<{
  messages: Message[];
}>();

const emit = defineEmits<{
  (e: 'select', message: Message): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const items = ref<Message[]>([]);

// 3D 渲染响应式半径
const radius = ref(250);
const speedX = ref(0.003); // 绕 X 轴旋转弧度速度
const speedY = ref(0.003); // 绕 Y 轴旋转弧度速度
const impulseX = ref(0);   // 滚轮带来的绕 X 轴物理旋转冲量
const impulseY = ref(0);   // 滚轮带来的绕 Y 轴物理旋转冲量
let animationFrameId: number;

// 依据容器的可用尺寸动态更新球体半径，保障一屏自适应且不超出裁剪
const updateRadius = () => {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  // 半径大小设为宽高度中极小值的 35%，为气泡卡片四周留出足够的缓冲带以防溢出
  radius.value = Math.min(rect.width, rect.height) * 0.35;
};

// 初始化球面上点的 3D 坐标 (斐波那契螺旋面算法)
const initPositions = () => {
  const count = props.messages.length;
  if (count === 0) return;

  items.value = props.messages.map((msg, i) => {
    // 斐波那契螺旋面分布公式
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;

    return {
      ...msg,
      x: radius.value * Math.sin(phi) * Math.cos(theta),
      y: radius.value * Math.sin(phi) * Math.sin(theta),
      z: radius.value * Math.cos(phi),
      scale: 1,
      opacity: 1,
      blur: 0
    };
  });
};

// 监听留言数据变化，重新分布位置
watch(() => props.messages, () => {
  initPositions();
}, { deep: true });

// 矩阵旋转更新
const rotateX = (angle: number) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  items.value.forEach(item => {
    if (item.y !== undefined && item.z !== undefined) {
      const y1 = item.y * cos - item.z * sin;
      const z1 = item.z * cos + item.y * sin;
      item.y = y1;
      item.z = z1;
    }
  });
};

const rotateY = (angle: number) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  items.value.forEach(item => {
    if (item.x !== undefined && item.z !== undefined) {
      const x1 = item.x * cos - item.z * sin;
      const z1 = item.z * cos + item.x * sin;
      item.x = x1;
      item.z = z1;
    }
  });
};

// 动画主循环
const update = () => {
  // 绕 X 和 Y 轴旋转（基础速度 + 滚轮冲量）
  rotateX(speedX.value + impulseX.value);
  rotateY(speedY.value + impulseY.value);

  // 滚轮冲量阻尼衰减（摩擦力），使其逐渐慢下来并归零
  impulseX.value *= 0.95;
  impulseY.value *= 0.95;
  if (Math.abs(impulseX.value) < 0.0001) impulseX.value = 0;
  if (Math.abs(impulseY.value) < 0.0001) impulseY.value = 0;

  // 计算景深和投影
  items.value.forEach(item => {
    if (item.z !== undefined) {
      // 归一化深度比例 (从 0.5 到 1.5)
      const scale = (item.z + radius.value) / (2 * radius.value); 
      item.scale = 0.5 + scale * 0.8; // 字号缩放 (0.5x ~ 1.3x)
      item.opacity = 0.2 + scale * 0.8; // 透明度渐变 (0.2 ~ 1.0)
      item.blur = Math.max(0, (1 - scale) * 4); // 远距离模糊 (0px ~ 4px)
    }
  });

  animationFrameId = requestAnimationFrame(update);
};

// 处理鼠标移动交互，控制旋转速度与方向
const handleMouseMove = (e: MouseEvent) => {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // 偏离中心的百分比 (-1.0 到 1.0)
  const deltaX = (e.clientX - centerX) / (rect.width / 2);
  const deltaY = (e.clientY - centerY) / (rect.height / 2);

  // 鼠标离中心越远，转动越快；偏离 X 轴影响绕 Y 轴的旋转，以此类推
  speedY.value = deltaX * 0.012;
  speedX.value = -deltaY * 0.012;
};

// 鼠标移出容器时回归慢速自动旋转
const handleMouseLeave = () => {
  speedX.value = 0.003;
  speedY.value = 0.003;
};

// 处理鼠标滚轮滚动交互，转化为旋转冲量（Impulse）
const handleWheel = (e: WheelEvent) => {
  // e.deltaY 表示垂直滚轮滚动量，给 X 轴旋转速度增能；乘以系数以防转速失控
  // 向上滚动为负值，向下滚动为正值
  impulseX.value += e.deltaY * 0.00015;
  // e.deltaX 表示水平滚轮滚动量，给 Y 轴旋转速度增能
  impulseY.value += e.deltaX * 0.00015;
};

// 移动端触摸交互支持
let touchStartX = 0;
let touchStartY = 0;

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length > 0) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length > 0 && containerRef.value) {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;

    speedY.value = (deltaX / 100) * 0.02;
    speedX.value = -(deltaY / 100) * 0.02;
  }
};

const handleTouchEnd = () => {
  setTimeout(() => {
    speedX.value = 0.003;
    speedY.value = 0.003;
  }, 1000);
};

// 计算单个留言包装层样式，应用 3D translate、scale、opacity 和 blur 滤镜
const getStyle = (item: Message) => {
  const x = (item.x || 0).toFixed(2);
  const y = (item.y || 0).toFixed(2);
  const z = (item.z || 0).toFixed(2);
  const scale = (item.scale || 1).toFixed(2);
  const opacity = (item.opacity || 1).toFixed(2);
  const blur = (item.blur || 0).toFixed(1);

  return {
    transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`,
    opacity: opacity,
    filter: `blur(${blur}px)`,
    zIndex: Math.round((item.z || 0) + radius.value), // 改用动态 radius
  };
};

const handleItemClick = (message: Message) => {
  emit('select', message);
};

// 窗口尺寸变化事件处理
const handleResize = () => {
  updateRadius();
  initPositions();
};

// 工具方法
const truncate = (str: string, len: number) => {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

onMounted(() => {
  updateRadius(); // 先检测一次尺寸
  initPositions(); // 再根据检测出的尺寸进行三维分布
  update();
  window.addEventListener('resize', handleResize); // 绑定窗口自适应
});

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', handleResize); // 卸载监听
});
</script>

<style scoped>
.ball-container {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0 auto;
  perspective: 1000px; /* 创建 3D 透视视图 */
  transform-style: preserve-3d;
  cursor: grab;
}

.ball-container:active {
  cursor: grabbing;
}

.message-item-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-top: -70px; /* 居中校正，值为主卡片高度的一半 */
  margin-left: -120px; /* 居中校正，值为主卡片宽度的一半 */
  transition: transform 0.1s linear, opacity 0.1s linear, filter 0.1s linear;
  transform-style: preserve-3d;
  will-change: transform, opacity, filter;
  pointer-events: auto;
}

.message-card {
  position: relative;
  width: 240px;
  height: 140px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(18, 22, 38, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
  user-select: none;
}

.message-card:hover {
  border-color: var(--neon-color) !important;
  box-shadow: 0 0 25px var(--neon-color), inset 0 0 15px rgba(255, 255, 255, 0.05) !important;
  transform: translateZ(20px) scale(1.05); /* 卡片本身悬浮时向屏幕外突出 */
}

/* 霓虹磨砂玻璃边缘发光和微光 */
.card-glow {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  filter: blur(25px);
  opacity: 0.18;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.message-card:hover .card-glow {
  opacity: 0.35;
}

.nickname {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  font-family: 'Outfit', sans-serif;
  text-shadow: 0 0 8px currentColor;
}

.content {
  color: #e2e8f0;
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  flex-grow: 1;
}

.time {
  color: #64748b;
  font-size: 0.75rem;
  align-self: flex-end;
  font-family: monospace;
}
</style>
