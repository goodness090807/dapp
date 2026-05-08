// src/components/retailer/RegisterRetailerForm.tsx
import { useState } from "react";
import { useRegisterRetailer, type RegistrableRole } from "./adminFunction";

export function AdminPage() {
    const { register, isPending, txDigest, error } = useRegisterRetailer();
    const [selectedRole, setSelectedRole] = useState<RegistrableRole>("retailer");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [location, setLocation] = useState("");
    const [address, setAddress] = useState("");

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!name.trim() || !address.trim()) return;
        await register(selectedRole, name.trim(), phone.trim(), location.trim(), address.trim());
    };

    return (
        <div className="admin-shell">
            <form className="admin-card" onSubmit={handleSubmit}>
                <div className="admin-heading">
                    <h2>廠商註冊</h2>
                </div>

                <label className="admin-field">
                    <span>註冊角色</span>
                    <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as RegistrableRole)}
                        disabled={isPending}>
                        <option value="manufacturer">製造商</option>
                        <option value="retailer">零售商</option>
                    </select>
                </label>

                <label className="admin-field">
                    <span>名稱</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} />
                </label>

                <label className="admin-field">
                    <span>電話</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isPending} />
                </label>

                <label className="admin-field">
                    <span>聯絡地址</span>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} disabled={isPending} />
                </label>

                <label className="admin-field">
                    <span>錢包地址</span>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={isPending} />
                </label>

                <button className="admin-submit" type="submit" disabled={isPending || !name || !address}>
                    {isPending ? "處理中…" : "確認註冊"}
                </button>

                {error && <p className="admin-status admin-status-error">{error}</p>}
                {txDigest && <p className="admin-status admin-status-success">成功：{txDigest}</p>}
            </form>
        </div>
    );
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .admin-shell {
    display: flex;
    justify-content: center;
    padding: 32px 16px;
    box-sizing: border-box;
  }

  .admin-card {
    width: min(100%, 460px);
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
    text-align: left;
    box-sizing: border-box;
  }

  .admin-heading {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .admin-heading h2 {
    margin: 0;
  }

  .admin-heading p {
    color: #6b7280;
    font-size: 14px;
    line-height: 1.55;
  }

  .admin-badge {
    align-self: flex-start;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.1);
    color: #2563eb;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .admin-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .admin-field span {
    color: #374151;
    font-size: 13px;
    font-weight: 600;
  }

  .admin-field input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #ffffff;
    color: #111827;
    font-size: 14px;
    box-sizing: border-box;
    outline: none;
    transition: border-color .15s, box-shadow .15s, background-color .15s;
  }

  .admin-field select {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #ffffff;
    color: #111827;
    font-size: 14px;
    box-sizing: border-box;
    outline: none;
    transition: border-color .15s, box-shadow .15s, background-color .15s;
  }

  .admin-field input::placeholder {
    color: #9ca3af;
  }

  .admin-field input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
  }

  .admin-field select:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
  }

  .admin-field input:disabled {
    background: #f9fafb;
    color: #6b7280;
    cursor: not-allowed;
  }

  .admin-field select:disabled {
    background: #f9fafb;
    color: #6b7280;
    cursor: not-allowed;
  }

  .admin-submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 10px 16px;
    border: none;
    border-radius: 10px;
    background: #2563eb;
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: transform .15s, opacity .15s, box-shadow .15s;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.24);
  }

  .admin-submit:hover:not(:disabled) {
    opacity: .92;
    transform: translateY(-1px);
  }

  .admin-submit:disabled {
    opacity: .45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .admin-status {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.45;
    word-break: break-word;
  }

  .admin-status-error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .admin-status-success {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  @media (max-width: 640px) {
    .admin-shell {
      padding: 24px 12px;
    }

    .admin-card {
      padding: 20px;
      border-radius: 16px;
    }
  }
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
