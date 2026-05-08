import { ROLES, useRole } from "./RoleContext";


export function RoleSwitcher() {
  const { role, setRole } = useRole();

  return (
    <div className="rs-shell">
      <span className="rs-label">
        角色
      </span>
      {ROLES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setRole(value)}
          className={`rs-btn ${role === value ? "rs-btn-active" : "rs-btn-idle"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .rs-shell {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: rgba(17, 24, 39, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.28);
    backdrop-filter: blur(12px);
    z-index: 9999;
  }

  .rs-label {
    padding: 0 10px;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .rs-btn {
    padding: 7px 14px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color .15s, color .15s, transform .15s, opacity .15s;
    font-family: inherit;
  }

  .rs-btn:hover {
    transform: translateY(-1px);
  }

  .rs-btn-idle {
    background: transparent;
    color: #cbd5e1;
  }

  .rs-btn-idle:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .rs-btn-active {
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.32);
  }

  @media (max-width: 640px) {
    .rs-shell {
      max-width: calc(100vw - 24px);
      overflow-x: auto;
      justify-content: flex-start;
    }

    .rs-label {
      display: none;
    }
  }
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}