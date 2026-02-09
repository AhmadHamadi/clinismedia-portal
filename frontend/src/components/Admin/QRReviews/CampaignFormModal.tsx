import React, { useState, useEffect } from "react";
import { FaTimes, FaPlus, FaExternalLinkAlt, FaChevronDown, FaChevronRight } from "react-icons/fa";
import type { Campaign, CampaignFormData, ChipData } from "./QRReviewsLogic";
import type { Customer } from "./QRReviewsLogic";
import { DENTAL_CHIP_PRESETS, PRESET_KEYS } from "./dentalChipPresets";

interface Props {
  campaign: Campaign | null; // null = create mode
  customers: Customer[];
  saving: boolean;
  onSave: (data: CampaignFormData) => void;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  staff: "bg-blue-100 text-blue-700",
  clinic: "bg-green-100 text-green-700",
  process: "bg-purple-100 text-purple-700",
  provider: "bg-orange-100 text-orange-700",
  service: "bg-pink-100 text-pink-700",
};

const CampaignFormModal: React.FC<Props> = ({ campaign, customers, saving, onSave, onClose }) => {
  const [form, setForm] = useState<CampaignFormData>({
    customerId: "",
    slug: "",
    clinicName: "",
    googleReviewUrl: "",
    isActive: true,
    experienceHighlights: DENTAL_CHIP_PRESETS.family.chips.map(c => ({
      label: c.label,
      category: c.category,
      sentences: [...c.sentences],
    })),
    adminEmail: "",
    logoUrl: "",
  });

  const [expandedChip, setExpandedChip] = useState<number | null>(null);
  const [newChipLabel, setNewChipLabel] = useState("");
  const [newChipCategory, setNewChipCategory] = useState<ChipData["category"]>("staff");

  useEffect(() => {
    if (campaign) {
      setForm({
        customerId: campaign.customerId?._id || "",
        slug: campaign.slug,
        clinicName: campaign.clinicName,
        googleReviewUrl: campaign.googleReviewUrl,
        isActive: campaign.isActive,
        experienceHighlights: campaign.experienceHighlights?.length > 0
          ? campaign.experienceHighlights
          : DENTAL_CHIP_PRESETS.family.chips.map(c => ({
              label: c.label,
              category: c.category,
              sentences: [...c.sentences],
            })),
        adminEmail: campaign.adminEmail || "",
        logoUrl: campaign.logoUrl || "",
      });
    }
  }, [campaign]);

  // Auto-fill logo from selected customer
  useEffect(() => {
    if (form.customerId && !form.logoUrl) {
      const selected = customers.find((c) => c._id === form.customerId);
      if (selected?.customerSettings?.logoUrl) {
        setForm((prev) => ({ ...prev, logoUrl: selected.customerSettings!.logoUrl! }));
      }
    }
  }, [form.customerId]);

  // Auto-generate slug from clinic name
  useEffect(() => {
    if (!campaign && form.clinicName && !form.slug) {
      setForm((prev) => ({
        ...prev,
        slug: form.clinicName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      }));
    }
  }, [form.clinicName]);

  const applyPreset = (presetKey: string) => {
    const preset = DENTAL_CHIP_PRESETS[presetKey];
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      experienceHighlights: preset.chips.map(c => ({
        label: c.label,
        category: c.category,
        sentences: [...c.sentences],
      })),
    }));
    setExpandedChip(null);
  };

  const removeChip = (index: number) => {
    setForm((prev) => ({
      ...prev,
      experienceHighlights: prev.experienceHighlights.filter((_, i) => i !== index),
    }));
    if (expandedChip === index) setExpandedChip(null);
  };

  const addChip = () => {
    const label = newChipLabel.trim();
    if (!label) return;
    if (form.experienceHighlights.some(h => h.label === label)) return;
    setForm((prev) => ({
      ...prev,
      experienceHighlights: [
        ...prev.experienceHighlights,
        { label, category: newChipCategory, sentences: [] },
      ],
    }));
    setNewChipLabel("");
    // Expand the new chip so user can add sentences
    setExpandedChip(form.experienceHighlights.length);
  };

  const updateChipSentence = (chipIndex: number, sentenceIndex: number, value: string) => {
    setForm((prev) => {
      const chips = [...prev.experienceHighlights];
      const sentences = [...chips[chipIndex].sentences];
      sentences[sentenceIndex] = value;
      chips[chipIndex] = { ...chips[chipIndex], sentences };
      return { ...prev, experienceHighlights: chips };
    });
  };

  const addSentence = (chipIndex: number) => {
    setForm((prev) => {
      const chips = [...prev.experienceHighlights];
      chips[chipIndex] = {
        ...chips[chipIndex],
        sentences: [...chips[chipIndex].sentences, ""],
      };
      return { ...prev, experienceHighlights: chips };
    });
  };

  const removeSentence = (chipIndex: number, sentenceIndex: number) => {
    setForm((prev) => {
      const chips = [...prev.experienceHighlights];
      chips[chipIndex] = {
        ...chips[chipIndex],
        sentences: chips[chipIndex].sentences.filter((_, i) => i !== sentenceIndex),
      };
      return { ...prev, experienceHighlights: chips };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const previewUrl = `https://www.clinimediaportal.ca/r/${form.slug || "your-clinic"}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-[#303b45]">
            {campaign ? "Edit Campaign" : "Create Campaign"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Customer assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Customer</label>
            <select
              value={form.customerId}
              onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none text-sm text-black bg-white"
            >
              <option value="">-- No customer (admin-only) --</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>

          {/* Clinic name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clinic Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.clinicName}
              onChange={(e) => setForm((prev) => ({ ...prev, clinicName: e.target.value }))}
              required
              placeholder="e.g. Smile Dental Clinic"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none text-sm text-black"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 whitespace-nowrap">/r/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  }))
                }
                placeholder="auto-generated-from-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none text-sm text-black"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <FaExternalLinkAlt className="text-[10px]" /> {previewUrl}
            </p>
          </div>

          {/* Google Review URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Review URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={form.googleReviewUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, googleReviewUrl: e.target.value }))}
              required
              placeholder="https://g.page/r/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none text-sm text-black"
            />
          </div>

          {/* Admin Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Notification Email
            </label>
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
              placeholder="admin@clinic.com (for concern notifications)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none text-sm text-black"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Logo URL
            </label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none text-sm text-black"
            />
            {form.logoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="h-10 w-10 object-contain rounded border border-gray-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-xs text-gray-400">Preview</span>
              </div>
            )}
          </div>

          {/* Experience Chips */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Experience Chips
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Patients tap these to personalize their review. Each chip has sentence variants used by the AI.
            </p>

            {/* Preset Dropdown */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Apply a preset:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) applyPreset(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none"
              >
                <option value="" disabled>Select a dental preset...</option>
                {PRESET_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {DENTAL_CHIP_PRESETS[key].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chip list */}
            <div className="space-y-1 mb-3 max-h-64 overflow-y-auto">
              {form.experienceHighlights.map((chip, i) => (
                <div key={i} className="border border-gray-200 rounded-lg">
                  {/* Chip header row */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedChip(expandedChip === i ? null : i)}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                    >
                      {expandedChip === i ? <FaChevronDown /> : <FaChevronRight />}
                    </button>
                    <span className="text-sm text-black font-medium flex-1">{chip.label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${CATEGORY_COLORS[chip.category] || "bg-gray-100 text-gray-600"}`}>
                      {chip.category}
                    </span>
                    <span className="text-[10px] text-gray-400">{chip.sentences.length} sentences</span>
                    <button
                      type="button"
                      onClick={() => removeChip(i)}
                      className="text-gray-400 hover:text-red-500 text-xs"
                    >
                      <FaTimes />
                    </button>
                  </div>

                  {/* Expanded: show sentences */}
                  {expandedChip === i && (
                    <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-1.5">
                      {chip.sentences.map((s, si) => (
                        <div key={si} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={s}
                            onChange={(e) => updateChipSentence(i, si, e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs text-black focus:ring-1 focus:ring-[#98c6d5] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeSentence(i, si)}
                            className="text-gray-300 hover:text-red-500 text-[10px]"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addSentence(i)}
                        className="text-xs text-[#98c6d5] hover:text-[#7ab4c5] flex items-center gap-1"
                      >
                        <FaPlus className="text-[9px]" /> Add sentence
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add custom chip */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newChipLabel}
                onChange={(e) => setNewChipLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChip();
                  }
                }}
                placeholder="Custom chip label..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none"
              />
              <select
                value={newChipCategory}
                onChange={(e) => setNewChipCategory(e.target.value as ChipData["category"])}
                className="px-2 py-2 border border-gray-300 rounded-lg text-xs text-black bg-white focus:ring-2 focus:ring-[#98c6d5] outline-none"
              >
                <option value="staff">staff</option>
                <option value="clinic">clinic</option>
                <option value="process">process</option>
                <option value="provider">provider</option>
                <option value="service">service</option>
              </select>
              <button
                type="button"
                onClick={addChip}
                className="px-3 py-2 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7ab4c5] transition-colors text-sm"
              >
                <FaPlus />
              </button>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#98c6d5] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#98c6d5]"></div>
            </label>
            <span className="text-sm text-gray-700">Campaign Active</span>
          </div>

          {/* Live Preview */}
          <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Live Preview</p>
            <div className="bg-white rounded-xl shadow-sm p-4 max-w-xs mx-auto">
              {form.logoUrl && (
                <img
                  src={form.logoUrl}
                  alt="Logo"
                  className="h-12 w-auto object-contain mx-auto mb-2"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <h3 className="text-lg font-bold text-[#303b45] text-center">
                {form.clinicName || "Clinic Name"}
              </h3>
              <p className="text-gray-500 text-xs text-center mt-1">What stood out about your visit?</p>
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {form.experienceHighlights.slice(0, 6).map((h, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-full text-[10px] text-gray-600">
                    {h.label}
                  </span>
                ))}
                {form.experienceHighlights.length > 6 && (
                  <span className="text-[10px] text-gray-400">+{form.experienceHighlights.length - 6} more</span>
                )}
              </div>
              <div className="h-10 bg-[#98c6d5] rounded-lg opacity-80 mt-3"></div>
              <p className="text-[10px] text-gray-300 text-center mt-3">Powered by CliniMedia</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.clinicName || !form.googleReviewUrl}
              className="px-6 py-2 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7ab4c5] transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : campaign ? "Update Campaign" : "Create Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampaignFormModal;
