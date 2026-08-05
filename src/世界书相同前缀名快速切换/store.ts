import type { SettingsType } from './settings';

export interface EntryGroup {
  name: string;
  entries: WorldbookEntry[];
}

function longestCommonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.substring(0, i);
}

function groupEntries(entries: WorldbookEntry[]): EntryGroup[] {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const result: EntryGroup[] = [];
  let current: WorldbookEntry[] = [sorted[0]];
  let prefix = sorted[0].name;
  for (let i = 1; i < sorted.length; i++) {
    const p = longestCommonPrefix(sorted[i - 1].name, sorted[i].name);
    if (p.length >= 2) {
      current.push(sorted[i]);
      prefix = longestCommonPrefix(prefix, sorted[i].name);
    } else {
      result.push({ name: prefix, entries: [...current] });
      current = [sorted[i]];
      prefix = sorted[i].name;
    }
  }
  if (current.length) result.push({ name: prefix, entries: [...current] });
  return result;
}

export const useWorldbookStore = defineStore('worldbook', () => {
  const primaryWorldbookName = ref('');
  const entries = ref<WorldbookEntry[]>([]);
  const groups = ref<EntryGroup[]>([]);
  const selectedGroups = ref<Set<string>>(new Set());
  const loading = ref(false);
  const panelVisible = ref(false);
  const loadedOnce = ref(false);

  async function loadWorldbook() {
    loading.value = true;
    try {
      const charWb = getCharWorldbookNames('current');
      primaryWorldbookName.value = charWb.primary ?? '';
      if (!primaryWorldbookName.value) {
        groups.value = [];
        entries.value = [];
        return;
      }
      const wbEntries = await getWorldbook(primaryWorldbookName.value);
      entries.value = wbEntries;
      const grouped = groupEntries(wbEntries);
      groups.value = grouped;
      selectedGroups.value = new Set(grouped.map(g => g.name));
      loadedOnce.value = true;
    } catch (e) {
      console.error('加载世界书失败:', e);
      toastr.error('加载世界书失败');
    } finally {
      loading.value = false;
    }
  }

  function toggleGroup(name: string) {
    const s = new Set(selectedGroups.value);
    s.has(name) ? s.delete(name) : s.add(name);
    selectedGroups.value = s;
  }

  function selectOnly(name: string) {
    selectedGroups.value = new Set([name]);
  }

  async function applySwitch(whitelist: string[]) {
    if (!primaryWorldbookName.value || !groups.value.length) return;
    const enable = new Set(selectedGroups.value);
    const toDisable = groups.value.filter(g => !enable.has(g.name) && !whitelist.includes(g.name));
    const toDisableUids = new Set(toDisable.flatMap(g => g.entries.map(e => e.uid)));

    const hasChanges = entries.value.some(e => {
      if (toDisableUids.has(e.uid) && e.enabled) return true;
      const gName = groups.value.find(g => g.entries.some(ge => ge.uid === e.uid))?.name;
      if (gName && enable.has(gName) && !e.enabled) return true;
      return false;
    });
    if (!hasChanges) { toastr.info('没有需要变更的条目'); return; }

    const updated = entries.value.map(e => {
      const gName = groups.value.find(g => g.entries.some(ge => ge.uid === e.uid))?.name ?? '';
      if (whitelist.includes(gName)) return e;
      if (toDisableUids.has(e.uid)) return { ...e, enabled: false };
      if (enable.has(gName)) return { ...e, enabled: true };
      return e;
    });

    await replaceWorldbook(primaryWorldbookName.value, updated);
    entries.value = updated;
    toastr.success('分组切换已应用');

    // Sync selection state with actual states
    const newSelected = new Set<string>();
    for (const g of groups.value) {
      const allEnabled = g.entries.every(e => {
        const found = updated.find(u => u.uid === e.uid);
        return found ? found.enabled : e.enabled;
      });
      if (allEnabled) newSelected.add(g.name);
    }
    selectedGroups.value = newSelected;
  }

  function togglePanel() { panelVisible.value = !panelVisible.value; }
  function hidePanel() { panelVisible.value = false; }

  return {
    primaryWorldbookName,
    entries,
    groups,
    selectedGroups,
    loading,
    panelVisible,
    loadedOnce,
    loadWorldbook,
    toggleGroup,
    selectOnly,
    applySwitch,
    togglePanel,
    hidePanel,
  };
});