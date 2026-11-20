// v450 (Ravi's BRD EL-05 map + EL-07 opening animation).
// First open ever: satellite globe spins to India → zooms into the brand's radius → radar pulse → creator pins pop in
// nearest-first → the chrome slides in (≈8 s, tap to skip). Every later open: a short zoom, then radar + pins.
// Pins sit on the creator's city centre (never a home address); pins closer than ~44 px merge into "+N".
import React, { useEffect, useMemo, useRef, useState } from "react";
import { List, LocateFixed, ChevronDown, Info, Plus, Minus } from "lucide-react";
import useBackToClose from "../../../lib/popupRules";
import SlippyMap, { TILE_LIGHT, TILE_SAT } from "./SlippyMap";
import { RADII, ZOOM_FOR_RADIUS, kmToPx, clusterPins, distanceLabel, shortNum, titleCase } from "./nearbyLogic";
import { RATES_PUBLIC } from "../../../utils/rateCardQuote";
import { initials as initialsOf } from "../../../utils/initials";

const P = "#7C3AED";
const photoOf = (c) => c?.photo || c?.profile_photo_url || c?.picture || c?.avatar_url || "";
const nameOf = (c) => String(c?.full_name || c?.name || "").trim();
const idOf = (c) => c?.user_id || c?.id;
const followersOf = (c) => Number(String(c?.followers_count || c?.follower_count || c?.followers_instagram || 0).replace(/[^0-9.]/g, "")) || 0;
const nicheOf = (c) => String(c?.category || (Array.isArray(c?.content_niches) ? c.content_niches[0] : String(c?.content_niches || "").split(",")[0]) || "").split(/\s*[,|/;&]\s*/)[0].trim();
const rateOf = (c) => Number(c?.rate_reel || c?.reel_rate || c?.rate_card?.reels || c?.rate_card?.reel || 0) || 0;
const TINTS = ["#C4B5FD", "#FBCFE8", "#A7F3D0", "#FDE68A", "#BFDBFE", "#FECACA"];
const tint = (id) => TINTS[String(id || "").split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % TINTS.length];

function reduceMotion() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } }

function PinFace({ c, size = 40 }) {
  const [bad, setBad] = useState(false);
  const src = bad ? "" : photoOf(c);
  return src
    ? <img src={src} alt="" onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", background: tint(idOf(c)), color: "#1F1147", fontSize: size / 3, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{initialsOf(nameOf(c))}</span>;
}

