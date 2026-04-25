import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FaBolt,
  FaBuilding,
  FaCalendarAlt,
  FaChartLine,
  FaDownload,
  FaEnvelopeOpenText,
  FaFacebookF,
  FaFilePdf,
  FaGoogle,
  FaInstagram,
  FaPhone,
  FaPrint,
  FaRobot,
  FaSpinner,
  FaStar,
  FaSyncAlt,
} from 'react-icons/fa';
import logo1 from '../../../assets/CliniMedia_Logo1.png';

interface Customer {
  _id: string;
  name: string;
  email: string;
  location?: string;
}

interface ReportSection {
  id: string;
  title: string;
  summary?: Record<string, any>;
  highlights?: string[];
  campaigns?: Array<Record<string, any>>;
  recentLeads?: Array<Record<string, any>>;
  topPosts?: Array<Record<string, any>>;
  topReasons?: Array<Record<string, any>>;
  recentReviews?: Array<Record<string, any>>;
  topQueries?: Array<Record<string, any>>;
  topPages?: Array<Record<string, any>>;
  pageInfo?: Record<string, any>;
  sourceWindow?: Record<string, any>;
  property?: string;
  error?: string;
}

interface ReportPayload {
  generatedAt: string;
  reportTitle: string;
  exportFileName: string;
  period: {
    start: string;
    end: string;
    label: string;
  };
  clinic: {
    id: string;
    name: string;
    email: string;
    location?: string;
    website?: string | null;
    logoUrl?: string | null;
  };
  overview: {
    totalLeads: number;
    bookedMetaAppointments: number;
    totalCalls: number;
    newPatientCalls: number;
    callAppointmentsBooked: number;
    aiCalls: number;
  };
  sections: ReportSection[];
  recommendations: string[];
  availableIntegrations: Record<string, boolean>;
}

interface EmailDraftPayload {
  generatedAt: string;
  subject: string;
  body: string;
  source: string;
  error?: string | null;
}

