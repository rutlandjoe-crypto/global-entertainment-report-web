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

const liveStory = {
  headline: "Oscar Predictions: Amanda Seyfried and Matt Damon Take the Top Spots",
  snapshot: "Current awards coverage",
  url: "https://variety.com/lists/2027-oscars-predictions/",
  source_name: "Variety",
  published: "Fri, 20 Nov 2026 00:30:00 +0000",
};

const merged = mergeEditorialStories(
  [prior],
  [{ homepage_cards: [current, prior, { headline: "Incomplete story" }], live_newsroom: [liveStory] }],
);

assert.deepEqual(merged, [liveStory, current, prior]);
assert.equal(parsePublishedDate(prior.published_at)?.toISOString(), "2026-08-15T16:00:00.000Z");
assert.equal(
  merged.filter((story) => story.headline === "Prior entertainment story").length,
  1,
);
assert.ok(merged.some((story) => story.headline === liveStory.headline));
console.log("Entertainment editorial archive tests passed.");
