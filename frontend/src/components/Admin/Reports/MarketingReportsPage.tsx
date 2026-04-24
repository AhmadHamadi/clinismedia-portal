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
  pageInfo?: Record<string, any>;
  sourceWindow?: Record<string, any>;
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
  { key: 'totalLeads', label: 'Total Leads', accent: 'text-sky-600' },
  { key: 'bookedMetaAppointments', label: 'Booked Leads', accent: 'text-pink-600' },
  { key: 'totalCalls', label: 'Tracked Calls', accent: 'text-emerald-600' },
  { key: 'newPatientCalls', label: 'New Patient Calls', accent: 'text-indigo-600' },
  { key: 'callAppointmentsBooked', label: 'Call Bookings', accent: 'text-amber-600' },
  { key: 'aiCalls', label: 'AI Calls', accent: 'text-violet-600' },
];

const sectionIcons: Record<string, React.ReactNode> = {
  metaLeads: <FaBolt className="text-pink-600" />,
  callTracking: <FaPhone className="text-emerald-600" />,
  aiReception: <FaRobot className="text-violet-600" />,
  googleBusiness: <FaGoogle className="text-blue-600" />,
  googleAds: <FaGoogle className="text-amber-500" />,
  instagram: <FaInstagram className="text-fuchsia-600" />,
  facebook: <FaFacebookF className="text-sky-600" />,
  qrReviews: <FaStar className="text-yellow-500" />,
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
    section.recentReviews?.length
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

function formatMetricValue(value: any) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'number') {
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
            {formatMetricValue(value)}
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
            <tr>${headers.map((header) => `<td>${escapeHtml(formatMetricValue(row[header]))}</td>`).join('')}</tr>
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
        <path fill="#be185d" d="M12 2l2.7 5.46L20.7 8l-4.35 4.24L17.4 18 12 15.27 6.6 18l1.05-5.76L3.3 8l6-.54z"/>
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
        <path fill="#4285F4" d="M21.8 12.23c0-.73-.06-1.25-.2-1.8H12v3.43h5.64c-.11.85-.72 2.13-2.08 2.99l-.02.11 3.02 2.34.21.02c1.93-1.78 3.03-4.4 3.03-7.09z"/>
        <path fill="#34A853" d="M12 22c2.76 0 5.07-.91 6.76-2.47l-3.22-2.49c-.86.6-2.01 1.03-3.54 1.03-2.7 0-4.99-1.78-5.81-4.24l-.1.01-3.14 2.43-.04.1A10 10 0 0012 22z"/>
        <path fill="#FBBC05" d="M6.19 13.83A5.99 5.99 0 016 12c0-.64.11-1.26.29-1.83l-.01-.12-3.18-2.47-.1.05A10 10 0 002 12c0 1.62.39 3.15 1.09 4.5z"/>
        <path fill="#EA4335" d="M12 5.93c1.93 0 3.23.83 3.97 1.53l2.9-2.83C17.06 2.94 14.76 2 12 2a10 10 0 00-8.91 5.5l3.29 2.54C7.22 7.71 9.3 5.93 12 5.93z"/>
      </svg>
    `,
    googleAds: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M10.87 3.5a4 4 0 016.93 0l4.46 7.72a4 4 0 11-6.93 4L10.87 7.5a4 4 0 010-4z"/>
        <circle cx="7" cy="18" r="3" fill="#34A853"/>
        <path fill="#FBBC05" d="M9.55 5.18l5.87 10.16a4 4 0 11-6.93 4L2.62 9.18a4 4 0 116.93-4z"/>
      </svg>
    `,
    instagram: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f58529"/>
            <stop offset="45%" stop-color="#dd2a7b"/>
            <stop offset="100%" stop-color="#515bd4"/>
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#ig-grad)"/>
        <circle cx="12" cy="12" r="4.1" fill="none" stroke="#fff" stroke-width="1.8"/>
        <circle cx="17.4" cy="6.6" r="1.2" fill="#fff"/>
      </svg>
    `,
    facebook: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" fill="#1877F2"/>
        <path fill="#fff" d="M13.3 19v-5.86h1.96l.29-2.28H13.3V9.4c0-.66.18-1.11 1.13-1.11h1.21V6.25c-.21-.03-.94-.09-1.79-.09-1.77 0-2.98 1.08-2.98 3.07v1.63H9v2.28h1.87V19z"/>
      </svg>
    `,
    qrReviews: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#a16207" d="M12 2l2.7 5.46L20.7 8l-4.35 4.24L17.4 18 12 15.27 6.6 18l1.05-5.76L3.3 8l6-.54z"/>
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

function buildPrintHtml(report: ReportPayload, _emailDraft: EmailDraftPayload | null, logoSrc: string) {
  const visibleSections = report.sections
    .filter(hasRenderableSectionContent)
    .sort((a, b) => (SECTION_ORDER[a.id] || 99) - (SECTION_ORDER[b.id] || 99));

  const coverDateRange = formatDateLongRange(report.period.start, report.period.end);
  const endYear = new Date(`${report.period.end}T00:00:00`).getFullYear() || new Date().getFullYear();

  const overviewHtml = overviewCards.map((card) => `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-value">${escapeHtml(formatMetricValue(report.overview[card.key as keyof typeof report.overview]))}</div>
    </div>
  `).join('');

  const sectionsHtml = visibleSections.map((section, idx) => {
    const accentMap: Record<string, { border: string; badge: string; icon: string; kicker: string }> = {
      metaLeads: { border: '#ec4899', badge: '#fce7f3', icon: '#be185d', kicker: 'Lead Generation' },
      callTracking: { border: '#10b981', badge: '#d1fae5', icon: '#047857', kicker: 'Phone Performance' },
      aiReception: { border: '#8b5cf6', badge: '#ede9fe', icon: '#6d28d9', kicker: 'AI Receptionist' },
      googleBusiness: { border: '#2563eb', badge: '#dbeafe', icon: '#1d4ed8', kicker: 'Google Business & Reviews' },
      googleAds: { border: '#f59e0b', badge: '#fef3c7', icon: '#b45309', kicker: 'Paid Search' },
      instagram: { border: '#d946ef', badge: '#fae8ff', icon: '#a21caf', kicker: 'Instagram Insights' },
      facebook: { border: '#0ea5e9', badge: '#e0f2fe', icon: '#0369a1', kicker: 'Facebook Insights' },
      qrReviews: { border: '#eab308', badge: '#fef9c3', icon: '#a16207', kicker: 'QR Review Program' },
    };
    const accent = accentMap[section.id] || { border: '#94a3b8', badge: '#f1f5f9', icon: '#334155', kicker: 'Channel Performance' };
    const summaryEntries = Object.entries(section.summary || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
    const summaryHtml = summaryEntries.length
      ? `<div class="summary-grid">${summaryEntries.map(([key, value]) => `
          <div class="summary-item">
            <div class="summary-label">${escapeHtml(humanizeKey(key))}</div>
            <div class="summary-value">${escapeHtml(formatMetricValue(value))}</div>
          </div>
        `).join('')}</div>`
      : '';

    const highlightsHtml = section.highlights?.length
      ? `<div class="detail-block"><div class="detail-title">Highlights</div><ul class="pill-list">${section.highlights.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
      : '';

    const campaignsHtml = section.campaigns?.length
      ? `<div class="detail-block"><div class="detail-title">Campaign Snapshot</div>${buildTableHtml(section.campaigns.slice(0, 5))}</div>`
      : '';

    const recentLeadsHtml = section.recentLeads?.length
      ? `<div class="detail-block"><div class="detail-title">Recent Leads</div>${buildTableHtml(section.recentLeads.slice(0, 5))}</div>`
      : '';

    const topPostsHtml = section.topPosts?.length
      ? `<div class="detail-block"><div class="detail-title">Top Posts</div><div class="card-list">${section.topPosts.slice(0, 3).map((post) => `
          <div class="mini-card">
            <strong>${escapeHtml(post.caption || 'Instagram post')}</strong>
            <div class="mini-meta">${escapeHtml(`Reach ${formatMetricValue(post.reach)} · Engagement ${formatMetricValue(post.engagement)} · Plays ${formatMetricValue(post.plays)}`)}</div>
          </div>
        `).join('')}</div></div>`
      : '';

    const topReasonsHtml = section.topReasons?.length
      ? `<div class="detail-block"><div class="detail-title">Top Reasons for Calling</div><div class="card-list">${section.topReasons.slice(0, 4).map((item) => `
          <div class="mini-card">
            <strong>${escapeHtml(item.reason || 'Reason')}</strong>
            <div class="mini-meta">${escapeHtml(`${formatMetricValue(item.count)} calls`)}</div>
          </div>
        `).join('')}</div></div>`
      : '';

    const recentReviewsHtml = section.recentReviews?.length
      ? `<div class="detail-block"><div class="detail-title">Recent Reviews</div><div class="card-list">${section.recentReviews.slice(0, 3).map((review) => `
          <div class="mini-card">
            <strong>${escapeHtml(review.reviewerName || 'Reviewer')}</strong>
            <div class="mini-meta">${escapeHtml(`Rating ${formatMetricValue(review.starRating)} · ${review.createTime ? new Date(review.createTime).toLocaleDateString() : ''}`)}</div>
            ${review.comment ? `<p>${escapeHtml(review.comment)}</p>` : ''}
          </div>
        `).join('')}</div></div>`
      : '';

    const errorHtml = section.error
      ? `<div class="section-error">${escapeHtml(section.error)}</div>`
      : '';

    return `
      <section class="report-section" style="--accent: ${accent.border};">
        <div class="section-head">
          <div class="section-title-wrap">
            <div class="section-logo" style="background:${accent.badge}; color:${accent.icon};">
              ${getPrintSectionIcon(section.id)}
            </div>
            <div>
              <div class="section-kicker" style="color: ${accent.icon};">${escapeHtml(accent.kicker)}</div>
              <h2>${escapeHtml(section.title)}</h2>
            </div>
          </div>
          <div class="section-number" style="color: ${accent.icon};">${String(idx + 1).padStart(2, '0')}</div>
        </div>
        ${errorHtml}
        ${summaryHtml}
        ${highlightsHtml}
        ${campaignsHtml}
        ${recentLeadsHtml}
        ${topPostsHtml}
        ${topReasonsHtml}
        ${recentReviewsHtml}
      </section>
    `;
  }).join('');

  const websiteLine = report.clinic.website
    ? `<div class="footer-row"><span class="footer-label">Website</span><span class="footer-value">${escapeHtml(report.clinic.website)}</span></div>`
    : '';
  const emailLine = report.clinic.email
    ? `<div class="footer-row"><span class="footer-label">Email</span><span class="footer-value">${escapeHtml(report.clinic.email)}</span></div>`
    : '';
  const locationLine = report.clinic.location
    ? `<div class="footer-row"><span class="footer-label">Location</span><span class="footer-value">${escapeHtml(report.clinic.location)}</span></div>`
    : '';

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(report.exportFileName.replace(/\.pdf$/i, ''))}</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: Letter; margin: 0; }
          html, body { margin: 0; padding: 0; color: #0f172a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f4f3fb; }

          /* --------- COVER PAGE --------- */
          .cover {
            position: relative;
            width: 100%;
            min-height: 100vh;
            padding: 56px 64px;
            background: linear-gradient(135deg, #eeecfa 0%, #f2eaf6 55%, #efe8f5 100%);
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
          .cover::before {
            content: '';
            position: absolute;
            top: -120px;
            right: -120px;
            width: 620px;
            height: 620px;
            background:
              radial-gradient(circle at 30% 30%, rgba(189, 163, 232, 0.95), rgba(189, 163, 232, 0) 60%),
              radial-gradient(circle at 70% 40%, rgba(229, 144, 196, 0.85), rgba(229, 144, 196, 0) 65%),
              radial-gradient(circle at 55% 75%, rgba(136, 152, 222, 0.85), rgba(136, 152, 222, 0) 60%);
            filter: blur(12px);
            border-radius: 50%;
          }
          .cover::after {
            content: '';
            position: absolute;
            top: 8%;
            left: 6%;
            width: 110px;
            height: 110px;
            background: radial-gradient(circle, rgba(99,91,145,0.12) 1.5px, transparent 2px);
            background-size: 10px 10px;
          }
          .cover-inner { position: relative; z-index: 2; display: flex; flex-direction: column; justify-content: space-between; min-height: calc(100vh - 112px); }
          .cover-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
          .cover-brand { display: flex; align-items: center; gap: 12px; }
          .cover-brand img { width: 42px; height: 42px; object-fit: contain; }
          .cover-brand-text { font-size: 12px; font-weight: 700; color: #2a2457; line-height: 1.25; letter-spacing: 0.02em; }
          .cover-brand-sub { font-size: 11px; font-weight: 500; color: #6c6596; letter-spacing: 0.06em; text-transform: uppercase; }
          .cover-period { text-align: right; font-size: 13px; color: #2a2457; font-weight: 600; letter-spacing: 0.04em; }
          .cover-title { font-size: 84px; line-height: 0.95; font-weight: 800; color: #2a2457; letter-spacing: -0.02em; margin: 0; }
          .cover-subtitle { margin-top: 22px; max-width: 420px; font-size: 17px; color: #4d4679; line-height: 1.5; font-weight: 500; }
          .cover-bottom { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-top: 24px; border-top: 2px solid rgba(42,36,87,0.18); }
          .cover-address { font-size: 12px; font-weight: 700; color: #2a2457; text-transform: uppercase; letter-spacing: 0.12em; max-width: 320px; line-height: 1.5; }
          .cover-year { font-size: 56px; font-weight: 800; color: #2a2457; letter-spacing: -0.02em; line-height: 1; }
          .cover-clinic { font-size: 22px; font-weight: 700; color: #2a2457; margin-top: 4px; }

          /* --------- CONTENT PAGES --------- */
          .page {
            max-width: 840px;
            margin: 0 auto;
            padding: 48px 56px 64px;
            background: #ffffff;
          }
          .page-break { page-break-before: always; break-before: page; }

          .overview-header { margin-bottom: 24px; }
          .overview-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; color: #6c6596; }
          .overview-title { margin: 6px 0 4px; font-size: 30px; font-weight: 800; color: #1f1b41; letter-spacing: -0.02em; }
          .overview-desc { color: #52537e; font-size: 14px; line-height: 1.6; max-width: 620px; }
          .overview-meta { margin-top: 16px; font-size: 12px; color: #6c6596; letter-spacing: 0.04em; }

          .overview-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 8px; }
          .stat-card { padding: 18px 18px 20px; background: linear-gradient(180deg, #faf9ff 0%, #ffffff 100%); border: 1px solid #e4e1f3; border-radius: 18px; }
          .stat-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6c6596; }
          .stat-value { margin-top: 10px; font-size: 30px; font-weight: 800; color: #1f1b41; line-height: 1; letter-spacing: -0.02em; }

          .section-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }

          .report-section {
            margin-top: 28px;
            padding: 26px 28px 28px;
            background: #ffffff;
            border: 1px solid #e4e1f3;
            border-radius: 22px;
            position: relative;
            border-left: 6px solid var(--accent, #6c6596);
            box-shadow: 0 1px 0 rgba(31,27,65,0.04);
          }
          .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
          .section-title-wrap { display: flex; align-items: flex-start; gap: 14px; }
          .section-logo { width: 46px; height: 46px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .section-logo svg { width: 26px; height: 26px; display: block; }
          .section-number { font-size: 40px; font-weight: 800; opacity: 0.22; letter-spacing: -0.02em; line-height: 1; }
          .report-section h2 { margin: 6px 0 0; font-size: 24px; line-height: 1.15; color: #1f1b41; letter-spacing: -0.01em; }

          .section-error { margin: 0 0 14px; padding: 10px 14px; border-radius: 12px; background: #fef2f2; color: #b91c1c; font-size: 13px; font-weight: 600; border: 1px solid #fecaca; }

          .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 4px; }
          .summary-item { padding: 14px 14px 16px; background: #faf9ff; border: 1px solid #e9e6f5; border-radius: 14px; }
          .summary-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6c6596; }
          .summary-value { margin-top: 6px; font-size: 22px; font-weight: 800; color: #1f1b41; letter-spacing: -0.01em; }

          .detail-block { margin-top: 20px; }
          .detail-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6c6596; margin-bottom: 10px; }
          .pill-list { margin: 0; padding-left: 18px; color: #1f1b41; }
          .pill-list li { margin: 6px 0; font-size: 13.5px; line-height: 1.55; }
          .card-list { display: grid; gap: 10px; }
          .mini-card { border: 1px solid #e9e6f5; border-radius: 14px; padding: 14px 16px; background: #faf9ff; font-size: 13px; line-height: 1.5; color: #1f1b41; }
          .mini-card strong { color: #1f1b41; }
          .mini-meta { margin-top: 4px; color: #52537e; font-size: 12.5px; }
          .mini-card p { margin: 10px 0 0; color: #4b4973; }

          .table-wrap { overflow: hidden; border: 1px solid #e4e1f3; border-radius: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 10px 12px; border-bottom: 1px solid #ede9f8; text-align: left; vertical-align: top; color: #1f1b41; }
          th { background: #f8f6ff; color: #4d4679; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
          tr:last-child td { border-bottom: none; }

          /* --------- FOOTER --------- */
          .footer-page { padding: 56px 56px 72px; background: linear-gradient(135deg, #efedfa 0%, #f6eef5 100%); }
          .footer-card { background: #ffffff; border: 1px solid #e4e1f3; border-radius: 22px; padding: 36px 40px; }
          .footer-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; color: #6c6596; }
          .footer-title { margin: 6px 0 22px; font-size: 28px; font-weight: 800; color: #1f1b41; letter-spacing: -0.02em; }
          .footer-row { display: flex; align-items: baseline; gap: 14px; padding: 10px 0; border-bottom: 1px solid #ede9f8; font-size: 13px; color: #1f1b41; }
          .footer-row:last-child { border-bottom: none; }
          .footer-label { flex: 0 0 100px; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10.5px; font-weight: 700; color: #6c6596; }
          .footer-value { flex: 1; word-break: break-word; font-weight: 500; }
          .footer-brand { display: flex; align-items: center; gap: 12px; margin-top: 28px; padding-top: 20px; border-top: 2px solid #ede9f8; color: #6c6596; font-size: 12px; }
          .footer-brand img { width: 32px; height: 32px; object-fit: contain; }

          @media print {
            body { background: #ffffff; }
            .page { max-width: none; margin: 0; padding: 48px 56px 64px; }
            .cover, .page, .footer-page { min-height: auto; }
            .report-section, .stat-card, .summary-item, .mini-card { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <!-- ===== COVER PAGE ===== -->
        <section class="cover">
          <div class="cover-inner">
            <div class="cover-top">
              <div class="cover-brand">
                <img src="${escapeHtml(logoSrc)}" alt="CliniMedia" />
                <div>
                  <div class="cover-brand-text">CliniMedia</div>
                  <div class="cover-brand-sub">Marketing Analytics</div>
                </div>
              </div>
              <div class="cover-period">${escapeHtml(coverDateRange)}</div>
            </div>

            <div>
              <h1 class="cover-title">MARKETING<br/>REPORT</h1>
              <div class="cover-subtitle">${escapeHtml(report.period.label)} — performance, reach, and growth across every channel we run for your clinic.</div>
              <div class="cover-clinic">${escapeHtml(report.clinic.name)}</div>
            </div>

            <div class="cover-bottom">
              <div class="cover-address">${escapeHtml(report.clinic.location || report.clinic.email || '')}</div>
              <div class="cover-year">${escapeHtml(String(endYear))}</div>
            </div>
          </div>
        </section>

        <!-- ===== OVERVIEW PAGE ===== -->
        <div class="page">
          <div class="overview-header">
            <div class="overview-kicker">01 · Overview</div>
            <h2 class="overview-title">Performance at a Glance</h2>
            <p class="overview-desc">Six headline metrics summarizing lead volume, phone activity, and AI reception across the ${escapeHtml(report.period.label.toLowerCase())} window. Each channel is broken down in detail on the pages that follow.</p>
            <div class="overview-meta">Reporting window: ${escapeHtml(coverDateRange)} · Generated ${escapeHtml(new Date(report.generatedAt).toLocaleDateString())}</div>
          </div>
          <div class="overview-grid">${overviewHtml}</div>

          ${sectionsHtml}
        </div>

        <!-- ===== FOOTER PAGE ===== -->
        <div class="footer-page page-break">
          <div class="footer-card">
            <div class="footer-kicker">Let's keep growing together</div>
            <div class="footer-title">${escapeHtml(report.clinic.name)}</div>
            ${websiteLine}
            ${emailLine}
            ${locationLine}
            <div class="footer-brand">
              <img src="${escapeHtml(logoSrc)}" alt="CliniMedia" />
              <span>Prepared by CliniMedia · ${escapeHtml(coverDateRange)}</span>
            </div>
          </div>
        </div>
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

      const printableHtml = buildPrintHtml(report, emailDraft, logo1);
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
              {overviewCards.map((card) => (
                <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{card.label}</div>
                  <div className={`mt-2 text-3xl font-bold ${card.accent}`}>
                    {formatMetricValue(report.overview[card.key as keyof typeof report.overview])}
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
