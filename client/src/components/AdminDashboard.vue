<template>
  <div class="admin-container">
    <!-- 顶部状态通知栏 -->
    <Transition name="fade">
      <div v-if="toastMsg" class="admin-toast" :class="toastType">
        {{ toastMsg }}
      </div>
    </Transition>

    <!-- 1. 未登录：口令认证表单 -->
    <div v-if="!isAuthenticated" class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-icon">🛡️</div>
          <h2>管理控制台认证</h2>
          <p>请输入管理员安全口令以管理留言与审核数据</p>
        </div>

        <form @submit.prevent="handleLogin" class="auth-form">
          <div class="input-group">
            <input 
              v-model="adminKeyInput" 
              type="password" 
              placeholder="请输入管理员密钥 (ADMIN_KEY)..."
              autocomplete="current-password"
              autofocus
            />
          </div>

          <div v-if="authError" class="auth-error">
            {{ authError }}
          </div>

          <div class="auth-actions">
            <button type="button" class="btn-cancel" @click="emit('exit')">
              返回前台
            </button>
            <button type="submit" class="btn-primary" :disabled="isVerifying">
              {{ isVerifying ? '验证中...' : '确认进入' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 2. 已登录：管理控制台主体 -->
    <div v-else class="dashboard-wrapper">
      <!-- 控制台顶栏 -->
      <header class="dash-header">
        <div class="header-left">
          <div class="dash-title">
            <span class="icon">🛰️</span>
            <h2>星轨留言审核与管理</h2>
            <span class="badge-count">{{ filteredMessages.length }} / {{ messages.length }} 条</span>
          </div>
        </div>

        <div class="header-right">
          <!-- 视图模式切换 -->
          <div class="view-switch">
            <button 
              :class="['switch-btn', { active: viewMode === 'table' }]" 
              @click="viewMode = 'table'" 
              title="紧凑表格视图（一屏展示更多）"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              紧凑表格
            </button>
            <button 
              :class="['switch-btn', { active: viewMode === 'grid' }]" 
              @click="viewMode = 'grid'" 
              title="卡片多列网格视图"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              卡片网格
            </button>
          </div>

          <button class="dash-btn" @click="fetchMessages" :disabled="isLoading" title="刷新列表">
            <svg class="btn-icon" :class="{ rotating: isLoading }" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            刷新
          </button>
          <button class="dash-btn" @click="emit('exit')" title="返回前台 3D 球体">
            <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            返回前台
          </button>
          <button class="dash-btn danger" @click="handleLogout" title="退出登录">
            退出
          </button>
        </div>
      </header>

      <!-- 搜索与筛选工具栏 -->
      <div class="toolbar">
        <div class="filters">
          <button 
            :class="['filter-chip', { active: currentFilter === 'all' }]"
            @click="currentFilter = 'all'"
          >
            全部 ({{ messages.length }})
          </button>
          <button 
            :class="['filter-chip warning', { active: currentFilter === 'flagged' }]"
            @click="currentFilter = 'flagged'"
          >
            ⚠️ 含违规/脱敏 ({{ flaggedCount }})
          </button>
          <button 
            :class="['filter-chip hidden-chip', { active: currentFilter === 'hidden' }]"
            @click="currentFilter = 'hidden'"
          >
            📁 已归档移出 ({{ hiddenCount }})
          </button>
          <button 
            :class="['filter-chip success', { active: currentFilter === 'clean' }]"
            @click="currentFilter = 'clean'"
          >
            ✅ 完全正常 ({{ cleanCount }})
          </button>
        </div>

        <div class="search-box">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input 
            v-model="searchKeyword" 
            type="text" 
            placeholder="搜索昵称、展示内容或原词..."
          />
          <button v-if="searchKeyword" class="clear-search" @click="searchKeyword = ''">×</button>
        </div>
      </div>

      <!-- 留言列表主体 -->
      <div v-if="!isLoading" class="list-container">
        <div v-if="filteredMessages.length === 0" class="empty-hint">
          <span>🪐 没有匹配的留言记录</span>
        </div>

        <!-- 模式一：高密度表格视图（一屏展示 12-20 条） -->
        <div v-else-if="viewMode === 'table'" class="table-responsive">
          <table class="dense-table">
            <thead>
              <tr>
                <th width="75">ID</th>
                <th width="130">昵称</th>
                <th>展示内容 (3D 球面显示)</th>
                <th>原始提交文本</th>
                <th width="160">过滤说明 / 原因</th>
                <th width="140">提交时间</th>
                <th width="190" class="th-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="msg in filteredMessages" 
                :key="`${msg.source}-${msg.id}`"
                :class="{
                  'row-flagged': !!msg.rejectReason,
                  'row-hidden': msg.source === 'hidden'
                }"
              >
                <!-- ID 与归档状态小标 -->
                <td class="td-id">
                  <span>#{{ msg.id }}</span>
                  <span v-if="msg.source === 'hidden'" class="mini-tag-hidden" title="因含限制词超24小时已归档">归档</span>
                </td>

                <!-- 昵称 -->
                <td class="td-nickname">
                  <span class="dot" :style="{ backgroundColor: msg.color }"></span>
                  <span class="name-text" :title="msg.nickname">{{ msg.nickname }}</span>
                </td>

                <!-- 展示内容 -->
                <td class="td-content">
                  <span class="content-text">{{ msg.content }}</span>
                </td>

                <!-- 原始提交 -->
                <td class="td-orig">
                  <span 
                    v-if="msg.originalContent && (msg.originalContent !== msg.content || msg.rejectReason)"
                    class="orig-text has-diff"
                    :title="msg.originalContent"
                  >
                    {{ msg.originalContent }}
                  </span>
                  <span v-else class="orig-same">与展示一致</span>
                </td>

                <!-- 过滤原因 -->
                <td>
                  <span v-if="msg.rejectReason" class="badge badge-warning" :title="msg.rejectReason">
                    ⚠️ {{ msg.rejectReason }}
                  </span>
                  <span v-else class="clean-tag">-</span>
                </td>

                <!-- 时间 -->
                <td class="td-time">{{ formatTime(msg.createdAt) }}</td>

                <!-- 操作栏 -->
                <td class="td-actions">
                  <!-- 归档中：一键恢复 -->
                  <button 
                    v-if="msg.source === 'hidden'"
                    class="tbl-btn restore" 
                    @click="handleQuickRestore(msg)"
                    title="恢复至主列表并在球面重新展示"
                  >
                    恢复上墙
                  </button>

                  <!-- 活跃中含过滤：一键清除标记 -->
                  <button 
                    v-if="msg.source === 'active' && msg.rejectReason"
                    class="tbl-btn unflag" 
                    @click="handleQuickUnflag(msg)"
                    title="清除过滤标记，避免被24小时归档机制移出"
                  >
                    清除过滤
                  </button>

                  <!-- 编辑 -->
                  <button class="tbl-btn edit" @click="openEditModal(msg)" title="编辑内容/昵称/状态">
                    编辑
                  </button>

                  <!-- 删除 -->
                  <button class="tbl-btn delete" @click="handleDelete(msg)" title="彻底删除此留言">
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 模式二：卡片网格模式（自适应 3-4 列高密度卡片） -->
        <div v-else class="cards-grid">
          <div 
            v-for="msg in filteredMessages" 
            :key="`${msg.source}-${msg.id}`"
            class="grid-card"
            :class="{
              'is-hidden-source': msg.source === 'hidden',
              'is-flagged': !!msg.rejectReason
            }"
          >
            <div class="card-head">
              <div class="head-left">
                <span class="dot" :style="{ backgroundColor: msg.color }"></span>
                <span class="nickname">{{ msg.nickname }}</span>
                <span class="id-tag">#{{ msg.id }}</span>
                <span v-if="msg.source === 'hidden'" class="mini-tag-hidden">已归档</span>
              </div>
            </div>

            <div class="card-body">
              <div class="content-box">
                <span class="label">展示:</span>
                <div class="val display-val">{{ msg.content }}</div>
              </div>

              <div 
                v-if="msg.originalContent && (msg.originalContent !== msg.content || msg.rejectReason)" 
                class="content-box orig-box"
              >
                <span class="label orig-lbl">原词:</span>
                <div class="val orig-val">{{ msg.originalContent }}</div>
              </div>

              <div v-if="msg.rejectReason" class="reason-row">
                <span class="badge badge-warning">⚠️ {{ msg.rejectReason }}</span>
              </div>
            </div>

            <div class="card-foot">
              <span class="time-foot">{{ formatTime(msg.createdAt) }}</span>

              <div class="foot-actions">
                <button 
                  v-if="msg.source === 'hidden'"
                  class="action-btn restore" 
                  @click="handleQuickRestore(msg)"
                >
                  恢复
                </button>
                <button 
                  v-if="msg.source === 'active' && msg.rejectReason"
                  class="action-btn unflag" 
                  @click="handleQuickUnflag(msg)"
                >
                  去标
                </button>
                <button class="action-btn edit" @click="openEditModal(msg)">
                  编辑
                </button>
                <button class="action-btn delete" @click="handleDelete(msg)">
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-else class="loading-state">
        <div class="dash-spinner"></div>
        <p>正在同步留言审核数据库...</p>
      </div>
    </div>

    <!-- 3. 编辑留言弹窗 -->
    <Transition name="modal">
      <div v-if="editingMsg" class="edit-overlay" @click.self="editingMsg = null">
        <div class="edit-dialog">
          <div class="dialog-header">
            <h3>编辑留言 (#{{ editingMsg.id }})</h3>
            <button class="close-x" @click="editingMsg = null">×</button>
          </div>

          <div class="dialog-body">
            <div class="form-item" v-if="editingMsg.originalContent">
              <div class="form-label-row">
                <label>用户原始提交文本（对比参考）：</label>
                <button 
                  type="button" 
                  class="btn-copy-orig" 
                  @click="editForm.content = editingMsg.originalContent || ''"
                >
                  一键填入展示框
                </button>
              </div>
              <div class="orig-preview">{{ editingMsg.originalContent }}</div>
            </div>

            <div class="form-item">
              <label>实际展示内容 (Content)：</label>
              <textarea 
                v-model="editForm.content" 
                rows="4" 
                placeholder="修改为需要公开展示的正常文本..."
              ></textarea>
            </div>

            <div class="form-item-grid">
              <div class="form-item">
                <label>昵称：</label>
                <input v-model="editForm.nickname" type="text" placeholder="留言昵称" />
              </div>

              <div class="form-item">
                <label>审核状态：</label>
                <select v-model="editForm.status">
                  <option value="approved">approved (前台公开显示)</option>
                  <option value="rejected">rejected (驳回)</option>
                  <option value="pending">pending (待审核)</option>
                </select>
              </div>
            </div>

            <div class="form-item">
              <label>过滤说明 / 限制原因 (清空即可免除24h自动归档)：</label>
              <div class="reason-input-wrap">
                <input 
                  v-model="editForm.rejectReason" 
                  type="text" 
                  placeholder="留空即表示无违规/正常通过"
                />
                <button 
                  type="button" 
                  class="btn-clear-reason"
                  @click="editForm.rejectReason = ''"
                  v-if="editForm.rejectReason"
                >
                  清空标记
                </button>
              </div>
              <p class="field-hint">💡 提示：当此处为空时，留言不会在 24 小时后被定时归档任务隐去。</p>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn-cancel" @click="editingMsg = null">取消</button>
            <button class="btn-primary" :disabled="isSaving" @click="saveEdit">
              {{ isSaving ? '保存中...' : '保存更改' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

export interface AdminMessageItem {
  id: number;
  content: string;
  originalContent?: string;
  nickname: string;
  color: string;
  size: number;
  createdAt: string;
  status: 'approved' | 'rejected' | 'pending';
  rejectReason?: string | null;
  source: 'active' | 'hidden';
}

const emit = defineEmits<{
  (e: 'exit'): void;
}>();

const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:4001/api' 
  : '/api';

// 认证状态
const tokenKey = 'mb_admin_token';
const isAuthenticated = ref(false);
const adminKeyInput = ref('');
const isVerifying = ref(false);
const authError = ref('');

// 列表数据与视图控制（默认紧凑表格，容纳最多信息）
const viewMode = ref<'table' | 'grid'>('table');
const messages = ref<AdminMessageItem[]>([]);
const isLoading = ref(false);
const currentFilter = ref<'all' | 'flagged' | 'hidden' | 'clean'>('all');
const searchKeyword = ref('');

// Toast
const toastMsg = ref('');
const toastType = ref<'success' | 'error'>('success');
let toastTimer: any = null;
const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
  toastMsg.value = msg;
  toastType.value = type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg.value = '';
  }, 3000);
};