export default function NearbyMapView({ branch, creators, radius, setRadius, counts, firstOpen: firstOpenProp, onIntroSeen, onList, onOpenCreator, onChangeLocation }) {
  const rm = reduceMotion();
  // v455: decided once when the map opens — the flag is saved half-way through the intro, which flipped this mid-animation
  const [firstOpen] = useState(Boolean(firstOpenProp));
  useBackToClose(true, onList); // v455: phone Back closes the map (it used to leave Explore)
  const [stage, setStage] = useState(firstOpen && !rm ? "globe" : "zoom"); // globe → zoom → radar → ready
  const [zoomAdj, setZoomAdj] = useState(0);
  const [center, setCenter] = useState({ lat: branch.lat, lng: branch.lng });
  const [active, setActive] = useState(0);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [replay, setReplay] = useState(0);
  const car = useRef(null);
  const timers = useRef([]);
  const introSaved = useRef(false); // v455: "intro seen" was saved again on every radius change
  const z = (ZOOM_FOR_RADIUS[radius] || 10) + zoomAdj;
  const list = creators || [];

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (stage === "globe") { later(() => setStage("zoom"), 2400); }
    else if (stage === "zoom") { later(() => setStage("radar"), firstOpen && !rm ? 1300 : rm ? 0 : 450); }
    else if (stage === "radar") { later(() => setStage("ready"), rm ? 0 : 1200); if (firstOpen && !introSaved.current) { introSaved.current = true; onIntroSeen?.(); } }
    return () => { timers.current.forEach(clearTimeout); };
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  // radius change → replay radar + pins (BRD)
  useEffect(() => { if (stage === "ready") { setZoomAdj(0); setCenter({ lat: branch.lat, lng: branch.lng }); setStage("radar"); setReplay((r) => r + 1); } }, [radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => { if (stage === "globe" || stage === "zoom") { if (firstOpen && !introSaved.current) { introSaved.current = true; onIntroSeen?.(); } setStage("radar"); } };
  const goTo = (i) => {
    setActive(i);
    const c = list[i]; if (c) setCenter({ lat: c.__pt.pinLat, lng: c.__pt.pinLng });
  };
  const onCarScroll = (e) => {
    const el = e.currentTarget; const w = el.firstElementChild?.offsetWidth || 1;
    const i = Math.round(el.scrollLeft / (w + 10));
    if (i !== active && list[i]) { setActive(i); setCenter({ lat: list[i].__pt.pinLat, lng: list[i].__pt.pinLng }); }
  };
  const scrollCarTo = (i) => { const el = car.current; const w = el?.firstElementChild?.offsetWidth || 0; el?.scrollTo({ left: i * (w + 10), behavior: "smooth" }); goTo(i); };
  // v455: after a drag the parent centre is synced (onMoveEnd), so Recenter really moves back to the branch
  const recenter = () => { setZoomAdj(0); setCenter({ lat: branch.lat, lng: branch.lng }); };
  const zoomBy = (d) => setZoomAdj((a) => Math.max(-3, Math.min(6, a + d)));

  const showPins = stage === "radar" || stage === "ready";
  const chrome = stage === "ready" || (stage === "radar" && !firstOpen);
  const [scaled, setScaled] = useState(rm);
  useEffect(() => { if (stage !== "globe" && !scaled) { const r = requestAnimationFrame(() => requestAnimationFrame(() => setScaled(true))); return () => cancelAnimationFrame(r); } return undefined; }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const mapScale = scaled ? 1 : firstOpen && !rm ? 0.16 : 0.6;

  return (
    <div role="dialog" aria-modal="true" aria-label="Creators near you" className="yb-fade fixed inset-0 z-[70] bg-[#EDEDF1]" style={{ fontFamily: "'DM Sans',sans-serif" }} data-testid="nearby-map" onClick={skip}>
      <style>{`
        @keyframes ybRadar{from{transform:translate(-50%,-50%) scale(.05);opacity:.9}to{transform:translate(-50%,-50%) scale(1);opacity:0}}
        @keyframes ybPop{0%{transform:translate(-50%,-50%) scale(0)}70%{transform:translate(-50%,-50%) scale(1.12)}100%{transform:translate(-50%,-50%) scale(1)}}
        @keyframes ybGlobeIn{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.04);opacity:1}100%{transform:scale(1);opacity:1}}
        @keyframes ybGlobeSpin{from{background-position-x:0}to{background-position-x:-${Math.round(520 * 0.717 - 130)}px}}
        @keyframes ybGlobeOut{to{transform:scale(7);opacity:0}}
        @keyframes ybSlideDown{from{transform:translateY(-16px);opacity:0}to{transform:none;opacity:1}}
        @keyframes ybSlideUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
      `}</style>

      {/* the map */}
      <div className="absolute inset-0" style={{ transform: `scale(${mapScale})`, opacity: stage === "globe" ? 0 : 1, transition: `transform ${firstOpen ? 1.3 : 0.45}s cubic-bezier(.65,0,.35,1), opacity .5s` }}>
        <SlippyMap center={center} zoom={z} tiles={TILE_LIGHT} draggable={stage === "ready"} onMoveEnd={(c) => setCenter(c)} className="absolute inset-0" testId="nearby-slippy">
          {(proj, { zoom }) => {
            const b = proj(branch.lat, branch.lng);
            const ring = kmToPx(radius, branch.lat, zoom) * 2;
            const pins = clusterPins(list.map((c) => { const p = proj(c.__pt.pinLat, c.__pt.pinLng); return { id: idOf(c), x: p.x, y: p.y, item: c }; }), 44);
            return (
              <>
                <div style={{ position: "absolute", left: b.x, top: b.y, width: ring, height: ring, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "rgba(124,58,237,.07)", border: "1.5px dashed rgba(124,58,237,.45)" }} />
                {stage === "radar" && <div key={`r${replay}`} style={{ position: "absolute", left: b.x, top: b.y, width: ring, height: ring, borderRadius: "50%", border: "3px solid rgba(124,58,237,.55)", animation: "ybRadar 1.2s ease-out forwards" }} />}
                <div style={{ position: "absolute", left: b.x, top: b.y, transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: "50%", background: P, border: "3px solid #fff", boxShadow: "0 0 0 8px rgba(124,58,237,.15)" }} title={branch.name} />
                {showPins && pins.map((p, i) => {
                  const idx = list.findIndex((c) => idOf(c) === p.id);
                  const on = list[active] && p.items.some((c) => idOf(c) === idOf(list[active]));
                  return (
                    <button key={`${p.id}-${replay}`} type="button" aria-label={p.n > 1 ? `${p.n} creators` : nameOf(p.items[0])}
                      onClick={(e) => { e.stopPropagation(); if (p.n > 1) { setCenter({ lat: p.items[0].__pt.pinLat, lng: p.items[0].__pt.pinLng }); setZoomAdj((a) => Math.min(a + 1, 6)); } else scrollCarTo(idx); }}
                      style={{ position: "absolute", left: p.x, top: p.y, padding: 0, border: `2.5px solid ${on ? P : "#fff"}`, borderRadius: "50%", background: "#fff", boxShadow: "0 6px 14px -6px rgba(20,10,60,.5)", transform: "translate(-50%,-50%) scale(0)", animation: `ybPop .42s ${rm ? 0 : Math.min(i, 30) * 0.06}s cubic-bezier(.2,.9,.3,1.2) forwards`, zIndex: on ? 3 : 2 }}>
                      <PinFace c={p.items[0]} size={on ? 46 : 40} />
                      {p.n > 1 && <span style={{ position: "absolute", right: -8, top: -6, minWidth: 22, height: 20, padding: "0 5px", borderRadius: 10, background: "#0A0A0A", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+{p.n - 1}</span>}
                    </button>
                  );
                })}
              </>
            );
          }}
        </SlippyMap>
      </div>

      {/* EL-07: globe (first open only) */}
      {stage === "globe" && (
        <div className="absolute inset-0 bg-white flex flex-col items-center justify-center" data-testid="map-globe">
          <div style={{ width: 260, height: 260, borderRadius: "50%", backgroundColor: "#1D4E89", backgroundImage: `url(${TILE_SAT(0, 0, 0)}), radial-gradient(circle at 35% 35%, #3B7DD8, #0B2D5C)`, backgroundSize: "520px 260px, 100% 100%", backgroundRepeat: "repeat-x, no-repeat", boxShadow: "inset -30px -20px 60px rgba(0,0,0,.55), inset 12px 10px 30px rgba(255,255,255,.18), 0 30px 60px -30px rgba(40,20,90,.5)", animation: "ybGlobeIn 1.1s ease-out both, ybGlobeSpin 2.2s .3s cubic-bezier(.4,0,.2,1) forwards" }} />
          <div className="mt-6 text-[14px] font-semibold text-[#4B4560]" style={{ animation: "ybSlideUp .6s .4s both" }}>Finding creators near {branch.area || branch.name}</div>
        </div>
      )}
      {stage === "zoom" && firstOpen && !rm && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div style={{ width: 260, height: 260, borderRadius: "50%", backgroundImage: `url(${TILE_SAT(0, 0, 0)})`, backgroundSize: "520px 260px", backgroundPositionX: `-${Math.round(520 * 0.717 - 130)}px`, animation: "ybGlobeOut 1.3s cubic-bezier(.65,0,.35,1) forwards" }} />
        </div>
      )}

      {/* chrome */}
      {chrome && (
        <>
          <div className="absolute left-0 right-0 top-0 px-3 flex flex-col gap-2" style={{ paddingTop: "calc(10px + env(safe-area-inset-top, 0px))", animation: rm ? "none" : "ybSlideDown .4s both" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2">
              <button type="button" onClick={onChangeLocation} className="flex-1 min-w-0 h-12 rounded-2xl bg-white shadow-md px-3.5 flex items-center gap-2 text-left" data-testid="map-location-chip">
                <svg width="12" height="15" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 0C7.6 0 0 7.4 0 16.6 0 29 17 44 17 44s17-15 17-27.4C34 7.4 26.4 0 17 0z" fill={P} /><circle cx="17" cy="16.5" r="6.5" fill="#fff" /></svg>
                <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-semibold text-[#0A0A0A] truncate">{[branch.area, branch.city].filter(Boolean).join(", ") || branch.name}</span></span>
                <ChevronDown size={15} color="#5F6672" />
              </button>
              <button type="button" onClick={onList} data-testid="map-list-button" className="h-12 px-4 rounded-2xl bg-white shadow-md flex items-center gap-1.5 text-[14px] font-semibold text-[#0A0A0A]"><List size={16} /> List</button>
            </div>
            <div className="flex gap-2 items-center relative">
              <button type="button" onClick={() => setRadiusOpen((o) => !o)} data-testid="map-radius" className="h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold flex items-center gap-1">{radius} km <ChevronDown size={14} /></button>
              <span className="h-9 px-3.5 rounded-full bg-white shadow-sm text-[13px] font-semibold text-[#0A0A0A] flex items-center gap-1.5">{list.length} creator{list.length === 1 ? "" : "s"} near you <Info size={13} color="#9CA3AF" aria-label="Pins show the area, not the exact address" /></span>
              {radiusOpen && (
                <div className="yb-reveal absolute left-0 top-11 bg-white rounded-2xl shadow-xl p-1.5 z-10 min-w-[180px]">
                  {RADII.map((r) => (
                    <button key={r} type="button" onClick={() => { setRadius(r); setRadiusOpen(false); }} className={`w-full h-10 px-3 rounded-xl flex items-center justify-between text-[14px] ${r === radius ? "bg-[#F5F0FF] font-semibold text-[#6D28D9]" : "text-[#0A0A0A]"}`}>
                      <span>{r} km</span><span className="text-[12.5px] text-[#5F6672]">{counts?.[r] ?? 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* v455: zoom in / out (clusters only zoomed in before; there was no way back out except Recenter) */}
          <div className="absolute right-3 flex flex-col rounded-2xl bg-white shadow-md overflow-hidden" style={{ bottom: "calc(206px + env(safe-area-inset-bottom, 0px))" }} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in" data-testid="map-zoom-in" disabled={zoomAdj >= 6} className="w-11 h-11 flex items-center justify-center disabled:opacity-40"><Plus size={18} color="#0A0A0A" /></button>
            <span className="h-px bg-[#ECECF0]" />
            <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out" data-testid="map-zoom-out" disabled={zoomAdj <= -3} className="w-11 h-11 flex items-center justify-center disabled:opacity-40"><Minus size={18} color="#0A0A0A" /></button>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); recenter(); }} aria-label="Recenter" data-testid="map-recenter" className="absolute right-3 w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center" style={{ bottom: "calc(150px + env(safe-area-inset-bottom, 0px))" }}><LocateFixed size={18} color={P} /></button>
          {list.length > 0 && (
            <div ref={car} onScroll={onCarScroll} onClick={(e) => e.stopPropagation()} className="absolute left-0 right-0 flex gap-2.5 overflow-x-auto no-scrollbar px-3" style={{ bottom: "calc(14px + env(safe-area-inset-bottom, 0px))", scrollSnapType: "x mandatory", animation: rm ? "none" : "ybSlideUp .45s both" }} data-testid="map-carousel">
              {list.map((c, i) => {
                const rate = RATES_PUBLIC ? rateOf(c) : 0;
                return (
                  <button key={idOf(c)} type="button" onClick={() => onOpenCreator(c)} className={`shrink-0 w-[calc(100%-36px)] max-w-[360px] bg-white rounded-2xl p-3 flex items-center gap-3 text-left shadow-lg border ${i === active ? "border-[#D9C8FB]" : "border-transparent"}`} style={{ scrollSnapAlign: "center" }}>
                    <span style={{ width: 58, height: 58, borderRadius: 14, overflow: "hidden", flexShrink: 0 }}><PinFace c={c} size={58} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-[#0A0A0A] truncate">{nameOf(c)}</span>
                      <span className="block text-[12.5px] text-[#5F6672] truncate">{[nicheOf(c), followersOf(c) ? `${shortNum(followersOf(c))} followers` : ""].filter(Boolean).join(" · ")}</span>
                      <span className="block text-[12.5px] font-semibold truncate" style={{ color: P }}>{distanceLabel(c, branch)}{rate ? <span className="text-[#5F6672] font-medium"> · ₹{rate.toLocaleString("en-IN")}/reel</span> : null}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
export { titleCase };
