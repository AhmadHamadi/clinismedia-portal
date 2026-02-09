/**
 * Sentence banks for review generation.
 * Uses chip sentence data stored on the campaign.
 * {{CLINIC}} is replaced with the clinic name.
 */

// Opening sentences - always include {{CLINIC}} exactly once
const openings = [
  "I had a wonderful experience at {{CLINIC}} recently.",
  "I just visited {{CLINIC}} and I'm really happy with how everything went.",
  "I'm so glad I chose {{CLINIC}} for my appointment.",
  "My visit to {{CLINIC}} was such a positive experience.",
  "I recently had an appointment at {{CLINIC}} and it exceeded my expectations.",
  "{{CLINIC}} really impressed me during my recent visit.",
  "I had my first visit at {{CLINIC}} and it was fantastic.",
  "Really pleased with my visit to {{CLINIC}} recently.",
  "Had my appointment at {{CLINIC}} and it went really well.",
  "I want to share my great experience at {{CLINIC}}.",
];

// Generic closing sentences
const closings = [
  "I'll definitely be coming back for future visits.",
  "Looking forward to my next appointment already.",
  "I'm so happy I found them and will continue to go back.",
  "Truly a great experience from beginning to end.",
  "They've earned a loyal patient in me.",
  "Couldn't be happier with the experience overall.",
];

/**
 * Get a random item from an array
 */
function getRandomItem(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a review draft from selected chips and their sentence banks.
 *
 * @param {string} clinicName - The clinic name to insert
 * @param {Array<{ label: string, category: string, sentences: string[] }>} selectedChips
 * @param {Object} extras - Optional extra inputs
 * @param {string} [extras.freeText] - Patient's additional comment (max 120 chars)
 * @param {string} [extras.staffName] - Staff member to mention
 * @param {string} [extras.reviewLength] - 'short' (1-2 sentences) or 'medium' (3-5 sentences)
 * @returns {string} The generated draft review
 */
function buildDraft(clinicName, selectedChips = [], extras = {}) {
  const { freeText, staffName, reviewLength = 'medium' } = extras;
  const isShort = reviewLength === 'short';
  const sentences = [];

  // 1. Always start with an opening (includes clinic name)
  sentences.push(getRandomItem(openings));

  // 2. Pick 1 random sentence from each selected chip
  // Short: limit to 1 chip sentence; Medium: up to 4
  const maxChipSentences = isShort ? 1 : 4;
  const chips = selectedChips.slice(0, maxChipSentences);

  for (const chip of chips) {
    if (chip.sentences && chip.sentences.length > 0) {
      sentences.push(getRandomItem(chip.sentences));
    }
  }

  // 3. If fewer than 2 chips and medium length, add filler
  if (!isShort && chips.length < 2) {
    sentences.push("The team was wonderful and made the whole visit smooth and comfortable.");
  }

  // 4. Staff name mention
  if (staffName && staffName.trim()) {
    sentences.push(`${staffName.trim()} was especially great and made a real difference.`);
  }

  // 5. Free text gets appended as a sentence if provided
  if (freeText && freeText.trim()) {
    sentences.push(freeText.trim().endsWith('.') ? freeText.trim() : freeText.trim() + '.');
  }

  // 6. Add closing (skip for short to keep it tight)
  if (!isShort) {
    sentences.push(getRandomItem(closings));
  }

  // Replace clinic name placeholder
  let review = sentences.join(' ');
  review = review.replace(/\{\{CLINIC\}\}/g, clinicName);

  return review;
}

module.exports = { openings, closings, buildDraft, getRandomItem };