// 编辑状态
const editingMsg = ref<AdminMessageItem | null>(null);
const isSaving = ref(false);
const editForm = ref({
  content: '',
  nickname: '',
  status: 'approved' as 'approved' | 'rejected' | 'pending',
  rejectReason: ''
});

// 获取保存在 SessionStorage 中的 token
const getSavedToken = () => {
  return sessionStorage.getItem(tokenKey) || '';
};

// 构造请求 Headers
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Admin-Token': getSavedToken()
  };
};

// 验证口令
const handleLogin = async () => {
  if (!adminKeyInput.value.trim()) {
    authError.value = '请输入管理员密钥';
    return;
  }
  isVerifying.value = true;
  authError.value = '';

  try {
    const res = await fetch(`${API_BASE_URL}/admin/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Admin-Token': adminKeyInput.value.trim()
      }
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem(tokenKey, adminKeyInput.value.trim());
      isAuthenticated.value = true;
      adminKeyInput.value = '';
      fetchMessages();
    } else {
      authError.value = data.message || '管理员密钥错误';
    }
  } catch (err: any) {
    authError.value = '无法连接到后端服务器，请检查网络';
  } finally {
    isVerifying.value = false;
  }
};

const handleLogout = () => {
  sessionStorage.removeItem(tokenKey);
  isAuthenticated.value = false;
  messages.value = [];
};

// 获取所有留言
const fetchMessages = async () => {
  isLoading.value = true;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/messages`, {
      headers: getHeaders()
    });
    if (res.status === 401) {
      isAuthenticated.value = false;
      sessionStorage.removeItem(tokenKey);
      authError.value = '认证已过期，请重新输入密钥';
      return;
    }
    const data = await res.json();
    if (data.success) {
      messages.value = data.data;
    } else {
      showToast(data.message || '获取失败', 'error');
    }
  } catch (err) {
    showToast('获取留言异常', 'error');
  } finally {
    isLoading.value = false;
  }
};

