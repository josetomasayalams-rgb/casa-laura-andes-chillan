(function () {
  'use strict';

  var results = document.getElementById('nearby-results');
  var filters = document.getElementById('nearby-filters');
  var locate = document.getElementById('nearby-locate');
  var status = document.getElementById('nearby-status');
  var count = document.getElementById('nearby-count');
  var empty = document.getElementById('nearby-empty');
  var search = document.getElementById('nearby-search');
  if (!results || !filters || !locate) return;

  var data = null;
  var origin = null;
  var activeFilter = 'all';
  var livePosition = false;
  var icon = { food: '🍽️', groceries: '🛒', fuel: '⛽', health: '🏥', hardware: '🛠️', police: '👮', fire: '🚒', activities: '🥾' };
  var mapQuery = { all: 'servicios', food: 'restaurante', groceries: 'supermercado', fuel: 'bencinera', health: 'posta CESFAM hospital clínica', hardware: 'ferretería', police: 'Carabineros', fire: 'Bomberos', activities: 'actividades turísticas' };

  function t(key) {
    return window.GH_I18N ? window.GH_I18N.t(key) : key;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function distanceKm(a, b) {
    var radians = Math.PI / 180;
    var dLat = (b.lat - a.lat) * radians;
    var dLon = (b.lon - a.lon) * radians;
    var lat1 = a.lat * radians;
    var lat2 = b.lat * radians;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function formatDistance(value) {
    var lang = window.GH_I18N ? window.GH_I18N.getLang() : 'es';
    return new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : lang, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value) + ' km';
  }

  function directionsUrl(place) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(place.lat + ',' + place.lon);
  }

  function updateSearch() {
    if (!origin) return;
    var query = mapQuery[activeFilter] || mapQuery.all;
    search.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query + ' cerca de ' + origin.lat + ',' + origin.lon);
  }

  function render() {
    if (!data || !origin) return;
    var places = data.places.filter(function (place) {
      return activeFilter === 'all' || place.category === activeFilter;
    }).map(function (place) {
      return { place: place, distance: distanceKm(origin, place) };
    }).sort(function (a, b) { return a.distance - b.distance; });

    results.innerHTML = places.map(function (entry) {
      var place = entry.place;
      var approximate = place.precision === 'approximate'
        ? '<span class="nearby-approx">≈ ' + escapeHtml(t('nearby.approx')) + '</span>' : '';
      var phone = place.phone
        ? '<a class="nearby-card__call" href="tel:' + escapeHtml(place.phone.replace(/\s+/g, '')) + '">' + escapeHtml(t('nearby.call')) + '</a>' : '';
      return '<article class="nearby-card">' +
        '<div class="nearby-card__top"><span class="nearby-card__icon" aria-hidden="true">' + (icon[place.category] || '📍') + '</span>' +
        '<div><h3>' + escapeHtml(place.name) + '</h3><p>' + escapeHtml(place.sector) + '</p></div>' +
        '<strong class="nearby-card__distance">' + escapeHtml(formatDistance(entry.distance)) + '</strong></div>' +
        '<div class="nearby-card__meta"><span>' + escapeHtml(t('nearby.cat.' + place.category)) + '</span>' + approximate + '</div>' +
        '<div class="nearby-card__actions"><a href="' + directionsUrl(place) + '" target="_blank" rel="noopener">' + escapeHtml(t('nearby.directions')) + '</a>' + phone + '</div>' +
        '</article>';
    }).join('');
    count.textContent = String(places.length);
    empty.hidden = places.length > 0;
    updateSearch();
  }

  function setStatus(key) {
    status.removeAttribute('data-i18n');
    status.textContent = t(key);
  }

  filters.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-nearby-filter]');
    if (!button) return;
    activeFilter = button.getAttribute('data-nearby-filter') || 'all';
    filters.querySelectorAll('button[data-nearby-filter]').forEach(function (candidate) {
      var active = candidate === button;
      candidate.classList.toggle('rest-filter__btn--active', active);
      candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    render();
  });

  locate.addEventListener('click', function () {
    if (!navigator.geolocation) { setStatus('nearby.denied'); return; }
    locate.disabled = true;
    setStatus('nearby.locating');
    navigator.geolocation.getCurrentPosition(function (position) {
      origin = { lat: position.coords.latitude, lon: position.coords.longitude };
      livePosition = true;
      locate.disabled = false;
      setStatus('nearby.live');
      render();
    }, function () {
      locate.disabled = false;
      setStatus('nearby.denied');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  });

  if (window.GH_I18N) {
    window.GH_I18N.subscribe(function () {
      setStatus(livePosition ? 'nearby.live' : 'nearby.home');
      render();
    });
  }

  fetch('data/nearby.json').then(function (response) {
    if (!response.ok) throw new Error('nearby data unavailable');
    return response.json();
  }).then(function (payload) {
    data = payload;
    origin = { lat: data.coverage.home.lat, lon: data.coverage.home.lon };
    render();
  }).catch(function () {
    empty.hidden = false;
    empty.textContent = t('nearby.empty');
  });
})();
