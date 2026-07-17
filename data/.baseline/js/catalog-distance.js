(function () {
  'use strict';

  var page = document.body.getAttribute('data-page');
  var grid = document.querySelector('.rest-grid');
  var sortButton = document.querySelector('[data-sort-distance]');
  if (!grid || !sortButton || (page !== 'restaurantes' && page !== 'actividades')) return;

  var catalogName = page === 'restaurantes' ? 'restaurants' : 'activities';
  var home = null;
  var placeById = new Map();
  var sorted = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function distanceKm(a, b) {
    var radians = Math.PI / 180;
    var dLat = (b.lat - a.lat) * radians;
    var dLon = (b.lon - a.lon) * radians;
    var h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function distanceFor(card) {
    var place = placeById.get(card.getAttribute('data-id'));
    return place ? distanceKm(home, place) : Number.POSITIVE_INFINITY;
  }

  function formatDistance(distance) {
    if (!Number.isFinite(distance)) return window.GH_I18N.t('nearby.distance.unknown');
    var lang = window.GH_I18N.getLang();
    return new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : lang, { maximumFractionDigits: distance < 10 ? 1 : 0 }).format(distance) + ' km';
  }

  function addDistance(card) {
    if (card.querySelector('.catalog-distance')) return;
    var badge = document.createElement('span');
    badge.className = 'catalog-distance';
    badge.textContent = formatDistance(distanceFor(card));
    var head = card.querySelector('.rest-card__head') || card;
    head.appendChild(badge);
  }

  function appendMissing(places) {
    var existing = new Set(Array.from(grid.querySelectorAll('[data-id]')).map(function (card) { return card.getAttribute('data-id'); }));
    places.forEach(function (place) {
      if (existing.has(place.id)) return;
      var article = document.createElement('article');
      article.className = 'rest-card rest-card--mapped';
      article.setAttribute('data-id', place.id);
      if (catalogName === 'restaurants') article.setAttribute('data-categories', place.category === 'groceries' ? 'supermercado' : 'restaurante');
      else article.setAttribute('data-module', 'senderos');
      var categoryKey = place.category === 'groceries' ? 'nearby.cat.groceries' : (catalogName === 'activities' ? 'nearby.cat.activities' : 'nearby.cat.food');
      article.innerHTML = '<header class="rest-card__head"><div class="rest-card__head-text"><h3 class="rest-card__name">' + escapeHtml(place.name) + '</h3>' +
        '<div class="rest-card__cats"><span class="rr-cat">' + escapeHtml(window.GH_I18N.t(categoryKey)) + '</span></div></div></header>' +
        '<p class="rest-card__desc">' + escapeHtml(place.sector) + (place.precision === 'approximate' ? ' · ≈ ' + escapeHtml(window.GH_I18N.t('nearby.approx')) : '') + '</p>' +
        '<div class="rest-card__ctas"><a class="rest-card__cta-maps" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(place.lat + ',' + place.lon) + '">📍 ' + escapeHtml(window.GH_I18N.t('nearby.directions')) + '</a></div>';
      grid.appendChild(article);
    });
  }

  function sortCards() {
    var cards = Array.from(grid.querySelectorAll('.rest-card'));
    cards.forEach(addDistance);
    cards.sort(function (a, b) {
      var delta = distanceFor(a) - distanceFor(b);
      if (Number.isFinite(delta) && delta !== 0) return delta;
      return a.textContent.localeCompare(b.textContent);
    }).forEach(function (card) { grid.appendChild(card); });
    sorted = true;
    sortButton.classList.add('rest-filter__btn--active');
    sortButton.setAttribute('aria-pressed', 'true');
  }

  sortButton.addEventListener('click', function () { sortCards(); });

  fetch('data/nearby.json').then(function (response) { return response.json(); }).then(function (data) {
    home = data.coverage.home;
    var catalogPlaces = data.places.filter(function (place) { return place.catalog === catalogName; });
    catalogPlaces.forEach(function (place) { placeById.set(place.id, place); });
    appendMissing(catalogPlaces);
    grid.querySelectorAll('.rest-card').forEach(addDistance);
    document.dispatchEvent(new CustomEvent('catalog:updated'));
  }).catch(function () { /* catalog remains usable without enrichment */ });

  if (window.GH_I18N) window.GH_I18N.subscribe(function () {
    grid.querySelectorAll('.catalog-distance').forEach(function (badge) {
      badge.textContent = formatDistance(distanceFor(badge.closest('.rest-card')));
    });
    if (sorted) sortCards();
  });
})();
