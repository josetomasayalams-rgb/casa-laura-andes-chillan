import fs from 'node:fs';
import { haversineMeters } from './geo.mjs';
import { navigationLinks } from './providers/common.mjs';

function finiteLocation(location) {
  return Boolean(location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lon)));
}

function roundedMeters(value) {
  return Number(Number(value).toFixed(1));
}

function placeConfidence(place) {
  if (place.status === 'candidate_coordinate' || place.routingEligible === false) return 'approximate';
  if (['manual_verified', 'google_maps_place', 'entrance', 'parking'].includes(place.coordinateKind)) return 'verified';
  return 'mapped';
}

export function loadCatalogAccessTargets(file) {
  if (!file || !fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const targets = Array.isArray(parsed) ? parsed : parsed.targets || [];
  return targets.filter((target) => target && target.placeId && finiteLocation(target.location));
}

export function applyCatalogAccessTargets(places, targets) {
  const byId = new Map(targets.map((target) => [target.placeId, target]));
  return places.map((place) => {
    const target = byId.get(place.id) || byId.get(place.legacyId);
    if (!target) return place;
    const location = { lat: Number(target.location.lat), lon: Number(target.location.lon) };
    return {
      ...place,
      catalogAccess: {
        type: 'trailhead',
        label: target.label,
        location,
        confidence: target.confidence || 'verified',
        roadDestinationId: target.roadDestinationId || place.id,
        ...navigationLinks(location),
        source: target.source || null
      }
    };
  });
}

export function distanceTarget(place) {
  if (finiteLocation(place.catalogAccess?.location)) {
    return {
      location: place.catalogAccess.location,
      target: 'trailhead',
      confidence: place.catalogAccess.confidence || 'verified',
      label: place.catalogAccess.label || null,
      roadDestinationId: place.catalogAccess.roadDestinationId || place.id
    };
  }
  const approximate = placeConfidence(place) === 'approximate';
  return {
    location: place.location,
    target: approximate ? 'locality' : 'place',
    confidence: placeConfidence(place),
    label: approximate ? place.address?.value || place.municipality || null : null,
    roadDestinationId: place.id
  };
}

export function baselineDistanceFromApartment(place, apartment) {
  const target = distanceTarget(place);
  if (!finiteLocation(target.location) || !finiteLocation(apartment)) return null;
  const accessTarget = target.target === 'trailhead';
  return {
    meters: roundedMeters(haversineMeters(apartment, target.location)),
    source: accessTarget ? 'direct-trailhead-apartment' : target.target === 'locality' ? 'sector-apartment' : 'direct-apartment',
    target: target.target,
    confidence: target.confidence,
    label: target.label,
    roadDestinationId: target.roadDestinationId,
    accessNearby: false,
    coverage: 'direct'
  };
}

export function withBaselineDistance(place, apartment) {
  return {
    ...place,
    distanceFromApartment: baselineDistanceFromApartment(place, apartment)
  };
}

export function withRoadDistance(place, apartment, route, snap) {
  const baseline = baselineDistanceFromApartment(place, apartment);
  let roadMeters = route?.meters ?? null;
  if (roadMeters !== null && baseline && roadMeters + 1 < baseline.meters) roadMeters = null;
  const accessTarget = baseline?.target === 'trailhead';
  const distanceFromApartment = roadMeters === null || !Number.isFinite(Number(roadMeters))
    ? baseline
    : {
        ...baseline,
        meters: roundedMeters(roadMeters),
        source: accessTarget ? 'road-trailhead-apartment' : 'road-apartment',
        accessNearby: Boolean(route?.accessNearby),
        coverage: 'covered'
      };
  return {
    ...place,
    distanceFromApartment,
    discovery: {
      ...place.discovery,
      apartmentRoadDistanceMeters: roadMeters,
      roadSnapStatus: snap?.quality || 'unavailable',
      roadSnapMeters: snap?.offsetMeters ?? null,
      roadAccessNearby: Boolean(route?.accessNearby)
    }
  };
}

export function catalogDistanceIsValid(place) {
  const value = place?.distanceFromApartment;
  if (!value || !Number.isFinite(Number(value.meters)) || Number(value.meters) < 0) return false;
  if (!['road-apartment', 'direct-apartment', 'sector-apartment', 'road-trailhead-apartment', 'direct-trailhead-apartment'].includes(value.source)) return false;
  if (!['place', 'locality', 'trailhead'].includes(value.target)) return false;
  if (value.source === 'sector-apartment' && value.target !== 'locality') return false;
  if (value.source.includes('trailhead') && value.target !== 'trailhead') return false;
  return true;
}
