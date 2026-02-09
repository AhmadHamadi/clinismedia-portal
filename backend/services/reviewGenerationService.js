const { buildDraft } = require('./sentenceBanks');

// Graceful OpenAI import (matches twilio.js pattern)
let OpenAI = null;
try {
  OpenAI = require('openai');
} catch (e) {
  console.log('[ReviewGeneration] OpenAI not available, using sentence banks only');
}

// Banned phrases that make reviews look fake/spammy
const BANNED_PHRASES = [
  'highly recommend',
  'best in the city',
  'best in town',
  'best dentist',
  'best clinic',
  'top-rated',
  'top rated',
  'near me',
  'look no further',
  'top-notch',
  'second to none',
  'world-class',
  'state-of-the-art',
  'cutting-edge',
  'game changer',
  'life-changing',
  'miracle',
  'transformed my life',
  'discount',
  'promo',
  'free consultation',
  '#',
  'SEO',
  'google',
  'review',
  'five stars',
  '5 stars',
  '⭐',
  '😊',
  '👍',
  '💯',
  '🙏',
  '❤️',
];

// Emoji regex pattern
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/u;

// Length presets
const LENGTH_RULES = {
  short: { minWords: 20, maxWords: 50, minSentences: 1, maxSentences: 2, maxTokens: 100 },
  medium: { minWords: 50, maxWords: 110, minSentences: 3, maxSentences: 5, maxTokens: 200 },
};

/**
 * Validate a review text against quality rules
 */
function validateReview(text, clinicName, reviewLength = 'medium') {
  const reasons = [];
  const rules = LENGTH_RULES[reviewLength] || LENGTH_RULES.medium;

  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length < rules.minWords) reasons.push(`Too short: ${words.length} words (min ${rules.minWords})`);
  if (words.length > rules.maxWords + 20) reasons.push(`Too long: ${words.length} words (max ${rules.maxWords})`);

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < rules.minSentences) reasons.push(`Too few sentences: ${sentences.length}`);
  if (sentences.length > rules.maxSentences + 1) reasons.push(`Too many sentences: ${sentences.length}`);

  // Clinic name appears exactly once
  const clinicNameLower = clinicName.toLowerCase();
  const textLower = text.toLowerCase();
  const nameOccurrences = textLower.split(clinicNameLower).length - 1;
  if (nameOccurrences === 0) reasons.push('Clinic name not found in review');
  if (nameOccurrences > 1) reasons.push(`Clinic name appears ${nameOccurrences} times (should be 1)`);

  // No banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (textLower.includes(phrase.toLowerCase())) {
      reasons.push(`Contains banned phrase: "${phrase}"`);
    }
  }

  // No emojis
  if (EMOJI_REGEX.test(text)) {
    reasons.push('Contains emoji');
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Polish a draft review using OpenAI
 */
async function polishWithAI(draft, clinicName, { reviewLength = 'medium', staffName, freeText } = {}) {
  if (!OpenAI || !process.env.OPENAI_API_KEY) {
    return null;
  }

  const rules = LENGTH_RULES[reviewLength] || LENGTH_RULES.medium;
  const lengthInstruction = reviewLength === 'short'
    ? `Output 1-2 sentences, 20-50 words total.`
    : `Output 3-5 sentences, 50-110 words total.`;

  const staffInstruction = staffName
    ? `\n- You may mention "${staffName}" once naturally as a staff member who stood out.`
    : '';

  const freeTextInstruction = freeText
    ? `\n- Incorporate the patient's personal note naturally: "${freeText}"`
    : '';

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that lightly rewrites patient reviews to sound more natural and human. Use a warm, friendly, and genuine tone.

Rules:
- Keep the same meaning and key details
- ${lengthInstruction}
- Use the clinic name "${clinicName}" exactly ONCE
- NO emojis, NO hashtags, NO star ratings in text
- NO SEO phrases like "highly recommend", "best in town", "look no further", "top-notch", "top-rated", "near me", "best dentist"
- NO medical claims or guarantees
- NO promotions, discounts, or marketing language
- Must sound like a real patient wrote it
- Do NOT add information that wasn't in the original${staffInstruction}${freeTextInstruction}
- Return ONLY the rewritten review text, nothing else`
        },
        {
          role: 'user',
          content: `Please lightly rewrite this patient review to sound more natural:\n\n${draft}`
        }
      ],
      temperature: 0.7,
      max_tokens: rules.maxTokens
    });

    const polished = response.choices[0]?.message?.content?.trim();
    if (!polished) return null;

    return polished;
  } catch (error) {
    console.error('[ReviewGeneration] OpenAI polish failed:', error.message);
    return null;
  }
}

/**
 * Generate a review for a patient session
 * @param {Object} options
 * @param {string} options.clinicName
 * @param {Array<{ label: string, category: string, sentences: string[] }>} options.selectedChips
 * @param {string} [options.freeText]
 * @param {string} [options.staffName]
 * @param {string} [options.reviewLength] - 'short' or 'medium'
 */
async function generateReview({ clinicName, selectedChips = [], freeText, staffName, reviewLength = 'medium' }) {
  // Step 1: Build sentence bank draft
  const draft = buildDraft(clinicName, selectedChips, { freeText, staffName, reviewLength });

  // Step 2: Try AI polish
  let reviewText = draft;
  let aiPolished = false;

  const polished = await polishWithAI(draft, clinicName, { reviewLength, staffName, freeText });
  if (polished) {
    // Step 3: Validate polished version
    const validation = validateReview(polished, clinicName, reviewLength);
    if (validation.valid) {
      reviewText = polished;
      aiPolished = true;
    } else {
      console.log('[ReviewGeneration] AI polish failed validation:', validation.reasons);
      const draftValidation = validateReview(draft, clinicName, reviewLength);
      if (!draftValidation.valid) {
        console.log('[ReviewGeneration] Draft also failed validation, using anyway:', draftValidation.reasons);
      }
    }
  }

  // Calculate stats
  const words = reviewText.split(/\s+/).filter(w => w.length > 0);
  const sentences = reviewText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  return {
    reviewText,
    sentenceBankDraft: draft,
    aiPolished,
    wordCount: words.length,
    sentenceCount: sentences.length
  };
}

module.exports = { generateReview, validateReview };
