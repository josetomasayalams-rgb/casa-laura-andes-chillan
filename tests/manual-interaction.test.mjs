import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(SITE, 'js/manual.js'), 'utf8');

class FakeElement {
  constructor(attributes = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.id = attributes.id || '';
    this.textContent = '';
    this.hidden = false;
    this.open = false;
    this.scrolled = false;
    this.listeners = new Map();
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) {
      listener.call(this, { type, target: this, currentTarget: this });
    }
  }

  click() {
    this.dispatch('click');
  }

  matches(selector) {
    return selector === '[data-manual-rule]' && this.attributes.has('data-manual-rule');
  }

  scrollIntoView() {
    this.scrolled = true;
  }
}

const RULES = [
  ['arrival-departure', 'arrival'],
  ['guests', 'coexistence'],
  ['quiet-parties', 'coexistence'],
  ['lodging-use', 'coexistence'],
  ['cleaning-trash', 'care'],
  ['smoking', 'coexistence'],
  ['textiles', 'care'],
  ['locker-key', 'arrival'],
  ['parking', 'arrival'],
  ['common-areas', 'arrival'],
  ['damage-loss', 'care'],
  ['personal-items', 'responsibility'],
  ['noncompliance', 'responsibility']
];

function setupManual() {
  const guide = new FakeElement();
  const answer = new FakeElement({
    'data-answer-key': 'manual.thermostat.answer.idle',
    'data-i18n': 'manual.thermostat.answer.idle'
  });
  const choices = ['comfortable', 'warmer'].map((choice) => new FakeElement({
    'data-thermostat-choice': choice,
    'aria-pressed': 'false'
  }));
  const rules = RULES.map(([name, category]) => new FakeElement({
    id: `regla-${name}`,
    'data-manual-rule': name,
    'data-rule-category': category
  }));
  const filters = ['all', 'arrival', 'coexistence', 'care', 'responsibility'].map((filter) => new FakeElement({
    'data-rule-filter': filter,
    'aria-pressed': filter === 'all' ? 'true' : 'false'
  }));
  const expand = new FakeElement();
  const collapse = new FakeElement();
  const count = new FakeElement();
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const windowListeners = new Map();
  let countTemplate = '{shown} de {total} reglas';
  let i18nSubscriber = null;

  const first = new Map([
    ['.thermostat-guide', guide],
    ['[data-thermostat-answer]', answer],
    ['[data-rules-expand]', expand],
    ['[data-rules-collapse]', collapse],
    ['[data-rule-count]', count]
  ]);
  const all = new Map([
    ['[data-thermostat-choice]', choices],
    ['[data-manual-rule]', rules],
    ['[data-rule-filter]', filters]
  ]);

  const document = {
    querySelector(selector) {
      // Wi-Fi nodes are deliberately absent: the other widgets must still initialize.
      return first.get(selector) || null;
    },
    querySelectorAll(selector) {
      return all.get(selector) || [];
    },
    getElementById(id) {
      return byId.get(id) || null;
    }
  };
  const window = {
    location: { hash: '' },
    GH_I18N: {
      t(key) {
        if (key === 'manual.thermostat.answer.warmer') return 'Sube uno o dos grados para iniciar un nuevo ciclo.';
        if (key === 'manual.thermostat.answer.comfortable') return 'Déjalo así si el ambiente está cómodo.';
        return key;
      },
      format(key, values) {
        assert.equal(key, 'manual.rules.count');
        return countTemplate
          .replace('{shown}', String(values.shown))
          .replace('{total}', String(values.total));
      },
      subscribe(listener) {
        i18nSubscriber = listener;
      }
    },
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {}
  };
  const context = {
    window,
    document,
    navigator: {},
    Array,
    Object,
    String
  };
  vm.runInNewContext(SOURCE, context, { filename: 'js/manual.js' });

  return {
    guide,
    answer,
    choices,
    rules,
    filters,
    expand,
    collapse,
    count,
    setCountTemplate(template) { countTemplate = template; },
    notifyTranslation() {
      assert.equal(typeof i18nSubscriber, 'function');
      i18nSubscriber();
    },
    setHash(hash) { window.location.hash = hash; },
    dispatchWindow(type) {
      for (const listener of windowListeners.get(type) || []) listener({ type });
    }
  };
}

function named(elements) {
  return elements.map((element) => element.getAttribute('data-manual-rule'));
}

test('manual widgets initialize independently and keep rules, thermostat and deep links accessible', () => {
  const page = setupManual();
  const filter = (name) => page.filters.find((item) => item.getAttribute('data-rule-filter') === name);
  const choice = (name) => page.choices.find((item) => item.getAttribute('data-thermostat-choice') === name);
  const rule = (name) => page.rules.find((item) => item.getAttribute('data-manual-rule') === name);

  // The Wi-Fi widget is absent, yet thermostat and regulation listeners are active.
  choice('warmer').click();
  assert.equal(choice('comfortable').getAttribute('aria-pressed'), 'false');
  assert.equal(choice('warmer').getAttribute('aria-pressed'), 'true');
  assert.equal(page.guide.getAttribute('data-thermostat-decision'), 'warmer');
  assert.equal(page.answer.getAttribute('data-answer-key'), 'manual.thermostat.answer.warmer');
  assert.equal(page.answer.getAttribute('data-i18n'), 'manual.thermostat.answer.warmer');
  assert.equal(page.answer.textContent, 'Sube uno o dos grados para iniciar un nuevo ciclo.');

  filter('care').click();
  assert.deepEqual(named(page.rules.filter((item) => !item.hidden)), [
    'cleaning-trash',
    'textiles',
    'damage-loss'
  ]);
  assert.equal(page.count.textContent, '3 de 13 reglas');
  assert.equal(filter('care').getAttribute('aria-pressed'), 'true');
  assert.equal(filter('all').getAttribute('aria-pressed'), 'false');

  page.expand.click();
  assert.deepEqual(named(page.rules.filter((item) => item.open)), [
    'cleaning-trash',
    'textiles',
    'damage-loss'
  ]);

  // Collapse is global, including a hidden rule that might have been opened elsewhere.
  rule('guests').open = true;
  page.collapse.click();
  assert.equal(page.rules.some((item) => item.open), false);

  page.setCountTemplate('{shown}/{total} rules');
  page.notifyTranslation();
  assert.equal(page.count.textContent, '3/13 rules');

  // A deep link outside the active category clears the filter, then opens and scrolls it.
  page.setHash('#regla-guests');
  page.dispatchWindow('hashchange');
  assert.equal(page.rules.every((item) => !item.hidden), true);
  assert.equal(page.count.textContent, '13/13 rules');
  assert.equal(filter('all').getAttribute('aria-pressed'), 'true');
  assert.equal(filter('care').getAttribute('aria-pressed'), 'false');
  assert.equal(rule('guests').open, true);
  assert.equal(rule('guests').scrolled, true);
});
