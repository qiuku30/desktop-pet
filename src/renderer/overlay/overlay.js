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

    const content = document.getElementById('overlay-content');

    function quantityInputFor(control, explicitId) {
      if (explicitId) return document.getElementById(explicitId);
      return control.parentElement?.querySelector?.('input[type="number"]') || null;
    }

    function normalizeQuantity(input) {
      if (!input) return null;
      const min = Number.parseInt(input.min, 10);
      const max = Number.parseInt(input.max, 10);
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) return null;

      const parsed = Number.parseFloat(input.value);
      const quantity = Number.isFinite(parsed)
        ? Math.min(max, Math.max(min, Math.floor(parsed)))
        : min;
      input.value = String(quantity);
      return quantity;
    }

    content.addEventListener('change', (e) => {
      const input = e.target.closest('input[type="number"]');
      if (input) normalizeQuantity(input);
    });

    // 事件委托：固定结果与通用数量结果共用同一关闭通道。
    content.addEventListener('click', (e) => {
      const stepButton = e.target.closest('[data-quantity-step]');
      if (stepButton) {
        const input = quantityInputFor(stepButton, stepButton.dataset.quantityInput);
        const current = normalizeQuantity(input);
        const step = Number.parseInt(stepButton.dataset.quantityStep, 10);
        if (current !== null && Number.isSafeInteger(step)) {
          input.value = String(current + step);
          normalizeQuantity(input);
        }
        return;
      }

      const allButton = e.target.closest('[data-quantity-all]');
      if (allButton) {
        const input = quantityInputFor(allButton, allButton.dataset.quantityInput);
        if (input && Number.isSafeInteger(Number.parseInt(input.max, 10))) {
          input.value = input.max;
          normalizeQuantity(input);
        }
        return;
      }

      const quantityButton = e.target.closest('[data-overlay-quantity-action]');
      if (quantityButton) {
        const input = quantityInputFor(
          quantityButton,
          quantityButton.dataset.overlayQuantityInput,
        );
        const quantity = normalizeQuantity(input);
        if (quantity === null || !Number.isSafeInteger(quantity)) return;
        window.overlayAPI.close({
          action: quantityButton.dataset.overlayQuantityAction,
          quantity,
        });
        return;
      }

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
