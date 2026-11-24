import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EXERCISES } from '../js/data.js';
import { PHOTOS, GIFS } from '../js/media.js';
import { FIGURE_IDS, isAnimated, animatedFrame, animatedSVG } from '../js/figures.js';

test('every photo exists, belongs to a real exercise and carries a credit', () => {
  for (const [id, list] of Object.entries(PHOTOS)) {
    assert.ok(EXERCISES[id], id);
    for (const p of list) {
      assert.ok(fs.existsSync(new URL(`../${p.src}`, import.meta.url)), p.src);
      assert.ok(p.author && p.page && p.license?.url && p.alt, p.src);
    }
  }
});

test('every GIF points at an ExerciseDB media URL for a real exercise', () => {
  for (const [id, list] of Object.entries(GIFS)) {
    assert.ok(EXERCISES[id], id);
    for (const g of list) {
      assert.match(g.url, /^https:\/\/static\.exercisedb\.dev\/media\/\w+\.gif$/);
      assert.ok(g.label && g.alt);
    }
  }
});

test('animations produce valid frames through the whole loop', () => {
  const animated = FIGURE_IDS.filter(isAnimated);
  assert.ok(animated.length >= 24);
  for (const id of animated) {
    assert.match(animatedSVG(id), /^<svg class="fig fig-anim"/);
    for (let t = 0; t < 12; t += 0.21) assert.doesNotMatch(animatedFrame(id, t), /NaN|undefined/, `${id} at ${t}`);
  }
});
