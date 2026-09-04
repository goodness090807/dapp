import { useCallback, useState } from "react";
import { useSignAndExecuteTransaction, useIotaClient, useCurrentAccount } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PinataSDK } from "pinata";

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID as string;
const REGISTRY_ID = import.meta.env.VITE_REGISTRY_ID as string;

function useRegister() {
    const client = useIotaClient();
    const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
    const account = useCurrentAccount();

    const register = useCallback(
        async (name: string, phone: string, location: string, address: string) => {
            const pinata = new PinataSDK({
                pinataJwt: import.meta.env.VITE_PINATA_JWT,
                pinataGateway: import.meta.env.VITE_PINATA_GATEWAY,
            });
            const { cid } = await pinata.upload.public.json({ name, phone, location });

            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::registry::register`,
                arguments: [tx.object(REGISTRY_ID), tx.pure.address(address), tx.pure.string(cid)],
            });
            const result = await signAndExecute({ transaction: tx });
            return result;
        },
        [client, signAndExecute, account],
    );

    return { register };
}

function useRevoke() {
    const client = useIotaClient();
    const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
    const account = useCurrentAccount();

    const revoke = useCallback(
        async (address: string) => {
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::registry::revoke`,
                arguments: [tx.object(REGISTRY_ID), tx.pure.address(address)],
            });
            const result = await signAndExecute({ transaction: tx });
            return result;
        },
        [client, signAndExecute, account],
    );

    return { revoke };
}

export function RegisterPage() {
    const { register } = useRegister();
    const { revoke } = useRevoke();
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({ name: "", phone: "", location: "", address: "" });
    const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const onRegister = async () => {
        setIsSubmitting(true);
        setStatus(null);
        try {
            const result = await register(form.name, form.phone, form.location, form.address);
            setStatus({ type: "success", message: `註冊成功，交易資訊: ${result.digest ?? "交易已送出"}` });
        } catch (error) {
            setStatus({ type: "error", message: `註冊失敗: ${error instanceof Error ? error.message : String(error)}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const onRevoke = async () => {
        setIsSubmitting(true);
        setStatus(null);
        try {
            const result = await revoke(form.address);
            setStatus({ type: "success", message: `撤銷成功，交易資訊: ${result.digest ?? "交易已送出"}` });
        } catch (error) {
            setStatus({ type: "error", message: `撤銷失敗: ${error instanceof Error ? error.message : String(error)}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="reg-shell">
            <form
                className="reg-card"
                onSubmit={async (e) => {
                    e.preventDefault();
                    await onRegister();
                }}>
                <h2 className="reg-heading">經銷商授權</h2>

                {(["name", "phone", "location", "address"] as const).map((key) => (
                    <label key={key} className="reg-field">
                        {{ name: "名稱", phone: "電話", location: "聯絡地址", address: "錢包地址" }[key]}
                        <input value={form[key]} onChange={set(key)} />
                    </label>
                ))}

                <div className="reg-actions">
                    <button className="reg-submit" type="submit" disabled={isSubmitting || !form.name || !form.address}>
                        確認註冊
                    </button>
                    {/* <button className="reg-revoke" type="button" disabled={isSubmitting || !form.address} onClick={onRevoke}>
                        撤銷授權
                    </button> */}
                </div>

                {status && <p className={`reg-status ${status.type === "success" ? "reg-success" : "reg-error"}`}>{status.message}</p>}
            </form>
        </div>
    );
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .reg-shell {
    display: flex;
    justify-content: center;
    padding: 32px 16px;
    box-sizing: border-box;
  }

  .reg-card {
    width: min(100%, 460px);
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
    box-sizing: border-box;
    text-align: left;
  }

  .reg-heading {
    margin: 0;
  }

  .reg-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
  }

  .reg-field select,
  .reg-field input {
    display: block;
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    box-sizing: border-box;
  }

  .reg-submit {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 10px;
    background: #2563eb;
    color: #fff;
    font-size: 15px;
    cursor: pointer;
  }

  .reg-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reg-actions {
    display: flex;
    gap: 10px;
  }

  .reg-revoke {
    flex: 1;
    padding: 10px;
    border: 1px solid #dc2626;
    border-radius: 10px;
    background: #fff;
    color: #dc2626;
    font-size: 15px;
    cursor: pointer;
  }

  .reg-revoke:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reg-status {
    margin: 0;
    font-size: 13px;
  }

  .reg-error  { color: #dc2626; }
  .reg-success { color: #16a34a; }
`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
