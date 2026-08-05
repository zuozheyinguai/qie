<template>
  <!-- Panel Overlay -->
  <div v-if="store.panelVisible" class="wb-overlay" @click.self="store.hidePanel()">
    <div class="wb-panel">
      <!-- Header -->
      <div class="wb-header">
        <div class="wb-title-row">
          <span class="wb-title">世界书分组切换</span>
          <button class="wb-btn-icon" title="刷新" @click="store.loadWorldbook()" :disabled="store.loading">
            <svg :class="{ 'wb-spinning': store.loading }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 4v6h6M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </button>
        </div>
        <div class="wb-subtitle" v-if="store.primaryWorldbookName">{{ store.primaryWorldbookName }}</div>
        <div class="wb-subtitle wb-warning" v-else>未检测到主世界书</div>
      </div>

      <!-- Loading -->
      <div class="wb-loading" v-if="store.loading">
        <div class="wb-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- Body: Group List -->
      <div class="wb-body" v-else-if="store.groups.length">
        <div class="wb-group" v-for="g in store.groups" :key="g.name">
          <div class="wb-group-header">
            <label class="wb-label">
              <input type="checkbox" :checked="store.selectedGroups.has(g.name)" @change="store.toggleGroup(g.name)" class="wb-cb" />
              <span class="wb-group-name">{{ g.name || '(空)' }}</span>
            </label>
            <span class="wb-count">{{ g.entries.length }}条</span>
            <button class="wb-star" :class="{ active: settingsStore.settings.whitelist.includes(g.name) }"
              :title="settingsStore.settings.whitelist.includes(g.name) ? '从白名单移除' : '加入白名单（切换时永不关闭）'"
              @click="toggleWhitelist(g.name)">
              <svg width="14" height="14" viewBox="0 0 24 24"
                :fill="settingsStore.settings.whitelist.includes(g.name) ? 'currentColor' : 'none'"
                stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
            <button class="wb-only-btn" title="仅启用此分组" @click="selectOnly(g.name)">仅此组</button>
          </div>
          <div class="wb-entries">
            <div class="wb-entry" v-for="e in g.entries" :key="e.uid" :class="{ off: !e.enabled }">
              <span class="wb-entry-name">{{ e.name }}</span>
              <span class="wb-entry-status">{{ e.enabled ? 'ON' : 'OFF' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div class="wb-empty" v-else-if="store.primaryWorldbookName">没有可分组的条目</div>

      <!-- Footer -->
      <div class="wb-footer">
        <button class="wb-btn-primary" :disabled="store.loading || !store.primaryWorldbookName" @click="onApply">
          应用切换
        </button>
      </div>
    </div>
  </div>

  <!-- Floating Ball -->
  <div ref="ballRef" class="wb-ball" :style="ballStyle"
    @pointerdown="onPointerDown" @click="onBallClick"
    @contextmenu.prevent="showSettings = !showSettings">
    <img v-if="settingsStore.settings.customIcon" :src="settingsStore.settings.customIcon" class="wb-ball-img" />
    <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="wb-ball-svg">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="8" y1="7" x2="16" y2="7"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  </div>

  <!-- Settings Modal -->
  <div v-if="showSettings" class="wb-overlay" @click.self="showSettings = false">
    <div class="wb-settings">
      <div class="wb-settings-title">悬浮球设置</div>
      <div class="wb-setting-row">
        <label>大小: {{ settingsStore.settings.ballSize }}px</label>
        <input type="range" min="32" max="96" :value="settingsStore.settings.ballSize"
          @input="settingsStore.settings.ballSize = Number(($event.target as HTMLInputElement).value)" />
      </div>
      <div class="wb-setting-row">
        <label>透明度: {{ Math.round(settingsStore.settings.ballOpacity * 100) }}%</label>
        <input type="range" min="0.2" max="1" step="0.05" :value="settingsStore.settings.ballOpacity"
          @input="settingsStore.settings.ballOpacity = Number(($event.target as HTMLInputElement).value)" />
      </div>
      <div class="wb-setting-row">
        <label>自定义图标</label>
        <div class="wb-setting-actions">
          <button class="wb-btn-sec" @click="uploadIcon">选择图片</button>
          <button class="wb-btn-del" v-if="settingsStore.settings.customIcon" @click="settingsStore.settings.customIcon = null">重置</button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileSelected" />
      </div>
      <div class="wb-setting-footer">
        <button class="wb-btn-primary" @click="showSettings = false">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from './settings';
import { useWorldbookStore } from './store';

const settingsStore = useSettingsStore();
const store = useWorldbookStore();

const fileInput = ref<HTMLInputElement>();
const showSettings = ref(false);
const ballRef = ref<HTMLElement>();
const startPos = ref({ x: 0, y: 0 });
const moved = ref(false);
const longPressTimer = ref<number>();

function toggleWhitelist(name: string) {
  const list = settingsStore.settings.whitelist;
  const idx = list.indexOf(name);
  if (idx >= 0) { list.splice(idx, 1); }
  else { list.push(name); }
}

function uploadIcon() { fileInput.value?.click(); }

function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { settingsStore.settings.customIcon = reader.result as string; };
  reader.readAsDataURL(file);
}

async function onApply() {
  await store.applySwitch(settingsStore.settings.whitelist);
}

function selectOnly(name: string) {
  store.selectOnly(name);
}

function onBallClick() {
  if (moved.value) return;
  store.togglePanel();
}

function onPointerDown(e: PointerEvent) {
  const el = ballRef.value;
  if (!el) return;
  moved.value = false;
  startPos.value = { x: e.clientX, y: e.clientY };
  el.setPointerCapture(e.pointerId);
  const rect = el.getBoundingClientRect();
  const dx = e.clientX - rect.left;
  const dy = e.clientY - rect.top;

  // Long-press for mobile (opens settings)
  longPressTimer.value = window.setTimeout(() => {
    showSettings.value = true;
    moved.value = true;
  }, 600);

  const onMove = (ev: PointerEvent) => {
    const dist = Math.hypot(ev.clientX - startPos.value.x, ev.clientY - startPos.value.y);
    if (dist > 5) {
      moved.value = true;
      window.clearTimeout(longPressTimer.value);
    }
    const size = settingsStore.settings.ballSize;
    settingsStore.settings.ballPosition = {
      x: Math.max(0, Math.min(ev.clientX - dx, window.innerWidth - size)),
      y: Math.max(0, Math.min(ev.clientY - dy, window.innerHeight - size)),
    };
  };
  const onUp = (ev: PointerEvent) => {
    window.clearTimeout(longPressTimer.value);
    el.releasePointerCapture?.(ev.pointerId);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

const ballStyle = computed(() => {
  const s = settingsStore.settings;
  return {
    width: `${s.ballSize}px`,
    height: `${s.ballSize}px`,
    opacity: s.ballOpacity,
    left: s.ballPosition ? `${s.ballPosition.x}px` : undefined,
    right: s.ballPosition ? undefined : '24px',
    bottom: s.ballPosition ? `${s.ballPosition.y}px` : '24px',
  } as any;
});

// Load once on first panel open
watch(() => store.panelVisible, (v) => {
  if (v && !store.loadedOnce) store.loadWorldbook();
});

// Expose toggle for slash command
const togglePanel = () => store.togglePanel();
defineExpose({ togglePanel });
(window as any).__wbTogglePanel = togglePanel;
</script>

<style scoped>
.wb-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,0.25);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.wb-panel {
  background: #fff; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  width: 100%; max-width: 460px; max-height: 80vh;
  display: flex; flex-direction: column; overflow: hidden;
  color: #333; font-size: 14px; line-height: 1.4;
}
.wb-header { padding: 16px 18px 10px; border-bottom: 1px solid #eee; }
.wb-title-row { display: flex; align-items: center; justify-content: space-between; }
.wb-title { font-size: 17px; font-weight: 600; color: #222; }
.wb-subtitle { font-size: 12px; color: #999; margin-top: 3px; word-break: break-all; }
.wb-warning { color: #e67e22; }
.wb-btn-icon {
  background: none; border: none; padding: 5px; cursor: pointer;
  color: #999; border-radius: 6px; transition: .2s;
}
.wb-btn-icon:hover { background: #f0f0f0; color: #555; }
.wb-btn-icon:disabled { opacity: .4; cursor: not-allowed; }
.wb-spinning { animation: wb-spin .8s linear infinite; }
@keyframes wb-spin { to { transform: rotate(360deg); } }

.wb-loading { padding: 32px; text-align: center; color: #999; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.wb-spinner { width: 22px; height: 22px; border: 3px solid #e0e0e0; border-top-color: #777; border-radius: 50%; animation: wb-spin .8s linear infinite; }

.wb-body { flex: 1; overflow-y: auto; padding: 10px 18px; }
.wb-group { background: #f8f8f8; border-radius: 10px; margin-bottom: 8px; border: 1px solid #eee; overflow: hidden; }
.wb-group-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; }
.wb-label { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; cursor: pointer; }
.wb-cb { width: 16px; height: 16px; accent-color: #4a90d9; flex-shrink: 0; }
.wb-group-name { font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-count { font-size: 11px; color: #aaa; white-space: nowrap; flex-shrink: 0; }
.wb-star { background: none; border: none; padding: 3px; cursor: pointer; color: #ddd; flex-shrink: 0; transition: .2s; }
.wb-star:hover { color: #f1c40f; }
.wb-star.active { color: #f1c40f; }
.wb-only-btn {
  background: none; border: 1px solid #e0e0e0; border-radius: 5px; padding: 3px 7px;
  font-size: 11px; color: #888; cursor: pointer; flex-shrink: 0; transition: .2s;
}
.wb-only-btn:hover { border-color: #4a90d9; color: #4a90d9; }

.wb-entries { border-top: 1px solid #eee; padding: 2px 0; }
.wb-entry { display: flex; justify-content: space-between; padding: 3px 10px 3px 38px; font-size: 12px; color: #666; }
.wb-entry.off { color: #ccc; text-decoration: line-through; }
.wb-entry-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.wb-entry-status { font-size: 10px; font-weight: 600; margin-left: 6px; flex-shrink: 0; }
.wb-entry.off .wb-entry-status { color: #ddd; }
.wb-entry:not(.off) .wb-entry-status { color: #4a90d9; }

.wb-empty { padding: 28px 18px; text-align: center; color: #bbb; font-size: 13px; }
.wb-footer { padding: 10px 18px 16px; border-top: 1px solid #eee; }
.wb-btn-primary {
  width: 100%; padding: 9px; background: #4a90d9; color: #fff; border: none;
  border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: .2s;
}
.wb-btn-primary:hover:not(:disabled) { background: #357abd; }
.wb-btn-primary:disabled { background: #ccc; cursor: not-allowed; }

/* Floating Ball */
.wb-ball {
  position: fixed; z-index: 99998; border-radius: 50%;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: #fff; display: flex; align-items: center; justify-content: center;
  cursor: grab; box-shadow: 0 4px 12px rgba(74,144,217,.3);
  transition: transform .15s, box-shadow .15s;
  user-select: none; -webkit-user-select: none; touch-action: none;
}
.wb-ball:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(74,144,217,.4); }
.wb-ball:active { cursor: grabbing; }
.wb-ball-svg { width: 50%; height: 50%; }
.wb-ball-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }

/* Settings */
.wb-settings { background: #fff; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,.1); padding: 20px; width: 100%; max-width: 340px; }
.wb-settings-title { font-size: 15px; font-weight: 600; color: #222; margin-bottom: 14px; }
.wb-setting-row { margin-bottom: 12px; }
.wb-setting-row label { display: block; font-size: 12px; color: #666; margin-bottom: 3px; }
.wb-setting-row input[type='range'] { width: 100%; accent-color: #4a90d9; }
.wb-setting-actions { display: flex; gap: 6px; }
.wb-btn-sec { padding: 5px 10px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 5px; font-size: 12px; color: #666; cursor: pointer; }
.wb-btn-sec:hover { background: #e4e4e4; }
.wb-btn-del { padding: 5px 10px; background: #fff0f0; border: 1px solid #fcc; border-radius: 5px; font-size: 12px; color: #c0392b; cursor: pointer; }
.wb-btn-del:hover { background: #ffe0e0; }
.wb-setting-footer { display: flex; justify-content: flex-end; margin-top: 12px; }
.wb-setting-footer .wb-btn-primary { width: auto; padding: 7px 20px; font-size: 13px; }

@media (max-width: 480px) {
  .wb-panel { max-width: 100%; max-height: 90vh; border-radius: 12px; }
  .wb-overlay { padding: 8px; }
}
</style>