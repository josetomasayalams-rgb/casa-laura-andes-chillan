import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { LANDING_ROOT } from '../../scripts/destination/paths.mjs';
import {
  applyCatalogAccessTargets,
  baselineDistanceFromApartment,
  catalogDistanceIsValid,
  loadCatalogAccessTargets,
  withRoadDistance
} from '../../scripts/destination/distance-metadata.mjs';

const apartment = { lat: -36.9082176, lon: -71.4205745 };
const guide = JSON.parse(fs.readFileSync(path.join(LANDING_ROOT, 'data/destination-guide.json'), 'utf8'));

test('distance metadata distinguishes road, mapped, sector and trailhead targets', () => {
  const candidate = {
    id: 'candidate', location: { lat: -36.91, lon: -71.49 }, coordinateKind: 'center_candidate',
    status: 'candidate_coordinate', routingEligible: false, address: { value: 'Valle Las Trancas' }, discovery: {}
  };
  const candidateDistance = baselineDistanceFromApartment(candidate, apartment);
  assert.equal(candidateDistance.source, 'sector-apartment');
  assert.equal(candidateDistance.target, 'locality');
  assert.equal(candidateDistance.confidence, 'approximate');
  assert.equal(candidateDistance.label, 'Valle Las Trancas');

  const mapped = { ...candidate, id: 'mapped', coordinateKind: 'node', status: 'published', routingEligible: true, address: null };
  const mappedDistance = baselineDistanceFromApartment(mapped, apartment);
  assert.equal(mappedDistance.source, 'direct-apartment');
  assert.equal(mappedDistance.target, 'place');
  assert.equal(mappedDistance.confidence, 'mapped');

  const targets = loadCatalogAccessTargets(path.join(LANDING_ROOT, 'data/catalog-access-targets.json'));
  const [trail] = applyCatalogAccessTargets([{ ...mapped, id: targets[0].placeId, category: 'trail' }], targets);
  const road = withRoadDistance(trail, apartment, { meters: 587.2, accessNearby: false }, { quality: 'on_road', offsetMeters: 2 });
  assert.equal(road.distanceFromApartment.meters, 587.2);
  assert.equal(road.distanceFromApartment.source, 'road-trailhead-apartment');
  assert.equal(road.distanceFromApartment.target, 'trailhead');
  assert.equal(road.distanceFromApartment.confidence, 'verified');
  assert.equal(road.catalogAccess.label.es, 'Inicio por Andarivel Tata');
});

test('every public food and activity card has a finite, honest apartment distance', () => {
  const publicCatalog = guide.places.filter((place) => place.discovery?.apartment && !['hotel', 'cabin'].includes(place.category));
  assert.equal(publicCatalog.length, 115);
  assert.deepEqual(publicCatalog.filter((place) => !catalogDistanceIsValid(place)).map((place) => place.id), []);
  assert.ok(publicCatalog.some((place) => place.distanceFromApartment.source === 'sector-apartment'));
  assert.ok(publicCatalog.some((place) => place.distanceFromApartment.source === 'direct-apartment'));
  assert.ok(publicCatalog.some((place) => place.distanceFromApartment.source === 'road-apartment'));
  for (const place of publicCatalog.filter((item) => item.distanceFromApartment.source.startsWith('road-'))) {
    assert.ok(Number.isFinite(place.discovery.apartmentRoadDistanceMeters), `${place.id} claims a road distance without a route`);
  }
  for (const place of publicCatalog.filter((item) => item.distanceFromApartment.source === 'sector-apartment')) {
    assert.ok(place.distanceFromApartment.label, `${place.id} lacks a sector label`);
  }
  for (const place of publicCatalog.filter((item) => item.category === 'trail')) {
    assert.equal(place.distanceFromApartment.target, 'trailhead', `${place.id} must measure to the trailhead`);
    assert.ok(place.catalogAccess?.source?.url, `${place.id} lacks trailhead provenance`);
  }
});

test('generated food and activity cards never ship an empty apartment distance', () => {
  for (const page of ['restaurantes.html', 'actividades.html']) {
    const html = fs.readFileSync(path.join(LANDING_ROOT, page), 'utf8');
    const cards = [...html.matchAll(/<article class="rest-card catalog-card"[^>]+>/g)].map((match) => match[0]);
    assert.ok(cards.length > 50, `${page} unexpectedly lost catalog coverage`);
    for (const card of cards) {
      assert.match(card, /data-apartment-distance="\d+(?:\.\d+)?"/);
      assert.doesNotMatch(card, /data-(?:apartment-)?distance-source="(?:unknown)?"/);
      assert.match(card, /data-distance-target="(?:place|locality|trailhead)"/);
    }
  }
});
