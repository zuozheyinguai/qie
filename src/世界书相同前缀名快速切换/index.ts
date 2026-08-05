import { useSettingsStore } from './settings';
import { useWorldbookStore } from './store';
import App from './App.vue';

function registerSlashCommand(toggleFn: () => void) {
  try {
    if (!SillyTavern?.SlashCommandParser) return;
    const cmd = new SillyTavern.SlashCommand(
      null,
      'wb-panel',
      '打开/关闭世界书分组切换面板',
      '/wb-panel - 切换面板',
      true, true,
      async () => { toggleFn(); return ''; },
      null, null, null,
    );
    SillyTavern.SlashCommandParser.addCommandObject(cmd);
    console.info('[wb-panel] 斜杠命令已注册');
  } catch (e) {
    console.warn('[wb-panel] 注册斜杠命令失败:', e);
  }
}

$(() => {
  const app = createApp(App);
  app.use(createPinia());

  const $mount = $('<div>').appendTo('body');
  app.mount($mount[0]);

  // Slash command via global ref set by App.vue
  const waitForToggle = setInterval(() => {
    const fn = (window as any).__wbTogglePanel;
    if (fn) {
      clearInterval(waitForToggle);
      if (typeof SillyTavern?.SlashCommandParser !== 'undefined') {
        registerSlashCommand(fn);
      } else {
        eventOnce(tavern_events.APP_READY, () => registerSlashCommand(fn));
      }
    }
  }, 100);

  $(window).on('pagehide', () => {
    clearInterval(waitForToggle);
    app.unmount();
    $mount.remove();
  });

  console.info('[wb-panel] 世界书相同前缀名快速切换 v1.0 已加载');
});