// 统计数量
const flaggedCount = computed(() => messages.value.filter(m => !!m.rejectReason).length);
const hiddenCount = computed(() => messages.value.filter(m => m.source === 'hidden').length);
const cleanCount = computed(() => messages.value.filter(m => !m.rejectReason && m.source === 'active').length);

// 过滤筛选与搜索
const filteredMessages = computed(() => {
  let list = messages.value;

  if (currentFilter.value === 'flagged') {
    list = list.filter(m => !!m.rejectReason);
  } else if (currentFilter.value === 'hidden') {
    list = list.filter(m => m.source === 'hidden');
  } else if (currentFilter.value === 'clean') {
    list = list.filter(m => !m.rejectReason && m.source === 'active');
  }

  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase();
    list = list.filter(m => 
      m.nickname.toLowerCase().includes(kw) ||
      m.content.toLowerCase().includes(kw) ||
      (m.originalContent && m.originalContent.toLowerCase().includes(kw)) ||
      (m.rejectReason && m.rejectReason.toLowerCase().includes(kw))
    );
  }

  return list;
});

// 格式化时间
const formatTime = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 快捷恢复归档留言上墙
const handleQuickRestore = async (msg: AdminMessageItem) => {
  if (!confirm(`确认将留言 #${msg.id} 恢复上墙并在球面重新展示？将自动清空违规标记。`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/messages/${msg.id}/restore`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        content: msg.originalContent || msg.content
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('已成功恢复至展示列表！');
      fetchMessages();
    } else {
      showToast(data.message || '恢复失败', 'error');
    }
  } catch (err) {
    showToast('网络请求异常', 'error');
  }
};

// 快捷解除活跃留言过滤标记并恢复原文
const handleQuickUnflag = async (msg: AdminMessageItem) => {
  const willRestoreOrig = msg.originalContent && msg.originalContent !== msg.content;
  const tip = willRestoreOrig
    ? `确认清除违规标记？将同时将展示内容还原为原始内容：\n"${msg.originalContent}"`
    : `确认清除违规标记？该留言将不再被定时归档。`;

  if (!confirm(tip)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/messages/${msg.id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        source: msg.source,
        content: willRestoreOrig ? msg.originalContent : msg.content,
        rejectReason: null
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('违规标记已清除！');
      fetchMessages();
    } else {
      showToast(data.message || '操作失败', 'error');
    }
  } catch (err) {
    showToast('网络请求异常', 'error');
  }
};

// 打开编辑弹窗
const openEditModal = (msg: AdminMessageItem) => {
  editingMsg.value = msg;
  editForm.value = {
    content: msg.content,
    nickname: msg.nickname,
    status: msg.status,
    rejectReason: msg.rejectReason || ''
  };
};

// 保存编辑
const saveEdit = async () => {
  if (!editingMsg.value) return;
  isSaving.value = true;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/messages/${editingMsg.value.id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        source: editingMsg.value.source,
        content: editForm.value.content,
        nickname: editForm.value.nickname,
        status: editForm.value.status,
        rejectReason: editForm.value.rejectReason.trim() || null
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('修改保存成功！');
      editingMsg.value = null;
      fetchMessages();
    } else {
      showToast(data.message || '保存失败', 'error');
    }
  } catch (err) {
    showToast('网络请求异常', 'error');
  } finally {
    isSaving.value = false;
  }
};

// 删除留言
const handleDelete = async (msg: AdminMessageItem) => {
  if (!confirm(`警告：确定彻底删除留言 #${msg.id} 吗？此操作无法撤回。`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/messages/${msg.id}?source=${msg.source}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('删除成功！');
      fetchMessages();
    } else {
      showToast(data.message || '删除失败', 'error');
    }
  } catch (err) {
    showToast('网络请求异常', 'error');
  }
};