const PRESETS = [
  { value: 'last7Days', label: 'Last 7 Days' },
  { value: 'last14Days', label: 'Biweekly Report' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last30Days', label: 'Last 30 Days' },
  { value: 'last90Days', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const overviewCards = [
  { key: 'totalLeads', label: 'Total Leads', accent: 'text-sky-600', integration: 'metaLeads' },
  { key: 'bookedMetaAppointments', label: 'Booked Leads', accent: 'text-pink-600', integration: 'metaLeads' },
  { key: 'totalCalls', label: 'Tracked Calls', accent: 'text-emerald-600', integration: 'callTracking' },
  { key: 'newPatientCalls', label: 'New Patient Calls', accent: 'text-indigo-600', integration: 'callTracking' },
  { key: 'callAppointmentsBooked', label: 'Call Bookings', accent: 'text-amber-600', integration: 'callTracking' },
  { key: 'aiCalls', label: 'AI Calls', accent: 'text-violet-600', integration: 'aiReception' },
];

function visibleOverviewCards(report: ReportPayload) {
  return overviewCards.filter((card) => report.availableIntegrations[card.integration] !== false);
}

const sectionIcons: Record<string, React.ReactNode> = {
  metaLeads: <FaBolt className="text-pink-600" />,
  callTracking: <FaPhone className="text-emerald-600" />,
  aiReception: <FaRobot className="text-violet-600" />,
  googleBusiness: <FaGoogle className="text-blue-600" />,
  googleAds: <FaGoogle className="text-amber-500" />,
  instagram: <FaInstagram className="text-fuchsia-600" />,
  facebook: <FaFacebookF className="text-sky-600" />,
  qrReviews: <FaStar className="text-yellow-500" />,
  searchConsole: <FaChartLine className="text-blue-600" />,
};

function getSectionTheme(sectionId: string) {
  const themes: Record<string, { shell: string; iconWrap: string; label: string; chip: string; }> = {
    metaLeads: {
      shell: 'border-pink-200 bg-gradient-to-br from-pink-50 via-white to-rose-50',
      iconWrap: 'bg-pink-100 text-pink-700',
      label: 'text-pink-700',
      chip: 'bg-pink-100 text-pink-800',
    },
    callTracking: {
      shell: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50',
      iconWrap: 'bg-emerald-100 text-emerald-700',
      label: 'text-emerald-700',
      chip: 'bg-emerald-100 text-emerald-800',
    },
    aiReception: {
      shell: 'border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50',
      iconWrap: 'bg-violet-100 text-violet-700',
      label: 'text-violet-700',
      chip: 'bg-violet-100 text-violet-800',
    },
    googleBusiness: {
      shell: 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50',
      iconWrap: 'bg-blue-100 text-blue-700',
      label: 'text-blue-700',
      chip: 'bg-blue-100 text-blue-800',
    },
    googleAds: {
      shell: 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50',
      iconWrap: 'bg-amber-100 text-amber-700',
      label: 'text-amber-700',
      chip: 'bg-amber-100 text-amber-800',
    },
    instagram: {
      shell: 'border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-pink-50',
      iconWrap: 'bg-fuchsia-100 text-fuchsia-700',
      label: 'text-fuchsia-700',
      chip: 'bg-fuchsia-100 text-fuchsia-800',
    },
    facebook: {
      shell: 'border-sky-200 bg-gradient-to-br from-sky-50 via-white to-blue-50',
      iconWrap: 'bg-sky-100 text-sky-700',
      label: 'text-sky-700',
      chip: 'bg-sky-100 text-sky-800',
    },
    qrReviews: {
      shell: 'border-yellow-200 bg-gradient-to-br from-yellow-50 via-white to-orange-50',
      iconWrap: 'bg-yellow-100 text-yellow-700',
      label: 'text-yellow-700',
      chip: 'bg-yellow-100 text-yellow-800',
    },
    searchConsole: {
      shell: 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-sky-50',
      iconWrap: 'bg-blue-100 text-blue-700',
      label: 'text-blue-700',
      chip: 'bg-blue-100 text-blue-800',
    },
  };

  return themes[sectionId] || {
    shell: 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100',
    iconWrap: 'bg-slate-100 text-slate-700',
    label: 'text-slate-700',
    chip: 'bg-slate-100 text-slate-800',
  };
}

function getTopHighlights(report: ReportPayload) {
  return report.sections
    .flatMap((section) => (section.highlights || []).map((highlight) => `${section.title}: ${highlight}`))
    .slice(0, 8);
}

function getCompactRows(rows?: Array<Record<string, any>>, limit = 4) {
  return (rows || []).slice(0, limit);
}

function hasRenderableSectionContent(section: ReportSection) {
  const summaryEntries = Object.entries(section.summary || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');

  return Boolean(
    section.error ||
    summaryEntries.length ||
    section.highlights?.length ||
    section.campaigns?.length ||
    section.recentLeads?.length ||
    section.topPosts?.length ||
    section.topReasons?.length ||
    section.recentReviews?.length ||
    section.topQueries?.length ||
    section.topPages?.length
  );
}

function humanizeKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (value) => value.toUpperCase());
}

function formatMetricValue(value: any, key?: string) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'number') {
    const k = (key || '').toLowerCase();
    // CTR / click-through rate fields stored as 0-1 fraction → render as percent
    if (k === 'ctr' || k === 'avgctr' || k.endsWith('ctr')) {
      return `${(value * 100).toFixed(2)}%`;
    }
    // Position / averagePosition fields → 2-decimal float (matches customer dashboard)
    if (k === 'position' || k === 'avgposition' || k.endsWith('position')) {
      return value.toFixed(2);
    }
    // Average rating fields → 1-decimal float (e.g. "4.7")
    if (k.includes('rating')) {
      return value.toFixed(1);
    }
    // Generic Percent suffix → render with %
    if (k.endsWith('percent')) {
      return `${value.toFixed(1)}%`;
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderSummaryGrid(summary?: Record<string, any>) {
  if (!summary) return null;
  const entries = Object.entries(summary).filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!entries.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {humanizeKey(key)}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {formatMetricValue(value, key)}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildTableHtml(rows: Array<Record<string, any>>) {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(humanizeKey(header))}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>${headers.map((header) => `<td>${escapeHtml(formatMetricValue(row[header], header))}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getPrintSectionIcon(sectionId: string) {
  const iconMap: Record<string, string> = {
    metaLeads: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="meta-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0866FF"/>
            <stop offset="100%" stop-color="#0064E1"/>
          </linearGradient>
        </defs>
        <path fill="url(#meta-grad)" d="M13.2 2.2 4 14h6.4l-1.6 7.8L20 10.2h-6.4z"/>
      </svg>
    `,
    callTracking: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#047857" d="M6.62 10.79a15.46 15.46 0 006.59 6.59l2.2-2.2a1 1 0 011-.24c1.12.37 2.33.56 3.59.56a1 1 0 011 1V20a1 1 0 01-1 1C10.3 21 3 13.7 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.26.19 2.47.56 3.59a1 1 0 01-.25 1.01z"/>
      </svg>
    `,
    aiReception: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#6d28d9" d="M12 2a5 5 0 00-5 5v2H6a2 2 0 00-2 2v5a4 4 0 004 4h8a4 4 0 004-4v-5a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 7V7a3 3 0 116 0v2z"/>
        <circle cx="9" cy="13" r="1.1" fill="#ede9fe"/>
        <circle cx="15" cy="13" r="1.1" fill="#ede9fe"/>
      </svg>
    `,
    googleBusiness: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.5 12.27c0-.85-.07-1.46-.23-2.1H12v3.93h6.05c-.12 1-.78 2.5-2.24 3.51l-.02.13 3.25 2.52.23.02c2.07-1.91 3.23-4.71 3.23-7.93z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.97 7.27-2.66l-3.46-2.68c-.93.65-2.16 1.1-3.81 1.1-2.91 0-5.37-1.92-6.25-4.57l-.13.01-3.39 2.62-.04.12C3.95 20.34 7.7 23 12 23z"/>
        <path fill="#FBBC04" d="M5.75 14.19A6.45 6.45 0 015.4 12c0-.76.13-1.5.34-2.19l-.01-.14L2.3 7l-.11.05A11 11 0 001 12c0 1.78.42 3.46 1.19 4.95z"/>
        <path fill="#EA4335" d="M12 5.24c2.07 0 3.46.89 4.26 1.64l3.11-3.04C17.46 2.03 14.97 1 12 1 7.7 1 3.95 3.66 2.19 7.05l3.55 2.76C6.62 7.16 9.09 5.24 12 5.24z"/>
      </svg>
    `,
    googleAds: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#FBBC04" d="M9.12 3.02 2.74 14.07a3.97 3.97 0 1 0 6.88 3.98L16 7a3.97 3.97 0 1 0-6.88-3.98z"/>
        <path fill="#4285F4" d="M20.86 17.95 14.47 6.9a3.97 3.97 0 1 0-6.88 3.98l6.38 11.05a3.97 3.97 0 1 0 6.89-3.98z"/>
        <circle cx="7.1" cy="18.03" r="3.97" fill="#34A853"/>
      </svg>
    `,
    instagram: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#FED576"/>
            <stop offset="22%" stop-color="#F47133"/>
            <stop offset="50%" stop-color="#DD2A7B"/>
            <stop offset="78%" stop-color="#8134AF"/>
            <stop offset="100%" stop-color="#515BD4"/>
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-grad)"/>
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
        <circle cx="12" cy="12" r="4.3" fill="none" stroke="#fff" stroke-width="1.9"/>
        <circle cx="17.55" cy="6.5" r="1.25" fill="#fff"/>
      </svg>
    `,
    facebook: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#1877F2"/>
        <path fill="#fff" d="M13.75 22v-7.92h2.66l.4-3.08h-3.06V9.05c0-.89.25-1.5 1.53-1.5h1.63V4.8c-.28-.04-1.25-.12-2.38-.12-2.36 0-3.97 1.44-3.97 4.08v2.24H7.88v3.08h2.68V22z"/>
      </svg>
    `,
    qrReviews: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#a16207" d="M12 2l2.7 5.46L20.7 8l-4.35 4.24L17.4 18 12 15.27 6.6 18l1.05-5.76L3.3 8l6-.54z"/>
      </svg>
    `,
    searchConsole: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="#1d4ed8" stroke-width="2.2"/>
        <line x1="15" y1="15" x2="20.5" y2="20.5" stroke="#1d4ed8" stroke-width="2.4" stroke-linecap="round"/>
        <path fill="#34A853" d="M7.4 10.5h6.2" stroke="#34A853" stroke-width="1.4" stroke-linecap="round"/>
        <path fill="#FBBC04" d="M9 8.4 12 13.6" stroke="#FBBC04" stroke-width="1.4" stroke-linecap="round" opacity="0"/>
      </svg>
    `,
  };

  return iconMap[sectionId] || `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#334155"/>
    </svg>
  `;
}

const SECTION_ORDER: Record<string, number> = {
  metaLeads: 1,
  callTracking: 2,
  aiReception: 3,
  facebook: 4,
  instagram: 5,
  googleBusiness: 6,
  qrReviews: 7,
  googleAds: 8,
  searchConsole: 9,
};

function formatDateLongRange(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} — ${endIso}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
  const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startFmt} — ${endFmt}`;
}

// Featured metric per section + a short narrative caption.
const SECTION_FEATURE: Record<string, { key: string; label: string; caption: string }> = {
  metaLeads: { key: 'totalLeads', label: 'Total Leads', caption: 'New leads captured from Meta lead-gen campaigns this period.' },
  callTracking: { key: 'totalCalls', label: 'Total Calls', caption: 'Tracked phone calls placed to the clinic line during the report window.' },
  aiReception: { key: 'totalCalls', label: 'AI Calls Handled', caption: 'Calls answered by the AI receptionist after-hours and overflow.' },
  facebook: { key: 'totalReach', label: 'Total Reach', caption: 'Unique people who saw your Facebook content this period.' },
  instagram: { key: 'totalReach', label: 'Total Reach', caption: 'Unique Instagram accounts reached by your posts and reels.' },
  googleBusiness: { key: 'totalViews', label: 'Profile Impressions', caption: 'How many times your Google Business Profile appeared in Search and Maps.' },
  googleAds: { key: 'impressions', label: 'Ad Impressions', caption: 'Times your Google Ads were shown to potential patients.' },
  qrReviews: { key: 'scans', label: 'QR Scans', caption: 'Patients who scanned the QR review prompt in-clinic.' },
  searchConsole: { key: 'totalClicks', label: 'Organic Clicks', caption: 'Clicks from Google search results to your website.' },
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  metaLeads: 'Captured leads, contact follow-up, and bookings from Meta lead-form campaigns.',
  callTracking: 'Inbound phone activity tracked through the dedicated marketing line.',
  aiReception: 'After-hours and overflow calls handled by the AI receptionist.',
  facebook: 'Page reach, post engagement, and audience growth on Facebook.',
  instagram: 'Reach, engagement, and follower trends across your Instagram content.',
  googleBusiness: 'Search and Maps impressions, profile actions, and reviews.',
  googleAds: 'Spend, clicks, conversions, and campaign-level performance.',
  qrReviews: 'In-clinic QR review program funnel and conversion metrics.',
  searchConsole: 'Organic search performance, top queries, and landing page visibility.',
};

function buildPrintHtml(report: ReportPayload, _emailDraft: EmailDraftPayload | null, logoSrc: string) {
  const visibleSections = report.sections
    .filter(hasRenderableSectionContent)
    .sort((a, b) => (SECTION_ORDER[a.id] || 99) - (SECTION_ORDER[b.id] || 99));

  const coverDateRange = formatDateLongRange(report.period.start, report.period.end);

  const visibleOverview = visibleOverviewCards(report);
  const overviewHtml = visibleOverview.map((card) => `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-value">${escapeHtml(formatMetricValue(report.overview[card.key as keyof typeof report.overview], card.key))}</div>
    </div>
  `).join('');

  // ---- Table of Contents ----
  const tocHtml = visibleSections.map((section, idx) => {
    const accentMap: Record<string, string> = {
      metaLeads: '#2e6bff', callTracking: '#10b981', aiReception: '#8b5cf6',
      googleBusiness: '#2563eb', googleAds: '#f59e0b', instagram: '#d946ef',
      facebook: '#0ea5e9', qrReviews: '#eab308', searchConsole: '#0284c7',
    };
    const accent = accentMap[section.id] || '#64748b';
    const desc = SECTION_DESCRIPTIONS[section.id] || '';
    return `
      <div class="toc-row">
        <div class="toc-num" style="color: ${accent}; border-color: ${accent};">${String(idx + 2).padStart(2, '0')}</div>
        <div class="toc-text">
          <div class="toc-title">${escapeHtml(section.title)}</div>
          <div class="toc-desc">${escapeHtml(desc)}</div>
        </div>
        <div class="toc-bar" style="background: ${accent};"></div>
      </div>
    `;
  }).join('');

  // ---- Sections ----
  const accentMap: Record<string, { primary: string; soft: string; deep: string; kicker: string }> = {
    metaLeads: { primary: '#2e6bff', soft: '#e6efff', deep: '#1d4ed8', kicker: 'Lead Generation' },
    callTracking: { primary: '#10b981', soft: '#d1fae5', deep: '#065f46', kicker: 'Phone Performance' },
    aiReception: { primary: '#8b5cf6', soft: '#ede9fe', deep: '#5b21b6', kicker: 'AI Receptionist' },
    googleBusiness: { primary: '#2563eb', soft: '#dbeafe', deep: '#1e40af', kicker: 'Google Business & Reviews' },
    googleAds: { primary: '#f59e0b', soft: '#fef3c7', deep: '#92400e', kicker: 'Paid Search' },
    instagram: { primary: '#d946ef', soft: '#fae8ff', deep: '#86198f', kicker: 'Instagram Insights' },
    facebook: { primary: '#0ea5e9', soft: '#e0f2fe', deep: '#075985', kicker: 'Facebook Insights' },
    qrReviews: { primary: '#eab308', soft: '#fef9c3', deep: '#854d0e', kicker: 'QR Review Program' },
    searchConsole: { primary: '#0284c7', soft: '#e0f2fe', deep: '#075985', kicker: 'Website & SEO' },
  };

  const sectionsHtml = visibleSections.map((section, idx) => {
    const accent = accentMap[section.id] || { primary: '#64748b', soft: '#f1f5f9', deep: '#334155', kicker: 'Channel Performance' };
    const summaryEntries = Object.entries(section.summary || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');

    // Featured metric: extract from summary using SECTION_FEATURE map.
    const featureCfg = SECTION_FEATURE[section.id];
    const featureValue = featureCfg ? section.summary?.[featureCfg.key] : undefined;
    const featureKey = featureCfg?.key;
    const featureValueDisplay = featureValue !== undefined && featureValue !== null
      ? formatMetricValue(featureValue, featureKey)
      : null;
    const supportingEntries = summaryEntries.filter(([key]) => key !== featureKey).slice(0, 6);

    const heroHtml = `
      <div class="section-hero" style="background: linear-gradient(120deg, ${accent.primary} 0%, ${accent.deep} 100%);">
        <div class="section-hero-inner">
          <div class="section-hero-left">
            <div class="section-hero-num">${String(idx + 2).padStart(2, '0')}</div>
            <div class="section-hero-meta">
              <div class="section-hero-kicker">${escapeHtml(accent.kicker)}</div>
              <h2 class="section-hero-title">${escapeHtml(section.title)}</h2>
            </div>
          </div>
          <div class="section-hero-icon">${getPrintSectionIcon(section.id)}</div>
        </div>
        <div class="section-hero-desc">${escapeHtml(SECTION_DESCRIPTIONS[section.id] || '')}</div>
      </div>
    `;

    const featuredHtml = featureValueDisplay
      ? `
        <div class="featured-metric" style="border-color: ${accent.primary}; --accent: ${accent.primary};">
          <div class="featured-label">${escapeHtml(featureCfg!.label)}</div>
          <div class="featured-value" style="color: ${accent.deep};">${escapeHtml(featureValueDisplay)}</div>
          <div class="featured-caption">${escapeHtml(featureCfg!.caption)}</div>
        </div>
      `
      : '';

    const summaryHtml = supportingEntries.length
      ? `<div class="summary-grid">${supportingEntries.map(([key, value]) => `
          <div class="summary-item" style="--accent: ${accent.primary};">
            <div class="summary-label">${escapeHtml(humanizeKey(key))}</div>
            <div class="summary-value">${escapeHtml(formatMetricValue(value, key))}</div>
          </div>
        `).join('')}</div>`
      : '';

    const highlightsHtml = section.highlights?.length
      ? `<div class="pullquote" style="background: ${accent.soft}; border-color: ${accent.primary};">
          <div class="pullquote-label" style="color: ${accent.deep};">Key Highlights</div>
          <ul class="pullquote-list">${section.highlights.slice(0, 4).map((item) => `<li><span class="pullquote-bullet" style="background: ${accent.primary};"></span>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>`
      : '';

    const campaignsHtml = section.campaigns?.length
      ? `<div class="detail-block"><div class="detail-title" style="color: ${accent.deep};">Campaign Snapshot</div>${buildTableHtml(section.campaigns.slice(0, 5))}</div>`
      : '';

    const recentLeadsHtml = section.recentLeads?.length
      ? `<div class="detail-block"><div class="detail-title" style="color: ${accent.deep};">All Leads (${section.recentLeads.length})</div>${buildTableHtml(section.recentLeads)}</div>`
      : '';

    const topPostsHtml = section.topPosts?.length
      ? `<div class="detail-block"><div class="detail-title" style="color: ${accent.deep};">Top Posts</div><div class="card-list">${section.topPosts.slice(0, 3).map((post) => {
          const rawCaption = String(post.caption || 'Instagram post').replace(/\s+/g, ' ').trim();
          const trimmed = rawCaption.length > 180 ? `${rawCaption.slice(0, 180)}…` : rawCaption;
          return `
          <div class="mini-card" style="border-left-color: ${accent.primary};">
            <strong>${escapeHtml(trimmed)}</strong>
            <div class="mini-meta">${escapeHtml(`Reach ${formatMetricValue(post.reach)} · Engagement ${formatMetricValue(post.engagement)} · Plays ${formatMetricValue(post.plays)}`)}</div>
          </div>
        `;}).join('')}</div></div>`
      : '';

    const topReasonsHtml = section.topReasons?.length
      ? `<div class="detail-block"><div class="detail-title" style="color: ${accent.deep};">Top Reasons for Calling</div><div class="card-list">${section.topReasons.slice(0, 4).map((item) => `
          <div class="mini-card" style="border-left-color: ${accent.primary};">
            <strong>${escapeHtml(item.reason || 'Reason')}</strong>
            <div class="mini-meta">${escapeHtml(`${formatMetricValue(item.count)} calls`)}</div>
          </div>
        `).join('')}</div></div>`
      : '';

    const recentReviewsHtml = section.recentReviews?.length
      ? `<div class="detail-block"><div class="detail-title" style="color: ${accent.deep};">Recent Reviews</div><div class="card-list">${section.recentReviews.slice(0, 3).map((review) => `
          <div class="mini-card" style="border-left-color: ${accent.primary};">
            <strong>${escapeHtml(review.reviewerName || 'Reviewer')}</strong>
            <div class="mini-meta">${escapeHtml(`Rating ${formatMetricValue(review.starRating)} · ${review.createTime ? new Date(review.createTime).toLocaleDateString() : ''}`)}</div>
            ${review.comment ? `<p>${escapeHtml(review.comment)}</p>` : ''}
          </div>
        `).join('')}</div></div>`
      : '';

    const topQueriesHtml = section.topQueries?.length
      ? `<div class="detail-block"><div class="detail-title" style="color: ${accent.deep};">Top Search Queries</div>${buildTableHtml(section.topQueries.slice(0, 5))}</div>`
      : '';

    const topPagesHtml = section.topPages?.length
      ? `<div class="detail-block"><div class="detail-title" style="color: ${accent.deep};">Top Landing Pages</div>${buildTableHtml(section.topPages.slice(0, 5))}</div>`
      : '';

    const errorHtml = section.error
      ? `<div class="section-error">${escapeHtml(section.error)}</div>`
      : '';

    return `
      <div class="report-page" data-pagenum="${idx + 3}">
        ${heroHtml}
        <div class="section-body">
          ${errorHtml}
          <div class="section-grid">
            ${featuredHtml}
            ${summaryHtml ? `<div class="section-grid-stats">${summaryHtml}</div>` : ''}
          </div>
          ${highlightsHtml}
          ${campaignsHtml}
          ${recentLeadsHtml}
          ${topPostsHtml}
          ${topReasonsHtml}
          ${recentReviewsHtml}
          ${topQueriesHtml}
          ${topPagesHtml}
        </div>
        <div class="page-footer">
          <span>${escapeHtml(report.clinic.name)} · ${escapeHtml(coverDateRange)}</span>
          <span>${String(idx + 3).padStart(2, '0')}</span>
        </div>
      </div>
    `;
  }).join('');

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(report.exportFileName.replace(/\.pdf$/i, ''))}</title>
        <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: Letter; margin: 0; }
          html, body { margin: 0; padding: 0; color: #0f172a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f4f3fb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* --------- COVER PAGE (CliniMedia brand: navy + soft teal) ---------
             Brand palette pulled directly from the logo:
               --brand-navy: #36474F  (dark cross icon, "Media", "Marketing That")
               --brand-teal: #8FB6C2  (orbital rings, "Clini", "Elevates")
               --brand-cream: #F7F9FA (soft off-white background) */
          .cover {
            position: relative;
            width: 100%;
            height: 11in;
            min-height: 11in;
            padding: 0;
            background: #ffffff;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
          /* Subtle teal accent corner (top-right, small, calm) */
          .cover-corner-tr {
            position: absolute;
            top: 0;
            right: 0;
            width: 320px;
            height: 320px;
            z-index: 1;
            pointer-events: none;
          }
          /* Tiny navy accent corner (bottom-left) */
          .cover-corner-bl {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 220px;
            height: 220px;
            z-index: 1;
            pointer-events: none;
            opacity: 0.5;
          }
          .cover-dots {
            position: absolute;
            top: 18%;
            right: 8%;
            width: 90px;
            height: 70px;
            z-index: 2;
            pointer-events: none;
            opacity: 0.55;
          }
          /* Slim bottom band — minimal navy strip, NOT a full color block */
          .cover-band {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 130px;
            background: #36474F;
            z-index: 3;
            display: flex;
            align-items: center;
            padding: 0 64px;
            color: #ffffff;
            overflow: hidden;
          }
          .cover-band::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: #8FB6C2;
          }
          .cover-band-inner {
            position: relative;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            gap: 32px;
          }
          .cover-band-left {
            flex: 1;
            min-width: 0;
          }
          .cover-band-tagline {
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: #8FB6C2;
          }
          .cover-band-clinic {
            margin-top: 4px;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.01em;
            line-height: 1.15;
          }
          .cover-band-meta {
            font-size: 11px;
            font-weight: 500;
            color: rgba(255,255,255,0.65);
            letter-spacing: 0.06em;
            text-align: right;
          }
          .cover-band-meta strong {
            display: block;
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.04em;
            margin-bottom: 4px;
          }

          .cover-inner {
            position: relative;
            z-index: 4;
            padding: 64px 64px 0;
            height: calc(11in - 130px);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .cover-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
          }
          .cover-brand {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .cover-brand-row {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .cover-brand img {
            width: 68px;
            height: 68px;
            object-fit: contain;
            display: block;
          }
          .cover-brand-text { display: flex; flex-direction: column; }
          .cover-brand-name {
            font-size: 26px;
            font-weight: 700;
            color: #36474F;
            letter-spacing: -0.005em;
            line-height: 1;
          }
          .cover-brand-name-accent {
            color: #8FB6C2;
          }
          .cover-brand-sub {
            font-size: 10px;
            font-weight: 600;
            color: #36474F;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            margin-top: 4px;
            opacity: 0.7;
          }
          .cover-period {
            display: inline-block;
            font-size: 11px;
            color: #36474F;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            background: #ffffff;
            border: 1.5px solid #8FB6C2;
            padding: 9px 16px;
            border-radius: 999px;
            margin-top: 6px;
          }
          .cover-mid {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 40px;
            margin-bottom: 40px;
          }
          .cover-headline { flex: 1; min-width: 0; }
          .cover-tagline {
            font-size: 10.5px;
            font-weight: 700;
            color: #8FB6C2;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            margin-bottom: 18px;
          }
          .cover-title {
            font-size: 102px;
            line-height: 0.9;
            font-weight: 800;
            color: #36474F;
            letter-spacing: -0.03em;
            margin: 0;
          }
          .cover-title-accent {
            color: #8FB6C2;
          }
          .cover-divider {
            margin-top: 28px;
            width: 80px;
            height: 4px;
            background: #8FB6C2;
            border-radius: 2px;
          }
          .cover-subtitle {
            margin-top: 22px;
            max-width: 480px;
            font-size: 15px;
            color: #5a6a73;
            line-height: 1.6;
            font-weight: 500;
          }
          .cover-chart-wrap {
            flex-shrink: 0;
            width: 230px;
            margin-bottom: 8px;
          }
          .cover-elevates {
            font-size: 13px;
            font-weight: 600;
            color: #36474F;
            font-style: italic;
            opacity: 0.65;
          }
          .cover-elevates strong {
            color: #8FB6C2;
            font-weight: 700;
            font-style: normal;
          }

          /* --------- CONTENT PAGES --------- */
          .page, .report-page {
            position: relative;
            max-width: none;
            margin: 0 auto;
            padding: 56px 64px 80px;
            background: #ffffff;
            min-height: 100vh;
            page-break-after: always;
            break-after: page;
          }
          .report-page { padding: 0 0 60px; }
          .section-body { padding: 32px 56px 0; }
          .page-break { page-break-before: always; break-before: page; }

          .page-footer {
            position: absolute;
            bottom: 28px;
            left: 56px;
            right: 56px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            font-weight: 700;
            color: #94a3b8;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            border-top: 1px solid #eef2f8;
            padding-top: 10px;
          }

          /* TABLE OF CONTENTS */
          .toc-header { margin-bottom: 28px; }
          .toc-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; color: #2e6bff; }
          .toc-title { margin: 8px 0 0; font-size: 44px; font-weight: 800; color: #10213d; letter-spacing: -0.02em; }
          .toc-desc { margin-top: 12px; max-width: 540px; font-size: 14px; color: #60729a; line-height: 1.6; }
          .toc-list { display: flex; flex-direction: column; gap: 12px; }
          .toc-row {
            position: relative;
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 18px 24px 18px 30px;
            background: #f8fbff;
            border-radius: 14px;
            overflow: hidden;
          }
          .toc-bar { position: absolute; top: 0; left: 0; bottom: 0; width: 5px; }
          .toc-num { font-size: 26px; font-weight: 800; line-height: 1; min-width: 50px; letter-spacing: -0.02em; }
          .toc-text { flex: 1; }
          .toc-row .toc-title { margin: 0; font-size: 17px; font-weight: 700; color: #10213d; letter-spacing: 0; }
          .toc-row .toc-desc { margin: 3px 0 0; font-size: 12.5px; color: #60729a; line-height: 1.5; max-width: none; }

          /* OVERVIEW PAGE */
          .overview-header { margin-bottom: 30px; }
          .overview-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; color: #2e6bff; }
          .overview-title { margin: 8px 0 4px; font-size: 44px; font-weight: 800; color: #10213d; letter-spacing: -0.02em; }
          .overview-desc { color: #60729a; font-size: 14.5px; line-height: 1.6; max-width: 580px; }
          .overview-meta { margin-top: 18px; font-size: 11px; color: #94a3b8; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; }

          .overview-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
          .stat-card {
            padding: 22px 22px 24px;
            background: linear-gradient(160deg, #f8fbff 0%, #ffffff 60%);
            border: 1px solid #dbe7ff;
            border-radius: 18px;
            position: relative;
            overflow: hidden;
          }
          .stat-card::before {
            content: '';
            position: absolute;
            top: 22px;
            left: 0;
            width: 4px;
            height: 36px;
            background: #2e6bff;
            border-radius: 0 4px 4px 0;
          }
          .stat-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #60729a; }
          .stat-value { margin-top: 12px; font-size: 38px; font-weight: 800; color: #10213d; line-height: 1; letter-spacing: -0.025em; }

          /* SECTION HERO BAND */
          .section-hero {
            color: #ffffff;
            padding: 52px 64px 36px;
            position: relative;
            overflow: hidden;
          }
          .section-hero::after {
            content: '';
            position: absolute;
            top: -120px;
            right: -80px;
            width: 320px;
            height: 320px;
            border-radius: 50%;
            background: rgba(255,255,255,0.12);
          }
          .section-hero::before {
            content: '';
            position: absolute;
            bottom: -60px;
            right: 80px;
            width: 160px;
            height: 160px;
            border-radius: 50%;
            background: rgba(255,255,255,0.08);
          }
          .section-hero-inner { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
          .section-hero-left { display: flex; align-items: center; gap: 26px; }
          .section-hero-num {
            font-size: 60px;
            font-weight: 800;
            line-height: 1;
            color: rgba(255,255,255,0.55);
            letter-spacing: -0.025em;
          }
          .section-hero-meta { color: #ffffff; }
          .section-hero-kicker {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            opacity: 0.85;
          }
          .section-hero-title {
            margin: 6px 0 0;
            font-size: 36px;
            font-weight: 800;
            letter-spacing: -0.02em;
            line-height: 1.1;
          }
          .section-hero-icon {
            position: relative;
            z-index: 2;
            width: 80px;
            height: 80px;
            border-radius: 22px;
            background: rgba(255,255,255,0.96);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .section-hero-icon svg { width: 46px; height: 46px; display: block; }
          .section-hero-desc {
            position: relative;
            z-index: 2;
            margin-top: 18px;
            max-width: 600px;
            font-size: 13.5px;
            line-height: 1.6;
            color: rgba(255,255,255,0.92);
          }

          /* SECTION GRID — featured metric beside supporting */
          .section-grid {
            display: grid;
            grid-template-columns: 0.95fr 1.5fr;
            gap: 18px;
            margin-bottom: 4px;
          }
          .featured-metric {
            background: #ffffff;
            border: 2px solid;
            border-radius: 22px;
            padding: 28px 26px;
            position: relative;
            overflow: hidden;
          }
          .featured-metric::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 6px;
            background: var(--accent, #2e6bff);
          }
          .featured-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: #60729a;
            margin-top: 4px;
          }
          .featured-value {
            margin-top: 10px;
            font-size: 64px;
            font-weight: 800;
            line-height: 1;
            letter-spacing: -0.03em;
          }
          .featured-caption {
            margin-top: 16px;
            font-size: 12.5px;
            color: #60729a;
            line-height: 1.55;
          }
          .section-grid-stats { display: flex; align-items: stretch; }
          .section-grid-stats .summary-grid {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin: 0;
            align-content: start;
          }

          .section-error { margin: 0 0 14px; padding: 12px 16px; border-radius: 12px; background: #fef2f2; color: #b91c1c; font-size: 13px; font-weight: 600; border: 1px solid #fecaca; }

          .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 4px; }
          .summary-item {
            padding: 14px 16px 16px;
            background: #f8fbff;
            border: 1px solid #dbe7ff;
            border-radius: 12px;
            border-left: 3px solid var(--accent, #2e6bff);
          }
          .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #60729a; }
          .summary-value { margin-top: 6px; font-size: 22px; font-weight: 800; color: #10213d; letter-spacing: -0.015em; }

          /* PULL QUOTE highlights */
          .pullquote {
            margin-top: 22px;
            padding: 22px 26px;
            border-radius: 16px;
            border-left: 5px solid;
          }
          .pullquote-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            margin-bottom: 12px;
          }
          .pullquote-list { list-style: none; margin: 0; padding: 0; }
          .pullquote-list li {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin: 8px 0;
            font-size: 13.5px;
            line-height: 1.5;
            color: #10213d;
          }
          .pullquote-bullet {
            display: inline-block;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            margin-top: 7px;
            flex-shrink: 0;
          }

          .detail-block { margin-top: 24px; }
          .detail-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            margin-bottom: 12px;
            page-break-after: avoid;
            break-after: avoid-page;
          }
          .card-list { display: grid; gap: 10px; }
          .mini-card {
            border: 1px solid #e4ecf7;
            border-left: 4px solid #2e6bff;
            border-radius: 12px;
            padding: 14px 16px;
            background: #f8fbff;
            font-size: 13px;
            line-height: 1.5;
            color: #10213d;
          }
          .mini-card strong { color: #10213d; }
          .mini-meta { margin-top: 4px; color: #60729a; font-size: 12.5px; }
          .mini-card p { margin: 10px 0 0; color: #475471; font-style: italic; }

          .table-wrap { overflow: hidden; border: 1px solid #dbe7ff; border-radius: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 11px 14px; text-align: left; vertical-align: top; color: #10213d; }
          th { background: #2e6bff; color: #ffffff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10.5px; }
          tbody tr { border-bottom: 1px solid #eef2f8; }
          tbody tr:nth-child(even) { background: #f8fbff; }
          tbody tr:last-child { border-bottom: none; }

          /* --------- FOOTER --------- */
          .footer-page { padding: 60px 64px 80px; background: linear-gradient(135deg, #f4f8ff 0%, #eef3ff 100%); min-height: 100vh; }
          .footer-card { background: #ffffff; border: 1px solid #dbe7ff; border-radius: 22px; padding: 40px 44px; box-shadow: 0 4px 16px rgba(46,107,255,0.06); }
          .footer-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; color: #2e6bff; }
          .footer-title { margin: 8px 0 24px; font-size: 32px; font-weight: 800; color: #10213d; letter-spacing: -0.02em; }
          .footer-row { display: flex; align-items: baseline; gap: 16px; padding: 12px 0; border-bottom: 1px solid #eef2f8; font-size: 13.5px; color: #10213d; }
          .footer-row:last-child { border-bottom: none; }
          .footer-label { flex: 0 0 110px; text-transform: uppercase; letter-spacing: 0.12em; font-size: 10.5px; font-weight: 700; color: #60729a; }
          .footer-value { flex: 1; word-break: break-word; font-weight: 500; }
          .footer-brand { display: flex; align-items: center; gap: 16px; margin-top: 30px; padding-top: 22px; border-top: 2px solid #eef2f8; color: #60729a; font-size: 12px; }
          .footer-brand img { width: 140px; height: auto; max-height: 44px; object-fit: contain; }

          @media print {
            body { background: #ffffff; }
            .page, .report-page, .footer-page, .cover { min-height: auto; }
            .stat-card, .summary-item, .mini-card, .featured-metric, .pullquote, .toc-row { break-inside: avoid; }
            .report-page, .page, .footer-page { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        <!-- ===== COVER PAGE (calm, brand-aligned) ===== -->
        <section class="cover">
          <!-- Soft teal corner accent (top-right) -->
          <svg class="cover-corner-tr" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <radialGradient id="cc1" cx="80%" cy="20%" r="80%">
                <stop offset="0%" stop-color="#8FB6C2" stop-opacity="0.55"/>
                <stop offset="100%" stop-color="#8FB6C2" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="280" cy="40" r="280" fill="url(#cc1)"/>
          </svg>

          <!-- Tiny navy corner accent (bottom-left, behind the band) -->
          <svg class="cover-corner-bl" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <radialGradient id="cc2" cx="20%" cy="80%" r="80%">
                <stop offset="0%" stop-color="#36474F" stop-opacity="0.18"/>
                <stop offset="100%" stop-color="#36474F" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="20" cy="200" r="220" fill="url(#cc2)"/>
          </svg>

          <!-- Dot pattern accent -->
          <svg class="cover-dots" viewBox="0 0 90 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g fill="rgba(143,182,194,0.55)">
              ${Array.from({ length: 7 }, (_, row) =>
                Array.from({ length: 9 }, (_, col) =>
                  `<circle cx="${col * 10 + 5}" cy="${row * 10 + 5}" r="1.2"/>`
                ).join('')
              ).join('')}
            </g>
          </svg>

          <div class="cover-inner">
            <div class="cover-top">
              <div class="cover-brand">
                <div class="cover-brand-row">
                  <img src="${escapeHtml(logoSrc)}" alt="CliniMedia" />
                  <div class="cover-brand-text">
                    <div class="cover-brand-name"><span class="cover-brand-name-accent">Clini</span>Media</div>
                    <div class="cover-brand-sub">Marketing That Elevates</div>
                  </div>
                </div>
              </div>
              <div class="cover-period">${escapeHtml(coverDateRange)}</div>
            </div>

            <div class="cover-mid">
              <div class="cover-headline">
                <div class="cover-tagline">${escapeHtml(report.period.label)}</div>
                <h1 class="cover-title">Marketing<br/><span class="cover-title-accent">Report</span></h1>
                <div class="cover-divider"></div>
                <div class="cover-subtitle">A performance summary of every channel we run for ${escapeHtml(report.clinic.name)} this ${escapeHtml(report.period.label.toLowerCase())}.</div>
                <div class="cover-elevates" style="margin-top: 22px;">
                  Marketing That <strong>Elevates</strong>.
                </div>
              </div>
              <div class="cover-chart-wrap">
                <svg viewBox="0 0 230 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <defs>
                    <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#8FB6C2"/>
                      <stop offset="100%" stop-color="#8FB6C2" stop-opacity="0.25"/>
                    </linearGradient>
                  </defs>
                  <line x1="6" y1="135" x2="225" y2="135" stroke="rgba(54,71,79,0.25)" stroke-width="1" stroke-dasharray="3 4"/>
                  <rect x="14"  y="100" width="20" height="35"  rx="3" fill="url(#bar-grad)"/>
                  <rect x="46"  y="80"  width="20" height="55"  rx="3" fill="url(#bar-grad)"/>
                  <rect x="78"  y="58"  width="20" height="77"  rx="3" fill="url(#bar-grad)"/>
                  <rect x="110" y="38"  width="20" height="97"  rx="3" fill="url(#bar-grad)"/>
                  <rect x="142" y="22"  width="20" height="113" rx="3" fill="url(#bar-grad)"/>
                  <rect x="174" y="8"   width="20" height="127" rx="3" fill="url(#bar-grad)"/>
                  <polyline points="24,100 56,80 88,58 120,38 152,22 184,8" stroke="#36474F" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="24"  cy="100" r="3.5" fill="#36474F"/>
                  <circle cx="56"  cy="80"  r="3.5" fill="#36474F"/>
                  <circle cx="88"  cy="58"  r="3.5" fill="#36474F"/>
                  <circle cx="120" cy="38"  r="3.5" fill="#36474F"/>
                  <circle cx="152" cy="22"  r="3.5" fill="#36474F"/>
                  <circle cx="184" cy="8"   r="5"   fill="#36474F"/>
                  <circle cx="184" cy="8"   r="2.5" fill="#ffffff"/>
                  <path d="M205,22 L225,8 L213,8 Z" fill="#36474F"/>
                </svg>
              </div>
            </div>
          </div>

          <!-- Slim bottom brand band — minimal, not heavy -->
          <div class="cover-band">
            <div class="cover-band-inner">
              <div class="cover-band-left">
                <div class="cover-band-tagline">Prepared for</div>
                <div class="cover-band-clinic">${escapeHtml(report.clinic.name)}</div>
              </div>
              <div class="cover-band-meta">
                <strong>CliniMedia</strong>
                ${escapeHtml(coverDateRange)}
              </div>
            </div>
          </div>
        </section>

        <!-- ===== TABLE OF CONTENTS ===== -->
        <div class="page">
          <div class="toc-header">
            <div class="toc-kicker">01 · Inside this report</div>
            <h2 class="toc-title">Table of Contents</h2>
            <p class="toc-desc">A guided tour through every channel running for ${escapeHtml(report.clinic.name)}. Each section opens with a hero metric followed by supporting performance data.</p>
          </div>
          <div class="toc-list">${tocHtml}</div>
          <div class="page-footer">
            <span>${escapeHtml(report.clinic.name)} · ${escapeHtml(coverDateRange)}</span>
            <span>01</span>
          </div>
        </div>

        <!-- ===== OVERVIEW PAGE ===== -->
        <div class="page">
          <div class="overview-header">
            <div class="overview-kicker">02 · Overview</div>
            <h2 class="overview-title">Performance at a Glance</h2>
            <p class="overview-desc">Headline metrics summarizing lead volume, phone activity, and AI reception across the ${escapeHtml(report.period.label.toLowerCase())} window. Each channel is broken down in detail on the pages that follow.</p>
            <div class="overview-meta">Reporting window · ${escapeHtml(coverDateRange)} · Generated ${escapeHtml(new Date(report.generatedAt).toLocaleDateString())}</div>
          </div>
          <div class="overview-grid">${overviewHtml}</div>
          <div class="page-footer">
            <span>${escapeHtml(report.clinic.name)} · ${escapeHtml(coverDateRange)}</span>
            <span>02</span>
          </div>
        </div>

        <!-- ===== SECTION PAGES ===== -->
        ${sectionsHtml}
      </body>
    </html>`;
}

const MarketingReportsPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('last14Days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailDraftPayload | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const adminToken = localStorage.getItem('adminToken');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const response = await axios.get(`${apiBaseUrl}/customers`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        setCustomers(response.data || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load clinics.');
      } finally {
        setLoadingCustomers(false);
      }
    };

    void fetchCustomers();
  }, [apiBaseUrl, adminToken]);

  const selectedClinic = useMemo(
    () => customers.find((customer) => customer._id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const buildParams = () => {
    if (selectedPreset === 'custom') {
      if (!customStart || !customEnd) {
        throw new Error('Please choose both custom dates.');
      }
      if (customStart > customEnd) {
        throw new Error('Custom start date must be before the end date.');
      }

      return {
        customerId: selectedCustomerId,
        start: customStart,
        end: customEnd,
        label: 'Custom Report',
      };
    }

    return {
      customerId: selectedCustomerId,
      preset: selectedPreset,
    };
  };

  const fetchEmailDraft = async (params: Record<string, string | undefined>) => {
    const response = await axios.get(`${apiBaseUrl}/reports/marketing/email-draft`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      params,
    });
    return response.data as EmailDraftPayload;
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    setError(null);
    if (value !== 'custom') {
      setCustomStart('');
      setCustomEnd('');
    }
  };

  const handleCustomStartChange = (value: string) => {
    setSelectedPreset('custom');
    setCustomStart(value);
    setError(null);
  };

  const handleCustomEndChange = (value: string) => {
    setSelectedPreset('custom');
    setCustomEnd(value);
    setError(null);
  };

  const handleGenerateReport = async () => {
    if (!selectedCustomerId) {
      setError('Please select a clinic first.');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      const params = buildParams();

      const [reportResponse, draftResponse] = await Promise.all([
        axios.get(`${apiBaseUrl}/reports/marketing`, {
          headers: { Authorization: `Bearer ${adminToken}` },
          params,
        }),
        fetchEmailDraft(params),
      ]);

      setReport(reportResponse.data);
      setEmailDraft(draftResponse);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;

    try {
      setDownloading(true);
      const printWindow = window.open('', '_blank', 'width=1100,height=900');
      if (!printWindow) {
        throw new Error('Unable to open print preview. Please allow pop-ups for this site.');
      }

      // Inline the logo as a base64 data URI so the print window doesn't
      // race against a network fetch. window.open('') has no base URL,
      // and Chrome can fire print() before an <img src> finishes loading.
      const logoDataUri = await fetch(logo1)
        .then((r) => r.blob())
        .then((blob) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('logo read failed'));
          reader.readAsDataURL(blob);
        }))
        .catch(() => `${window.location.origin}${logo1.startsWith('/') ? '' : '/'}${logo1}`);
      const printableHtml = buildPrintHtml(report, emailDraft, logoDataUri);
      const triggerPrint = () => {
        printWindow.document.title = report.exportFileName.replace(/\.pdf$/i, '');
        printWindow.focus();
        printWindow.print();
      };

      printWindow.onload = triggerPrint;
      printWindow.document.open();
      printWindow.document.write(printableHtml);
      printWindow.document.close();
      if (printWindow.document.readyState === 'complete') {
        triggerPrint();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open PDF preview.');
    } finally {
      setDownloading(false);
    }
  };

  const renderIntegrationPills = () => {
    if (!report) return null;

    const enabledIntegrations = Object.entries(report.availableIntegrations).filter(([, enabled]) => enabled);
    if (!enabledIntegrations.length) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {enabledIntegrations.map(([key]) => (
          <span
            key={key}
            className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
          >
            {humanizeKey(key)}
          </span>
        ))}
      </div>
    );
  };

  const visibleSections = report ? report.sections.filter(hasRenderableSectionContent) : [];
  const topHighlights = report ? getTopHighlights(report) : [];

  const renderTable = (rows: Array<Record<string, any>>) => {
    if (!rows.length) return null;
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left font-semibold text-slate-600">
                  {humanizeKey(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, index) => (
              <tr key={`${index}-${Object.values(row).join('-')}`}>
                {headers.map((header) => (
                  <td key={header} className="px-3 py-2 text-slate-700">
                    {formatMetricValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <img src={logo1} alt="CliniMedia logo" className="h-14 w-auto object-contain" />
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                  <FaChartLine />
                  CliniMedia Reporting
                </div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Clinic Marketing Reports</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Generate a polished report for each clinic, review the final layout, and export a clean PDF for delivery.
                </p>
              </div>
            </div>

            <div className="admin-report-toolbar grid gap-3 md:grid-cols-2 xl:grid-cols-[230px_190px_170px_170px_auto]">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Clinic</span>
                <select
                  value={selectedCustomerId}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                  disabled={loadingCustomers}
                >
                  <option value="">Select clinic</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</span>
                <select
                  value={selectedPreset}
                  onChange={(event) => handlePresetChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                >
                  {PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Custom Start</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => handleCustomStartChange(event.target.value)}
                  onFocus={() => setSelectedPreset('custom')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Custom End</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => handleCustomEndChange(event.target.value)}
                  onFocus={() => setSelectedPreset('custom')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                />
              </label>

              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={generating || loadingCustomers}
                className="mt-[21px] inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? <FaSpinner className="mr-2 animate-spin" /> : <FaCalendarAlt className="mr-2" />}
                Generate
              </button>
            </div>
          </div>
        </div>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loadingCustomers && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
            <FaSpinner className="animate-spin text-blue-500" />
            Loading clinics...
          </div>
        )}

        {!report && !loadingCustomers && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <FaFilePdf className="mx-auto text-4xl text-slate-300" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Clinic Report Preview</h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose a clinic, set the reporting window, and generate the report to review the final export before downloading it.
            </p>
          </div>
        )}

        {report && (
          <>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  <img src={logo1} alt="CliniMedia logo" className="h-12 w-auto object-contain" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{report.reportTitle}</div>
                    <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{report.clinic.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                        <FaBuilding className="text-slate-400" />
                        {report.clinic.location || selectedClinic?.location || 'Clinic'}
                      </span>
                      <span>{report.period.start} to {report.period.end}</span>
                      <span>Generated {new Date(report.generatedAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-4">{renderIntegrationPills()}</div>
                  </div>
                </div>

                <div className="admin-report-toolbar flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={generating}
                    className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <FaSyncAlt className="mr-2" />
                    Refresh Data
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                    className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {downloading ? <FaSpinner className="mr-2 animate-spin" /> : <FaDownload className="mr-2" />}
                    Download / Save PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {visibleOverviewCards(report).map((card) => (
                <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{card.label}</div>
                  <div className={`mt-2 text-3xl font-bold ${card.accent}`}>
                    {formatMetricValue(report.overview[card.key as keyof typeof report.overview], card.key)}
                  </div>
                </div>
              ))}
            </div>

            {topHighlights.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <FaChartLine />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Executive Summary</div>
                    <h3 className="text-xl font-semibold text-slate-900">Important Notes</h3>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {topHighlights.map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {emailDraft && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <FaEnvelopeOpenText />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Suggested Client Email</div>
                    <h3 className="text-xl font-semibold text-slate-900">{emailDraft.subject}</h3>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-sans text-sm leading-7 text-slate-700">
                  {emailDraft.body}
                </pre>
              </section>
            )}

            <div className="report-preview-root space-y-4">
        {visibleSections.map((section) => (
                <section key={section.id} className={`rounded-3xl border p-6 shadow-sm ${getSectionTheme(section.id).shell}`}>
                  <div className="mb-5 flex items-start gap-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg shadow-sm ${getSectionTheme(section.id).iconWrap}`}>
                      {sectionIcons[section.id] || <FaChartLine className="text-slate-700" />}
                    </div>
                    <div>
                      <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${getSectionTheme(section.id).label}`}>Channel Performance</div>
                      <h3 className="text-xl font-semibold text-slate-900">{section.title}</h3>
                      {section.error && <p className="mt-1 text-sm text-red-600">{section.error}</p>}
                    </div>
                  </div>
                  {renderSummaryGrid(section.summary)}
                  {section.sourceWindow?.periodStart && section.sourceWindow?.periodEnd && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      Google data currently covers {String(section.sourceWindow.periodStart)} to {String(section.sourceWindow.periodEnd)}.
                    </div>
                  )}
                  {section.highlights && section.highlights.length > 0 && (
                    <div className="mt-5">
                      <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${getSectionTheme(section.id).label}`}>Highlights</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {section.highlights.slice(0, 3).map((highlight) => (
                          <div key={highlight} className={`rounded-xl px-4 py-3 text-sm shadow-sm ${getSectionTheme(section.id).chip}`}>{highlight}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {section.campaigns && section.campaigns.length > 0 && (
                    <div className="mt-5">
                      <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${getSectionTheme(section.id).label}`}>Campaign Snapshot</div>
                      {renderTable(getCompactRows(section.campaigns, 5))}
                    </div>
                  )}
                  {section.topPosts && section.topPosts.length > 0 && (
                    <div className="mt-5">
                      <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${getSectionTheme(section.id).label}`}>Top Posts</div>
                      <div className="grid gap-3">
                        {section.topPosts.slice(0, 3).map((post, index) => (
                          <div key={`${post.permalink || 'post'}-${index}`} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                            <div className="font-semibold text-slate-900">{post.caption || 'Instagram post'}</div>
                            <div className="mt-1 text-xs text-slate-500">Reach {formatMetricValue(post.reach)} | Engagement {formatMetricValue(post.engagement)} | Plays {formatMetricValue(post.plays)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {section.topReasons && section.topReasons.length > 0 && (
                    <div className="mt-5">
                      <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${getSectionTheme(section.id).label}`}>Top Reasons For Calling</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {section.topReasons.slice(0, 4).map((item, index) => (
                          <div key={`${item.reason || 'reason'}-${index}`} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                            <div className="font-semibold text-slate-900">{item.reason || 'Reason'}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatMetricValue(item.count)} calls</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {section.recentReviews && section.recentReviews.length > 0 && (
                    <div className="mt-5">
                      <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${getSectionTheme(section.id).label}`}>Recent Reviews</div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {section.recentReviews.slice(0, 3).map((review, index) => (
                          <div key={`${review.reviewerName || 'review'}-${index}`} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-slate-900">{review.reviewerName || 'Reviewer'}</div>
                              <div className="text-xs font-semibold text-amber-600">Rating {formatMetricValue(review.starRating)}</div>
                            </div>
                            {review.createTime && <div className="mt-1 text-xs text-slate-500">{new Date(review.createTime).toLocaleDateString()}</div>}
                            {review.comment && <p className="mt-2 leading-6 text-slate-700">{review.comment}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default MarketingReportsPage;
