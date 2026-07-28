import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('./overlay.js', import.meta.url), 'utf8')

function element(dataset = {}) {
  return {
    dataset,
    value: '',
    min: '',
    max: '',
    closest(selector) {
      if (selector === 'input[type="number"]') return null
      const key = selector.match(/^\[data-([a-z-]+)\]$/)?.[1]
      if (!key) return null
      const prop = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      return Object.hasOwn(this.dataset, prop) ? this : null
    },
  }
}

async function createHarness() {
  const listeners = {}
  const inputs = {}
  const content = {
    innerHTML: '',
    addEventListener(type, listener) {
      listeners[type] = listener
    },
  }
  const closes = []
  const context = {
    console,
    document: {
      getElementById(id) {
        if (id === 'overlay-content') return content
        return inputs[id] || null
      },
    },
    window: {
      overlayAPI: {
        getConfig: async () => ({ html: '<div>configured</div>' }),
        close: value => closes.push(value),
      },
    },
  }
  vm.runInNewContext(source, context)
  await new Promise(resolve => setImmediate(resolve))
  return {
    closes,
    inputs,
    dispatch(type, target) {
      listeners[type]?.({ target })
    },
  }
}

function quantityInput(value = '1') {
  return { value, min: '1', max: '12' }
}

test('quantity step buttons decrement and increment within bounds', async () => {
  const harness = await createHarness()
  harness.inputs.quantity = quantityInput('1')

  harness.dispatch('click', element({ quantityStep: '-1', quantityInput: 'quantity' }))
  assert.equal(harness.inputs.quantity.value, '1')
  harness.dispatch('click', element({ quantityStep: '1', quantityInput: 'quantity' }))
  assert.equal(harness.inputs.quantity.value, '2')
})

test('direct invalid quantity input is floored and clamped', async () => {
  const harness = await createHarness()
  const input = quantityInput('7.8')
  input.dataset = {}
  input.closest = selector => selector === 'input[type="number"]' ? input : null
  harness.inputs.quantity = input

  harness.dispatch('change', input)
  assert.equal(input.value, '7')
  input.value = 'not-a-number'
  harness.dispatch('change', input)
  assert.equal(input.value, '1')
})

test('all button selects max and confirmation returns action with quantity', async () => {
  const harness = await createHarness()
  harness.inputs.quantity = quantityInput('2')

  harness.dispatch('click', element({ quantityAll: '', quantityInput: 'quantity' }))
  assert.equal(harness.inputs.quantity.value, '12')
  harness.dispatch('click', element({
    overlayQuantityAction: 'sell',
    overlayQuantityInput: 'quantity',
  }))
  assert.equal(JSON.stringify(harness.closes), JSON.stringify([{ action: 'sell', quantity: 12 }]))
})

test('fixed overlay result remains backward compatible', async () => {
  const harness = await createHarness()
  harness.dispatch('click', element({ overlayResult: '{"ok":true}' }))
  harness.dispatch('click', element({ overlayResult: 'confirm' }))
  assert.equal(JSON.stringify(harness.closes), JSON.stringify([{ ok: true }, 'confirm']))
})

test('quantity confirmation rejects a missing input', async () => {
  const harness = await createHarness()
  harness.dispatch('click', element({
    overlayQuantityAction: 'destroy',
    overlayQuantityInput: 'missing',
  }))
  assert.deepEqual(harness.closes, [])
})