// 挂载时尝试自动登录已保存的 token
onMounted(() => {
  const token = getSavedToken();
  if (token) {
    fetch(`${API_BASE_URL}/admin/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Admin-Token': token
      }
    }).then(res => res.json()).then(data => {
      if (data.success) {
        isAuthenticated.value = true;
        fetchMessages();
      } else {
        sessionStorage.removeItem(tokenKey);
      }
    }).catch(() => {});
  }
});
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  width: 100vw;
  background-color: #0b0e17;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  overflow-y: auto;
  box-sizing: border-box;
  position: relative;
  z-index: 10;
}

/* Toast 提示 */
.admin-toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  z-index: 1000;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.admin-toast.success {
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #34d399;
}
.admin-toast.error {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
}

/* 口令认证卡片 */
.auth-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  background: rgba(18, 24, 38, 0.9);
  border: 1px solid rgba(0, 240, 255, 0.25);
  border-radius: 16px;
  padding: 32px 26px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 240, 255, 0.08);
  backdrop-filter: blur(16px);
}
.auth-header {
  text-align: center;
  margin-bottom: 24px;
}
.auth-icon {
  font-size: 38px;
  margin-bottom: 10px;
}
.auth-header h2 {
  margin: 0 0 6px 0;
  font-size: 19px;
  color: #f8fafc;
}
.auth-header p {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}
.auth-form .input-group input {
  width: 100%;
  padding: 11px 14px;
  background: rgba(11, 14, 23, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
}
.auth-form .input-group input:focus {
  border-color: #00f0ff;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}
.auth-error {
  margin-top: 10px;
  color: #f87171;
  font-size: 13px;
  text-align: center;
}
.auth-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

/* 控制台主体 (超宽布局，最大化利用屏幕空间) */
.dashboard-wrapper {
  max-width: 96%;
  width: 1680px;
  margin: 0 auto;
  padding: 16px 12px 60px 12px;
}

.dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 12px;
}
.dash-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dash-title .icon {
  font-size: 20px;
}
.dash-title h2 {
  margin: 0;
  font-size: 18px;
  color: #f1f5f9;
}
.badge-count {
  background: rgba(0, 240, 255, 0.1);
  color: #00f0ff;
  border: 1px solid rgba(0, 240, 255, 0.2);
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 视图切换按钮组 */
.view-switch {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 2px;
}
.switch-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.switch-btn.active {
  background: rgba(0, 240, 255, 0.18);
  color: #00f0ff;
  font-weight: 500;
}

.dash-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.dash-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.dash-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}
.btn-icon.rotating {
  animation: spin 1s linear infinite;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 12px;
}
.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.filter-chip {
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-chip:hover {
  color: #e2e8f0;
  border-color: rgba(255, 255, 255, 0.2);
}
.filter-chip.active {
  background: rgba(0, 240, 255, 0.12);
  color: #00f0ff;
  border-color: rgba(0, 240, 255, 0.4);
  font-weight: 500;
}
.filter-chip.warning.active {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.4);
}
.filter-chip.hidden-chip.active {
  background: rgba(100, 116, 139, 0.2);
  color: #cbd5e1;
  border-color: rgba(100, 116, 139, 0.4);
}

.search-box {
  position: relative;
  width: 260px;
}
.search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
}
.search-box input {
  width: 100%;
  padding: 6px 26px 6px 30px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}
.search-box input:focus {
  border-color: #00f0ff;
}
.clear-search {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
}

/* ===================================================
   高密度表格视图模式 (Dense Table View)
   =================================================== */
.table-responsive {
  width: 100%;
  overflow-x: auto;
  background: rgba(15, 20, 32, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}
.dense-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}
.dense-table th {
  background: rgba(255, 255, 255, 0.03);
  padding: 10px 12px;
  color: #94a3b8;
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
}
.dense-table td {
  padding: 9px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}
.dense-table tbody tr {
  transition: background-color 0.15s;
}
.dense-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}
.dense-table tbody tr.row-flagged {
  background: rgba(245, 158, 11, 0.02);
}
.dense-table tbody tr.row-hidden {
  opacity: 0.85;
}

.td-id {
  color: #64748b;
  font-family: monospace;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.mini-tag-hidden {
  display: inline-block;
  font-size: 10px;
  background: rgba(100, 116, 139, 0.25);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.35);
  padding: 0 4px;
  border-radius: 3px;
  line-height: 1.4;
}
.td-nickname {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 130px;
  font-weight: 500;
  color: #f1f5f9;
}
.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.td-content {
  max-width: 420px;
  line-height: 1.4;
  word-break: break-all;
  color: #f8fafc;
}
.td-orig {
  max-width: 380px;
  line-height: 1.4;
  word-break: break-all;
}
.orig-text.has-diff {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
}
.orig-same {
  color: #475569;
  font-size: 12px;
}
.clean-tag {
  color: #475569;
}
.td-time {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

/* 表格操作按钮 */
.th-actions {
  text-align: right;
}
.td-actions {
  text-align: right;
  white-space: nowrap;
}
.tbl-btn {
  padding: 3px 8px;
  margin-left: 4px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  transition: all 0.15s;
}
.tbl-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.tbl-btn.restore {
  background: rgba(0, 240, 255, 0.1);
  border-color: rgba(0, 240, 255, 0.3);
  color: #00f0ff;
}
.tbl-btn.restore:hover {
  background: rgba(0, 240, 255, 0.2);
}
.tbl-btn.unflag {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #34d399;
}
.tbl-btn.unflag:hover {
  background: rgba(16, 185, 129, 0.2);
}
.tbl-btn.delete {
  color: #f87171;
}
.tbl-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}

/* ===================================================
   多列卡片网格模式 (Card Grid View)
   =================================================== */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}
.grid-card {
  background: rgba(18, 24, 38, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}
.grid-card:hover {
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.grid-card.is-flagged {
  border-left: 3px solid #f59e0b;
}
.grid-card.is-hidden-source {
  border-left: 3px solid #64748b;
  opacity: 0.85;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.nickname {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 13px;
}
.id-tag {
  color: #64748b;
  font-size: 11px;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.content-box {
  display: flex;
  gap: 6px;
  font-size: 13px;
  line-height: 1.4;
}
.label {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
}
.display-val {
  color: #f8fafc;
  word-break: break-all;
}
.orig-box {
  background: rgba(0, 0, 0, 0.25);
  padding: 6px 8px;
  border-radius: 4px;
  border-left: 2px solid rgba(0, 240, 255, 0.4);
}
.orig-lbl {
  color: #00f0ff;
}
.orig-val {
  color: #94a3b8;
  word-break: break-all;
}
.reason-row {
  margin-top: 2px;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 8px;
  gap: 6px;
}
.time-foot {
  color: #64748b;
  font-size: 11px;
}
.foot-actions {
  display: flex;
  gap: 5px;
}
.action-btn {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  transition: all 0.15s;
}
.action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.action-btn.restore {
  background: rgba(0, 240, 255, 0.1);
  border-color: rgba(0, 240, 255, 0.3);
  color: #00f0ff;
}
.action-btn.restore:hover {
  background: rgba(0, 240, 255, 0.2);
}
.action-btn.unflag {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #34d399;
}
.action-btn.unflag:hover {
  background: rgba(16, 185, 129, 0.2);
}
.action-btn.delete {
  color: #f87171;
}
.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}

/* 徽章基础 */
.badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  display: inline-block;
  white-space: nowrap;
}
.badge-active {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.badge-hidden {
  background: rgba(100, 116, 139, 0.2);
  color: #cbd5e1;
  border: 1px solid rgba(100, 116, 139, 0.3);
}
.badge-warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

/* 通用按钮风格 */
.btn-primary {
  flex: 1;
  padding: 9px 18px;
  background: linear-gradient(135deg, #00f0ff, #00a8ff);
  color: #050b14;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
}
.btn-cancel {
  padding: 9px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 编辑弹窗 */
.edit-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.edit-dialog {
  width: 100%;
  max-width: 560px;
  background: #121826;
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 12px;
  padding: 22px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 240, 255, 0.1);
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 10px;
}
.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  color: #f1f5f9;
}
.close-x {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
}
.close-x:hover {
  color: #fff;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.form-item label {
  font-size: 12px;
  color: #94a3b8;
}
.btn-copy-orig {
  background: none;
  border: none;
  color: #00f0ff;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}
.orig-preview {
  background: rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 7px 10px;
  color: #cbd5e1;
  font-size: 13px;
  font-style: italic;
}
.form-item textarea,
.form-item input,
.form-item select {
  background: rgba(11, 14, 23, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 8px 10px;
  color: #fff;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}
.form-item textarea:focus,
.form-item input:focus,
.form-item select:focus {
  border-color: #00f0ff;
}
.form-item-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.reason-input-wrap {
  display: flex;
  gap: 8px;
}
.reason-input-wrap input {
  flex: 1;
}
.btn-clear-reason {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.field-hint {
  margin: 2px 0 0 0;
  font-size: 11px;
  color: #64748b;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 12px;
}

/* 动效与占位 */
.loading-state, .empty-hint {
  text-align: center;
  padding: 50px 20px;
  color: #64748b;
  font-size: 13px;
}
.dash-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(0, 240, 255, 0.15);
  border-top-color: #00f0ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px auto;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
