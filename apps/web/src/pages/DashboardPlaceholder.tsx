import { IconShieldCheck, IconShieldLock } from "@tabler/icons-react";
import { Link } from "react-router-dom";

/**
 * Placeholder dashboard — shown after successful login.
 * Real dashboard is Phase 4+ (Organization Admin screens).
 * Per implementation plan deviation D3.
 */
export default function DashboardPlaceholder() {
  return (
    <>
      <title>Dashboard — Veylo</title>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "16px",
            background: "var(--color-status-low-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.5rem",
          }}
        >
          <IconShieldCheck
            size={36}
            color="var(--color-accent)"
            stroke={1.75}
          />
        </div>

        <h1
          style={{
            fontWeight: 800,
            fontSize: "1.75rem",
            letterSpacing: "-0.025em",
            marginBottom: "0.75rem",
            marginTop: 0,
          }}
        >
          You're in.
        </h1>

        <p
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "1rem",
            lineHeight: 1.65,
            maxWidth: "400px",
            marginBottom: "2rem",
          }}
        >
          Authentication successful. The full Organization Admin dashboard will
          be available in Phase 4.
        </p>

        <div
          className="card"
          style={{
            padding: "1.25rem 1.75rem",
            marginBottom: "1.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <IconShieldLock size={18} color="var(--color-accent)" stroke={2} />
          <span
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
            }}
          >
            Zero Trust verification passed · Session active
          </span>
        </div>

        <Link to="/" className="link" style={{ fontSize: "0.875rem" }}>
          ← Back to landing page
        </Link>
      </div>
    </>
  );
}
