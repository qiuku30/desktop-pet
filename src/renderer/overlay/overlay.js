// Overlay 渲染逻辑
(async function () {
  try {
    const config = await window.overlayAPI.getConfig();

    if (!config) {
      console.warn('[overlay] 未获取到配置，关闭窗口');
      window.overlayAPI.close(null);
      return;
    }

    // 注入 HTML 内容
    if (config.html) {
      document.getElementById('overlay-content').innerHTML = config.html;
    }

    // 事件委托：监听内容区所有 [data-overlay-result] 点击
    document.getElementById('overlay-content').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-overlay-result]');
      if (!btn) return;

      const raw = btn.dataset.overlayResult;
      let value = null;
      try {
        value = JSON.parse(raw);
      } catch (_) {
        // 如果解析失败，当做原始字符串
        value = raw;
      }
      window.overlayAPI.close(value);
    });
  } catch (err) {
    console.error('[overlay] 初始化失败:', err);
    window.overlayAPI.close(null);
  }
})();
