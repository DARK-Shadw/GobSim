import { RELATIONSHIP } from '@shared/constants.js';

/**
 * Relationship utility functions. Pure functions operating on RelationshipRecord objects.
 * Records are stored per-goblin in goblin.relationships Map<goblinId → record>.
 */

// ── Record Creation ──

export function createRecord(targetId, sameFamily) {
  return {
    targetId,
    opinion: sameFamily ? RELATIONSHIP.SAME_FAMILY_BASE_OPINION : 0,
    trust: sameFamily ? RELATIONSHIP.SAME_FAMILY_BASE_TRUST : 0.1,
    familiarity: 0,
    tags: new Set(),
    lastProximityTick: 0,
    lastFoodShareTick: 0,
  };
}

export function getOrCreate(goblin, targetId, sameFamily) {
  let rec = goblin.relationships.get(targetId);
  if (!rec) {
    rec = createRecord(targetId, sameFamily);
    goblin.relationships.set(targetId, rec);
  }
  return rec;
}

// ── Adjusters ──

export function adjustOpinion(record, delta) {
  record.opinion = Math.max(RELATIONSHIP.OPINION_MIN,
    Math.min(RELATIONSHIP.OPINION_MAX, record.opinion + delta));
}

export function adjustTrust(record, delta) {
  record.trust = Math.max(RELATIONSHIP.TRUST_MIN,
    Math.min(RELATIONSHIP.TRUST_MAX, record.trust + delta));
}

export function adjustFamiliarity(record, delta) {
  record.familiarity = Math.max(0, Math.min(1, record.familiarity + delta));
}

// ── Tag Management ──

/**
 * Recompute tags based on current opinion/familiarity/age.
 * Returns { added: string[], removed: string[] } for narrator events.
 */
export function updateTags(record, goblinA, goblinB) {
  const added = [];
  const removed = [];

  // Friend / rival (opinion-based)
  if (record.opinion >= RELATIONSHIP.FRIEND_THRESHOLD && !record.tags.has('friend')) {
    record.tags.add('friend');
    record.tags.delete('rival');
    added.push('friend');
  } else if (record.opinion < RELATIONSHIP.FRIEND_THRESHOLD && record.tags.has('friend')) {
    record.tags.delete('friend');
    removed.push('friend');
  }

  if (record.opinion <= RELATIONSHIP.RIVAL_THRESHOLD && !record.tags.has('rival')) {
    record.tags.add('rival');
    record.tags.delete('friend');
    added.push('rival');
  } else if (record.opinion > RELATIONSHIP.RIVAL_THRESHOLD && record.tags.has('rival')) {
    record.tags.delete('rival');
    removed.push('rival');
  }

  // Mentor / pupil (age-based + familiarity gate)
  const ageDiff = goblinA.ageYears - goblinB.ageYears;
  if (ageDiff >= RELATIONSHIP.MENTOR_MIN_AGE_DIFF
      && record.familiarity >= RELATIONSHIP.MENTOR_FAMILIARITY
      && !record.tags.has('mentor')) {
    record.tags.add('mentor');
    added.push('mentor');
  } else if ((ageDiff < RELATIONSHIP.MENTOR_MIN_AGE_DIFF
      || record.familiarity < RELATIONSHIP.MENTOR_FAMILIARITY * 0.5)
      && record.tags.has('mentor')) {
    record.tags.delete('mentor');
    removed.push('mentor');
  }

  return { added, removed };
}

// ── Display Helpers ──

/**
 * Map opinion (-1..+1) to a hex color: red → neutral → green.
 */
export function getOpinionColor(opinion) {
  const t = (opinion + 1) / 2; // 0..1
  // Red (0xcc3333) → neutral (0x888866) → green (0x55aa44)
  const r = Math.round(0xcc + (0x55 - 0xcc) * t);
  const g = Math.round(0x33 + (0xaa - 0x33) * t);
  const b = Math.round(0x33 + (0x44 - 0x33) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * Return display label for the most prominent tag.
 */
export function getRelationshipLabel(record) {
  if (record.tags.has('kin')) return 'Kin';
  if (record.tags.has('mentor')) return 'Mentor';
  if (record.tags.has('pupil')) return 'Pupil';
  if (record.tags.has('friend')) return 'Friend';
  if (record.tags.has('rival')) return 'Rival';
  if (record.familiarity >= 0.2) return 'Acquaintance';
  return 'Stranger';
}

// ── Action Scoring Queries ──

/**
 * Check if any friend is within tile range of goblin.
 */
export function isNearFriend(goblin, allGoblins, range) {
  for (const [id, rec] of goblin.relationships) {
    if (!rec.tags.has('friend')) continue;
    const other = allGoblins.get(id);
    if (!other || !other.alive) continue;
    const dist = Math.abs(other.col - goblin.col) + Math.abs(other.row - goblin.row);
    if (dist <= range) return true;
  }
  return false;
}

/**
 * Check if any rival is pathing to the same target tile.
 */
export function isRivalTargeting(goblin, col, row, allGoblins) {
  for (const [id, rec] of goblin.relationships) {
    if (!rec.tags.has('rival')) continue;
    const other = allGoblins.get(id);
    if (!other || !other.alive || !other.path) continue;
    const dest = other.path[other.path.length - 1];
    if (dest && dest.col === col && dest.row === row) return other;
  }
  return null;
}
