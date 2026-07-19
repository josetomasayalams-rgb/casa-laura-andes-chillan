(function () {
  'use strict';

  function translate(key, fallback) {
    if (window.GH_I18N && typeof window.GH_I18N.t === 'function') {
      return window.GH_I18N.t(key) || fallback;
    }
    return fallback;
  }

  function format(key, values, fallback) {
    if (window.GH_I18N && typeof window.GH_I18N.format === 'function') {
      return window.GH_I18N.format(key, values);
    }
    return Object.keys(values).reduce(function (copy, name) {
      return copy.replace('{' + name + '}', values[name]);
    }, fallback);
  }

  function initWifi() {
    var button = document.querySelector('[data-wifi-copy]');
    var password = document.querySelector('[data-wifi-password]');
    var label = document.querySelector('[data-wifi-copy-label]');
    var status = document.querySelector('[data-wifi-status]');
    var resetTimer = null;

    if (!button || !password || !label || !status) return;

    function fallbackCopy(value) {
      var input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      var copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('copy failed');
    }

    async function copyPassword() {
      var value = password.textContent.trim();

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
        } else {
          fallbackCopy(value);
        }

        label.textContent = translate('wifi.copied', 'Copiada');
        status.textContent = translate('wifi.copy.success', 'Contraseña copiada.');
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(function () {
          label.textContent = translate('wifi.copy', 'Copiar');
          status.textContent = '';
        }, 8000);
      } catch (error) {
        status.textContent = translate('wifi.copy.error', 'No se pudo copiar. Mantén presionada la contraseña.');
      }
    }

    button.addEventListener('click', copyPassword);
  }

  function initThermostatGuide() {
    var guide = document.querySelector('.thermostat-guide');
    var answer = document.querySelector('[data-thermostat-answer]');
    var choices = Array.prototype.slice.call(document.querySelectorAll('[data-thermostat-choice]'));

    if (!guide || !answer || !choices.length) return;

    function selectChoice(choice) {
      var key = choice === 'warmer'
        ? 'manual.thermostat.answer.warmer'
        : 'manual.thermostat.answer.comfortable';

      for (var index = 0; index < choices.length; index += 1) {
        choices[index].setAttribute(
          'aria-pressed',
          choices[index].getAttribute('data-thermostat-choice') === choice ? 'true' : 'false'
        );
      }
      guide.setAttribute('data-thermostat-decision', choice);
      answer.setAttribute('data-answer-key', key);
      answer.setAttribute('data-i18n', key);
      answer.textContent = translate(key, '');
    }

    for (var index = 0; index < choices.length; index += 1) {
      choices[index].addEventListener('click', function () {
        selectChoice(this.getAttribute('data-thermostat-choice'));
      });
    }
  }

  function initRules() {
    var rules = Array.prototype.slice.call(document.querySelectorAll('[data-manual-rule]'));
    var filters = Array.prototype.slice.call(document.querySelectorAll('[data-rule-filter]'));
    var expand = document.querySelector('[data-rules-expand]');
    var collapse = document.querySelector('[data-rules-collapse]');
    var count = document.querySelector('[data-rule-count]');
    var activeFilter = 'all';

    if (!rules.length || !filters.length || !expand || !collapse || !count) return;

    function visibleRules() {
      return rules.filter(function (rule) { return !rule.hidden; });
    }

    function renderCount() {
      count.textContent = format(
        'manual.rules.count',
        { shown: visibleRules().length, total: rules.length },
        '{shown} de {total} reglas'
      );
    }

    function applyFilter(nextFilter) {
      activeFilter = nextFilter || 'all';
      for (var filterIndex = 0; filterIndex < filters.length; filterIndex += 1) {
        filters[filterIndex].setAttribute(
          'aria-pressed',
          filters[filterIndex].getAttribute('data-rule-filter') === activeFilter ? 'true' : 'false'
        );
      }
      for (var ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
        var visible = activeFilter === 'all' || rules[ruleIndex].getAttribute('data-rule-category') === activeFilter;
        rules[ruleIndex].hidden = !visible;
        if (!visible) rules[ruleIndex].open = false;
      }
      renderCount();
    }

    for (var index = 0; index < filters.length; index += 1) {
      filters[index].addEventListener('click', function () {
        applyFilter(this.getAttribute('data-rule-filter'));
      });
    }

    expand.addEventListener('click', function () {
      var visible = visibleRules();
      for (var index = 0; index < visible.length; index += 1) visible[index].open = true;
    });

    collapse.addEventListener('click', function () {
      for (var index = 0; index < rules.length; index += 1) rules[index].open = false;
    });

    function openHashTarget() {
      var hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;
      var target = document.getElementById(hash);
      if (!target) return;
      var rule = target.matches && target.matches('[data-manual-rule]') ? target : null;
      if (rule) {
        if (rule.hidden) applyFilter('all');
        rule.open = true;
      }
      window.setTimeout(function () {
        target.scrollIntoView({ block: 'start' });
      }, 0);
    }

    applyFilter(activeFilter);
    window.addEventListener('hashchange', openHashTarget);
    window.addEventListener('cordal:access-granted', openHashTarget);
    window.setTimeout(openHashTarget, 0);

    if (window.GH_I18N && typeof window.GH_I18N.subscribe === 'function') {
      window.GH_I18N.subscribe(renderCount);
    }
  }

  initWifi();
  initThermostatGuide();
  initRules();
})();
