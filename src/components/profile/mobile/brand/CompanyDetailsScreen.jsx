import React, { useState, useRef, useEffect } from "react";
import LogoCropper from "../../../common/LogoCropper";
import { safeLower } from "../../../../utils/safeFormat";
import { Building, ChevronDown, Camera, Check, MapPin, Plus } from "lucide-react";
import {
  MobileScreen, Section, Field, TextInput, TextArea, Chip, PrimaryButton, Pill,
} from "./brandMobileUi";
import { INDUSTRY_OPTIONS, TEAM_SIZES, aliasPref } from "./useBrandProfileData";
import { searchLocations } from "@/lib/locations";
import { AGENCY_TYPES } from "../../../../constants/agencyTypes";
import { checkHttpUrl } from "../../../../utils/httpUrl";
import { api } from "../../../../lib/api"; // v416
import { toast } from "sonner";
import { useLeaveGuard } from "../../../../lib/popupRules"; // v456
import { currentPosition } from "../../../explore/nearby/LocationScreens"; // v451


// Screen 1c — editable company fields. Writes through the same POST brands/profile
// payload BrandSettings.jsx uses, so desktop and mobile edit the same row.

export default function CompanyDetailsScreen({ onBack, profile, saving, onSave, uploadImage, loadFailed = false, onRetry }) {
  const [form, setForm] = useState(() => ({ ...profile, industry: aliasPref("industry", profile?.industry) })); // v358: "Food" from onboarding = the "D2C food" chip
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [agencyType, setAgencyType] = useState(profile?.agency_type || "");
  const [uploading, setUploading] = useState(null);
  const logoInput = useRef(null);
  const coverInput = useRef(null);

  // Location search state
  const [locQuery, setLocQuery] = useState(profile?.location || "");
  const [locSuggestions, setLocSuggestions] = useState([]);
  const [locDropdownOpen, setLocDropdownOpen] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const locContainerRef = useRef(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // v346: a name of only spaces and a "javascript:" / non-web website were saved as they were.
  const [tried, setTried] = useState(false);
  const nameError = !String(form?.company_name || "").trim() ? "Enter your company name." : "";
  const websiteCheck = checkHttpUrl(form?.website, { label: "Website" });
  const saveChecked = () => {
    setTried(true);
    if (nameError || !websiteCheck.ok) {
      // v415: the error can sit above the fold — bring the first one into view instead of a silent no-op
      setTimeout(() => {
        const el = document.getElementById(nameError ? "brand-company-name" : "brand-company-website");
        try { el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); } catch { /* old browser */ }
      }, 0);
      return;
    }
    onSave({ ...form, company_name: String(form.company_name || "").trim(), website: websiteCheck.url });
  };

  // Keep locQuery in sync if form.location changes externally
  useEffect(() => {
    if (form.location && form.location !== locQuery && !locDropdownOpen) {
      setLocQuery(form.location);
    }
  }, [form.location]);

  // City / Location search: searchLocations local + /api/locations/search debounced
  useEffect(() => {
    const q = (locQuery || "").trim();
    if (!q) {
      setLocSuggestions(searchLocations("", 8));
      return;
    }
    const localMatches = searchLocations(q, 10);
    setLocSuggestions(localMatches);

    let stale = false; // v416: a slow answer for "Ja" must not overwrite "Jaipur"; api helper works inside the app too
    const timer = setTimeout(async () => {
      try {
        setLocLoading(true);
        const { data } = await api.get(`locations/search?q=${encodeURIComponent(q)}&limit=12`);
        if (!stale) {
          if (Array.isArray(data) && data.length > 0) {
            const combined = [...localMatches];
            data.forEach((item) => {
              if (item && item.name && !combined.some((c) => safeLower(c.name) === safeLower(item.name))) {
                combined.push(item);
              }
            });
            setLocSuggestions(combined.slice(0, 15));
          }
        }
      } catch (e) {
        // Fallback gracefully to local matches
      } finally {
        setLocLoading(false);
      }
    }, 120);

    return () => { stale = true; clearTimeout(timer); }; // v416
  }, [locQuery]);

  // Click outside listener for location dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locContainerRef.current && !locContainerRef.current.contains(e.target)) {
        setLocDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleSelectLocation = (loc) => {
    const formatted = loc.display?.includes(",")
      ? loc.display
      : loc.state && loc.state !== loc.name
      ? `${loc.name}, ${loc.state}`
      : loc.name;
    set("location", formatted);
    setLocQuery(formatted);
    setLocDropdownOpen(false);
  };

  // v283: logo → adjust (LogoCropper) → upload.
  const [cropFile, setCropFile] = useState(null);
  const handleUpload = async (kind, file) => {
    if (uploading) return; // v415: one upload at a time (logo + cover at once raced the same save)
    setUploading(kind);
    let url = null;
    try { url = await uploadImage(file); } finally { setUploading(null); } // v415: never stuck on "Uploading…"
    if (url) {
      set(kind === "logo" ? "logo" : "cover", url);
      // v358: saved right away — "Uploaded." + Back used to lose the new logo / cover (only Save changes saved it)
      await onSave?.({ [kind === "logo" ? "logo" : "cover"]: url }, { silent: true });
    }
  };

  const handleClaimAgency = async () => {
    if (!agencyType) return;
    const ok = await onSave({ is_agency: true, agency_type: agencyType });
    if (ok) {
      set("is_agency", true);
      set("agency_type", agencyType);
      setAgencyOpen(false);
    }
  };

  // v415: compare with the same "Food → D2C food" reading the form starts from, so Save isn't lit on open
  const dirty = JSON.stringify(form) !== JSON.stringify({ ...profile, industry: aliasPref("industry", profile?.industry) });
  useLeaveGuard(Boolean(dirty && !loadFailed && !saving)); // v456 (Back review): phone Back asks before dropping the edits
  const [logoBroken, setLogoBroken] = useState(false); // v415: dead logo / cover links fall back cleanly
  const [coverBroken, setCoverBroken] = useState(false);

  const checks = [["Add your logo", form.logo], ["Add your brand name", String(form.company_name || "").trim()], ["Pick an industry", form.industry], ["Add your city", form.location], ["Add your website", String(form.website || "").trim()], ["Pick team size", form.teamSize], ["Write a line about you", String(form.description || "").trim()]];
  const missing = checks.filter(([, v]) => !v).map(([t]) => t);
  const donePct = Math.round(((checks.length - missing.length) / checks.length) * 100);
  const [geoBusy, setGeoBusy] = useState(false);
  const useMyLocation = async () => {
    if (geoBusy) return;
    setGeoBusy(true);
    try {
      const pos = await currentPosition();
      const { data } = await api.get(`geo/reverse?lat=${pos.lat}&lng=${pos.lng}`);
      const city = data?.place?.city || data?.place?.label || "";
      if (city) { setLocQuery(city); set("location", city); setLocDropdownOpen(false); }
      else toast.error("Couldn't find your city — type it instead.");
    } catch { toast.error("Location is off. Turn it on, or type your city."); }
    finally { setGeoBusy(false); }
  };
  const brandInitial = form.company_name?.trim()
    ? form.company_name.trim().charAt(0).toUpperCase()
    : "B";

  return (
    <MobileScreen
      title="Company details"
      onBack={onBack}
      footer={
        <PrimaryButton disabled={saving || !dirty || loadFailed || Boolean(uploading)} busy={saving} onClick={saveChecked}>
          {saving ? "Saving…" : "Save changes"}
        </PrimaryButton>
      }
    >
      {loadFailed && (
        <div role="alert" className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 flex items-center justify-between gap-3">
          <span>We couldn't load your company details, so editing is paused.</span>{/* v415: no empty form that looks real */}
          {onRetry && <button type="button" onClick={onRetry} className="h-10 px-3 rounded-xl bg-white border border-amber-200 text-amber-800 font-bold shrink-0">Try again</button>}
        </div>
      )}
      {/* v451 (BRD §26): live preview (updates as you type) + how complete the profile is */}
      <div className="px-4 pt-4" data-testid="company-preview">
        <div className="flex items-center justify-between text-[12px] font-semibold text-[#5F6672]"><span>Profile {donePct}% done</span>{donePct < 100 && <span className="text-[#7C3AED]">{missing[0]}</span>}</div>
        <div className="mt-1.5 h-1.5 rounded-full bg-[#EDE9FE] overflow-hidden"><div className="h-full rounded-full bg-[#7C3AED] transition-all duration-300" style={{ width: `${donePct}%` }} /></div>
        <div className="mt-3 bg-white rounded-[20px] border border-[#ECECF0] p-3.5 flex gap-3 items-start">
          <div className="w-12 h-12 rounded-xl bg-[#F1EBFE] text-[#6D28D9] font-bold text-lg flex items-center justify-center overflow-hidden shrink-0">
            {form.logo && !logoBroken ? <img src={form.logo} alt="" className="w-full h-full object-cover" onError={() => setLogoBroken(true)} /> : brandInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-[#0A0A0A] truncate">{form.company_name || "Your brand name"}</div>
            <div className="text-[12px] text-[#5F6672] truncate">{[form.industry, form.location].filter(Boolean).join(" · ") || "Industry · City"}</div>
            <div className="mt-1 text-[12.5px] text-[#3D3A4D] line-clamp-2">{form.description || "A line about your brand shows here."}</div>
          </div>
        </div>
      </div>
      <Section>{/* v450 (BRD §13): no helper line under the header */}
        {/* Integrated Profile Banner & Logo Studio */}
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all">
          {/* Cover Banner with camera pill button */}
          <div className="relative h-32 w-full bg-gradient-to-r from-[#2E1A68] via-[#3B1E7E] to-[#582A9C] overflow-hidden group">
            {form.cover && !coverBroken && (
              <img
                src={form.cover}
                alt="" /* v415: decorative — the button below says what it does */
                onError={() => setCoverBroken(true)}
                className="w-full h-full object-cover"
              />
            )}

            {/* Subtle gradient vignette for contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25 pointer-events-none" />

            {/* Change cover pill button (matching Screenshot 2 top-right style) */}
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={Boolean(uploading)}
              aria-label={form.cover ? "Change cover image" : "Add cover image"} // v415
              className="absolute top-3 right-3 h-10 px-3.5 rounded-full bg-white/95 hover:bg-white text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-md backdrop-blur-xs transition-all active:scale-95 cursor-pointer z-10 disabled:opacity-75"
            >
              <Camera size={13} className="text-slate-700" />
              <span>{uploading === "cover" ? "Uploading…" : "Cover"}</span>
            </button>

            {uploading === "cover" && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-xs z-20">
                <div className="flex items-center gap-2 bg-white/95 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-900 shadow-lg">
                  <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#7C3AED] rounded-full animate-spin" />
                  Updating cover…
                </div>
              </div>
            )}
          </div>

          {/* Overlapping Brand Logo Avatar & Info Row */}
          <div className="px-4 pb-4">
            <div className="flex items-end justify-between -mt-10 mb-2.5">
              {/* Avatar Squircle */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  disabled={Boolean(uploading)}
                  className="w-20 h-20 rounded-[20px] border-4 border-white dark:border-slate-900 bg-white dark:bg-slate-800 shadow-lg overflow-hidden flex items-center justify-center text-2xl font-black text-slate-900 dark:text-white relative cursor-pointer active:scale-95 transition-all group"
                  title="Tap to change logo"
                  aria-label={form.logo ? "Change logo" : "Upload logo"} // v332
                >
                  {form.logo && !logoBroken ? (
                    <img src={form.logo} alt="" onError={() => setLogoBroken(true)} className="w-full h-full object-cover" />
                  ) : form.company_name?.trim() ? (
                    brandInitial
                  ) : (
                    <Building size={26} className="text-slate-300" />
                  )}

                  {/* Dark hover overlay */}
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera size={20} className="text-white drop-shadow-sm" />
                  </div>

                  {uploading === "logo" && (
                    <div className="absolute inset-0 bg-white/85 dark:bg-slate-900/85 flex items-center justify-center z-10">
                      <span className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#7C3AED] animate-spin" />
                    </div>
                  )}
                </button>

                {/* Floating camera badge on corner */}
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  disabled={Boolean(uploading)}
                  aria-hidden="true" tabIndex={-1} // v415: duplicate of the logo button (one tab stop, one label)
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 cursor-pointer active:scale-90 transition-transform"
                  title="Change logo"
                >
                  <Camera size={11} strokeWidth={2.5} />
                </button>
              </div>

              {/* Logo guidance label */}
              <div className="text-right pb-1">
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  disabled={Boolean(uploading)} // v415: no second upload while one is running
                  className="min-h-[40px] text-xs font-bold text-[#7C3AED] hover:text-[#6D28D9] cursor-pointer disabled:opacity-60"
                >
                  {uploading === "logo" ? "Uploading…" : form.logo ? "Change logo" : "Upload logo"}
                </button>
                <div className="text-[10.5px] text-[#5F6672] mt-0.5 font-medium">1:1 square recommended</div>
              </div>
            </div>

            {/* Hint footer */}
            <div className="text-[11.5px] text-[#5F6672] flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1">
                Tap Cover or your logo to update how creators see you{/* v332: tapping the banner itself did nothing */}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6672] shrink-0">Live preview</span>
            </div>
          </div>

          <input
            ref={logoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCropFile(f); }}
          />
          <LogoCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={(f) => { setCropFile(null); handleUpload("logo", f); }} />
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            // v332: clear the picker so choosing the same photo again after a failed upload still works
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleUpload("cover", f); }}
          />
        </div>

        {/* Agency accordion — collapsed by default, per the mockup's dev note */}
        <div className="mt-4 rounded-2xl bg-[#F5F0FF]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setAgencyOpen((v) => !v)}
            aria-expanded={agencyOpen} // v415
            className="w-full px-4 py-3.5 flex items-center gap-2 text-left cursor-pointer"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Are you an agency?</span>
                {form.is_agency ? <Pill tone="violet"><Check size={10} strokeWidth={3} /> Claimed</Pill> : <Pill tone="violet">New</Pill> /* v415: violet, red read like an error */}
              </div>
              <p className="text-xs text-violet-900/80 mt-1">
                {form.is_agency
                  ? `Showing as ${form.agency_type || "an agency"} on your briefs and chats.`
                  : "Show a public Agency badge to creators across campaigns, chats and profile views."}
              </p>
            </div>
            <ChevronDown
              size={16}
              className={`text-[#7C3AED] flex-shrink-0 transition-transform ${agencyOpen ? "rotate-180" : ""}`}
            />
          </button>

          {agencyOpen && !form.is_agency && (
            <div className="px-4 pb-4 space-y-2">
              {AGENCY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={agencyType === t} // v415
                  onClick={() => setAgencyType(t)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition ${
                    agencyType === t
                      ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                      : "bg-white text-gray-700 border-[#DDD6FE]"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClaimAgency}
                disabled={!agencyType || saving || loadFailed}
                aria-busy={saving || undefined} // v415
                className="w-full h-11 mt-1 rounded-xl bg-[#7C3AED] text-white font-bold text-sm disabled:opacity-50"
              >
                {saving ? "Claiming…" : "Claim agency status"}
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section className="pt-0">
        <Field label="Company name">
          <TextInput
            id="brand-company-name" // v415: Save scrolls here when the name is missing
            aria-invalid={Boolean(tried && nameError) || undefined}
            value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            placeholder="Your registered brand name"
          />
          {tried && nameError && <p className="mt-1 text-[12px] font-semibold text-red-600" role="alert">{nameError}</p>}
        </Field>

        {/* v451 (BRD §26): industry = search with suggestions; not listed → "Add '<typed>'" */}
        <Field group label="Industry">
          <IndustryPicker value={form.industry} onChange={(v) => set("industry", v)} />
        </Field>

        {/* Headquarters with Location Search & Autocomplete API */}
        <Field group /* v415 */ label="Headquarters" hint="City, state — shown on your public profile.">
          <div ref={locContainerRef} className="relative">
            <div className="relative">
              <input
                type="text"
                value={locQuery}
                onChange={(e) => {
                  setLocQuery(e.target.value);
                  set("location", e.target.value);
                  setLocDropdownOpen(true);
                }}
                onFocus={() => setLocDropdownOpen(true)}
                onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setLocDropdownOpen(false); } }} // v415
                aria-expanded={locDropdownOpen}
                autoComplete="off"
                placeholder="Search city, e.g. New Delhi, Mumbai, Bengaluru"
                aria-label="Headquarters city" // v332: label + 16px text (iPhone zoomed at 14px)
                className="w-full h-11 px-3.5 pl-10 rounded-xl bg-[var(--bg-elevated)] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all"
              />
              <MapPin
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C3AED] pointer-events-none"
              />
              {locLoading && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#7C3AED] rounded-full animate-spin inline-block" />
                </div>
              )}
            </div>

            <button type="button" onClick={useMyLocation} disabled={geoBusy} data-testid="company-use-location"
              className="mt-2 h-9 px-3 rounded-full bg-[#F5F0FF] text-[#7C3AED] text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
              <MapPin size={13} /> {geoBusy ? "Finding you…" : "Use my current location"}
            </button>
            {/* Location Autocomplete Suggestions Dropdown */}
            {locDropdownOpen && (
              <div className="yb-reveal absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_12px_32px_rgba(0,0,0,0.15)] max-h-60 overflow-y-auto z-50 p-1.5">
                {locSuggestions.map((loc, idx) => (
                  <button
                    key={`${loc.name}-${idx}`}
                    type="button"
                    onClick={() => handleSelectLocation(loc)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F5F0FF] dark:hover:bg-purple-950/40 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#F5F0FF] dark:bg-purple-950/60 text-[#7C3AED] flex items-center justify-center shrink-0 transition-transform">
                        <MapPin size={13} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {loc.name}
                        </div>
                        {loc.state && loc.state !== loc.name && (
                          <div className="text-[11px] text-[#5F6672] truncate">
                            {loc.state}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold shrink-0">
                      {loc.type || "City"}
                    </span>
                  </button>
                ))}

                {locQuery.trim() && !locSuggestions.some((c) => safeLower(c.name) === locQuery.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => {
                      set("location", locQuery.trim());
                      setLocDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-[#F5F0FF]/50 hover:bg-[#F5F0FF] text-[#7C3AED] transition-colors flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 mt-1 cursor-pointer font-semibold text-xs"
                  >
                    <Plus size={14} />
                    <span className="min-w-0 truncate">Use &ldquo;{locQuery.trim()}&rdquo; as headquarters</span>{/* v415: long text truncates, sentence case */}
                  </button>
                )}
              </div>
            )}
          </div>
        </Field>

        {/* v423 (S1): the contact email can receive contract-signing codes, so it is changed only on the Contact screen,
            which checks a code first. Here it is shown, not edited (a free edit made every save of this screen fail). */}
        <Field label="Contact email" hint="To change it, go to Account → Contact — we'll send a code to the new email.">
          <TextInput
            value={form.pocEmail}
            readOnly
            aria-readonly="true"
            placeholder="poc@yourbrand.com"
            inputMode="email"
            type="email"
            autoCapitalize="none" // v332: no auto-capital first letter in emails / links
          />
        </Field>
        <Field label="Website">
          <TextInput
            id="brand-company-website" // v415
            aria-invalid={Boolean((tried || /^[a-z][a-z0-9+.-]*:/i.test(String(form?.website || "").trim())) && !websiteCheck.ok) || undefined}
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://yourbrand.com"
            inputMode="url"
            autoCapitalize="none"
          />
          {(tried || /^[a-z][a-z0-9+.-]*:/i.test(String(form?.website || "").trim())) && !websiteCheck.ok && (
            <p className="mt-1 text-[12px] font-semibold text-red-600" role="alert">{websiteCheck.error}</p>
          )}
        </Field>

        <Field group label="Team size">
          {/* v451 (BRD §26): segmented toggle */}
          <div className="grid grid-cols-4 bg-[#EEEEF2] p-[3px] rounded-xl" role="radiogroup" aria-label="Team size">
            {TEAM_SIZES.map((opt) => (
              <button key={opt} type="button" role="radio" aria-checked={form.teamSize === opt} onClick={() => set("teamSize", opt)}
                className={`h-10 rounded-[10px] text-[13px] font-semibold transition-colors ${form.teamSize === opt ? "bg-white text-[#0A0A0A] shadow-[0_1px_3px_rgba(16,16,20,.12)]" : "text-[#5F6672]"}`}>
                {opt.replace(" Employees", "")}
              </button>
            ))}
          </div>
        </Field>

        <Field label="About" hint={`${String(form.description || "").length}/500 · Creators read this before accepting a brief.`}>
          <TextArea
            rows={5}
            maxLength={500}
            value={form.description}
            onChange={(e) => set("description", e.target.value.slice(0, 500))}
            placeholder="What you sell, who you sell to, and how you like to work with creators."
          />
        </Field>
      </Section>
    </MobileScreen>
  );
}

/** v451 (BRD §26): industry search — suggestions as you type, or "Add '<typed>'" when it isn't listed. */
const MORE_INDUSTRIES = ["Retail", "D2C", "Food & beverage", "Restaurant / Café", "Salon / Clinic", "Health & wellness", "Education", "Finance", "Real estate", "Automobile", "Electronics", "Home & decor", "Jewellery", "Kids & baby", "Pets", "Sports", "Entertainment", "Media", "Agency", "App / SaaS", "Hospitality", "Events"];
function IndustryPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const all = Array.from(new Set([...INDUSTRY_OPTIONS, ...MORE_INDUSTRIES]));
  const term = q.trim().toLowerCase();
  const list = term ? all.filter((x) => x.toLowerCase().includes(term)).slice(0, 8) : INDUSTRY_OPTIONS;
  const exact = all.some((x) => x.toLowerCase() === term);
  return (
    <div>
      {value && (
        <div className="mb-2 inline-flex items-center gap-1.5 h-9 pl-3 pr-1 rounded-xl bg-[#F1EBFE] border border-[#C4B5FD] text-[#5B21B6] text-[13px] font-semibold">
          <Check size={13} strokeWidth={2.6} />{value}
          <button type="button" aria-label="Clear industry" onClick={() => onChange("")} className="p-1.5 text-[#7C3AED]">×</button>
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder="Search industry, e.g. Beauty" aria-label="Search industry" data-testid="industry-search"
        className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-slate-200 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#7C3AED]" />
      <div className="mt-2 flex flex-wrap gap-2">
        {list.map((opt) => (
          <button key={opt} type="button" onClick={() => { onChange(opt); setQ(""); }}
            className={`h-9 px-3 rounded-xl border text-[13px] font-semibold ${value === opt ? "bg-[#F1EBFE] border-[#C4B5FD] text-[#5B21B6]" : "bg-white border-[#E5E5EA] text-[#0A0A0A]"}`}>{opt}</button>
        ))}
        {term && !exact && (
          <button type="button" onClick={() => { onChange(q.trim()); setQ(""); }} data-testid="industry-add"
            className="h-9 px-3 rounded-xl border border-dashed border-[#C4B5FD] text-[13px] font-semibold text-[#7C3AED]">+ Add &ldquo;{q.trim()}&rdquo;</button>
        )}
      </div>
    </div>
  );
}
