import assert from "node:assert/strict";
import {
  mergeEditorialStories,
  parsePublishedDate,
} from "./archive-entertainment-editorial.mjs";

const prior = {
  headline: "Prior entertainment story",
  summary: "Prior entertainment context",
  url: "https://example.com/prior-entertainment-story",
  source: "Example",
  published_at: "2026-08-15 12:00:00 PM ET",
};
const current = {
  headline: "Current entertainment story",
  snapshot: "Current entertainment context",
  url: "https://example.com/current-entertainment-story",
  source_name: "Example",
  published: "2026-08-16T12:00:00Z",
};

const merged = mergeEditorialStories(
  [prior],
  [{ homepage_cards: [current, prior, { headline: "Incomplete story" }] }],
);

assert.deepEqual(merged, [current, prior]);
assert.equal(parsePublishedDate(prior.published_at)?.toISOString(), "2026-08-15T16:00:00.000Z");
assert.equal(
  merged.filter((story) => story.headline === "Prior entertainment story").length,
  1,
);
console.log("Entertainment editorial archive tests passed.");
