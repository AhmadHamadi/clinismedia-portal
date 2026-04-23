class SearchConsoleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchConsoleValidationError';
  }
}

function normalizeWebsiteUrl(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(withProtocol);
  } catch (_) {
    throw new SearchConsoleValidationError('Website URL must be a valid URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new SearchConsoleValidationError('Website URL must start with http:// or https://.');
  }

  url.hash = '';
  url.search = '';

  if (!url.hostname) {
    throw new SearchConsoleValidationError('Website URL must include a valid domain.');
  }

  return url.toString();
}

function normalizeSearchConsoleProperty(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('sc-domain:')) {
    const domain = trimmed.slice('sc-domain:'.length).trim().toLowerCase();

    if (!domain) {
      throw new SearchConsoleValidationError('Search Console domain property must include a domain after sc-domain:.');
    }

    if (/^https?:\/\//i.test(domain) || domain.includes('/') || domain.includes(' ')) {
      throw new SearchConsoleValidationError('Search Console domain property must look like sc-domain:example.com.');
    }

    return `sc-domain:${domain}`;
  }

  const normalizedUrl = normalizeWebsiteUrl(trimmed);

  if (!normalizedUrl) {
    return null;
  }

  return normalizedUrl;
}

function deriveSearchConsolePropertyFromWebsite(websiteUrl) {
  const normalizedWebsite = normalizeWebsiteUrl(websiteUrl);
  return normalizedWebsite || null;
}

function buildSearchConsoleUpdate(input) {
  const updateData = {};
  const hasWebsiteUrl = Object.prototype.hasOwnProperty.call(input, 'websiteUrl');
  const hasPropertyUrl = Object.prototype.hasOwnProperty.call(input, 'searchConsolePropertyUrl');
  let normalizedWebsite;

  if (hasWebsiteUrl) {
    normalizedWebsite = normalizeWebsiteUrl(input.websiteUrl);
    updateData.websiteUrl = normalizedWebsite;
  }

  if (hasPropertyUrl) {
    updateData.searchConsolePropertyUrl = normalizeSearchConsoleProperty(input.searchConsolePropertyUrl);
  } else if (hasWebsiteUrl) {
    updateData.searchConsolePropertyUrl = normalizedWebsite ? deriveSearchConsolePropertyFromWebsite(normalizedWebsite) : null;
  }

  return updateData;
}

module.exports = {
  SearchConsoleValidationError,
  deriveSearchConsolePropertyFromWebsite,
  normalizeWebsiteUrl,
  normalizeSearchConsoleProperty,
  buildSearchConsoleUpdate,
};
