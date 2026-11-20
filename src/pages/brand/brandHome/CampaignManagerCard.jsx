import React from "react";
import { Mail, PhoneCall, Headphones } from "lucide-react";
import SocialLogo from "../../../components/common/SocialLogo"; // v451 (BRD §28): real WhatsApp logo


// Session 49 (clean-up): moved out of BrandHomeMobile.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function CampaignManagerCard(props) {
  const { handleContactEmail, handleOpenWhatsApp, onScheduleCall } = props; // v330: onScheduleCall opens the Schedule Call sheet
  return (
    <div style={{ flexShrink: 0, padding: "14px 14px 0" }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #E6E6EE",
              borderRadius: "18px",
              padding: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
              {/* v451 (BRD §28): soft glow + green "online" dot. No stock face (v332) — the team icon stays. */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 42, height: 42, borderRadius: 21, background: "linear-gradient(150deg,#F3EDFF,#E4D6FF)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px rgba(124,58,237,.08), 0 6px 16px -6px rgba(124,58,237,.45)" }}>
                  <Headphones size={18} color="#7C3AED" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <span aria-hidden="true" style={{ position: "absolute", right: 0, bottom: 1, width: 11, height: 11, borderRadius: 6, background: "#22C55E", border: "2px solid #fff" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13px/1.3 'DM Sans', sans-serif", color: "#0A0A0A" }}>
                  Need help shortlisting 10+ creators?
                </div>
                <div
                  style={{
                    marginTop: "2px",
                    font: "400 11px 'DM Sans', sans-serif",
                    color: "#5F6672",
                  }}
                >
                  Talk to the Ybex campaign team{/* v358: no "dedicated manager" promise */}
                </div>
              </div>
            </div>

            {/* Support Actions: Contact Us (Mail) & WhatsApp (+91 87640 04299) */}
            {/* v330: + "Schedule a call" (primary, rightmost). Wraps to its own full-width row on narrow phones (320px). */}
            <div style={{ marginTop: "11px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                onClick={handleContactEmail}
                style={{
                  flex: "1 1 96px", // v330: was flex: 1 (lets the third button wrap on small screens)
                  minWidth: 0,
                  height: "40px", // v332: 40px tap target
                  borderRadius: "11px",
                  background: "#F3EDFF",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <Mail size={14} color="#7C3AED" strokeWidth={1.9} />
                <span style={{ font: "600 12px 'DM Sans', sans-serif", color: "#7C3AED" }}>
                  Contact Us
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                style={{
                  flex: "1 1 96px", // v330: was flex: 1 (lets the third button wrap on small screens)
                  minWidth: 0,
                  height: "40px", // v332: 40px tap target
                  borderRadius: "11px",
                  background: "#16A34A",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <SocialLogo platform="whatsapp" size={16} variant="mono" color="#fff" />
                <span style={{ font: "600 12px 'DM Sans', sans-serif", color: "#fff" }}>
                  WhatsApp
                </span>
              </button>

              {onScheduleCall && (
                <button
                  type="button"
                  onClick={onScheduleCall}
                  style={{
                    flex: "1 1 150px", // v330
                    minWidth: 0,
                    height: "40px", // v332: 40px tap target
                    borderRadius: "11px",
                    background: "#7C3AED",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                >
                  <PhoneCall size={14} color="#fff" strokeWidth={1.9} />
                  <span style={{ font: "600 12px 'DM Sans', sans-serif", color: "#fff", whiteSpace: "nowrap" }}>
                    Schedule a call
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
  );
}
