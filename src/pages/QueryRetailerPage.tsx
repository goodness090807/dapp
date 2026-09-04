import { useState } from "react";
import { useIotaClient } from "@iota/dapp-kit";
import { getCIDUrl } from "../utils/cidHelper";

const REGISTRY_ID = import.meta.env.VITE_REGISTRY_ID as string;
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY as string;

type DisplayField = {
    label: string;
    value: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const pickFirstString = (value: unknown, keys: string[]): string => {
    if (!isRecord(value)) return "";
    for (const key of keys) {
        const nextValue = value[key];
        if (typeof nextValue === "string" && nextValue.trim() !== "") {
            return nextValue;
        }
    }
    return "";
};

const pickFirstBoolean = (value: unknown, keys: string[]): boolean | null => {
    if (!isRecord(value)) return null;
    for (const key of keys) {
        const nextValue = value[key];
        if (typeof nextValue === "boolean") {
            return nextValue;
        }
    }
    return null;
};

const extractRetailerInfo = (valueField: unknown): { identityCid: string; isActive: boolean | null } => {
    if (typeof valueField === "string") {
        return {
            identityCid: valueField,
            isActive: null,
        };
    }

    if (!isRecord(valueField)) {
        return {
            identityCid: "",
            isActive: null,
        };
    }

    const fieldsValue = isRecord(valueField.fields) ? valueField.fields : valueField;

    return {
        identityCid:
            pickFirstString(fieldsValue, ["identity_cid", "identityCid"]) ||
            pickFirstString(fieldsValue.identity_cid, ["value", "bytes", "string", "inner", "cid"]) ||
            pickFirstString(valueField, ["value", "bytes", "string", "inner", "cid"]) ||
            pickFirstString(valueField.value, ["value", "bytes", "string", "inner", "cid"]) ||
            "",
        isActive: pickFirstBoolean(fieldsValue, ["is_active", "isActive"]) ?? pickFirstBoolean(valueField, ["is_active", "isActive"]),
    };
};

const normalizeFieldValue = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value === null || value === undefined) return "-";
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const toDisplayLabel = (key: string): string => {
    const alias: Record<string, string> = {
        name: "名稱",
        phone: "電話",
        location: "聯絡地址",
        address: "錢包地址",
    };

    if (alias[key]) return alias[key];
    return key.replace(/_/g, " ");
};

const buildDisplayFields = (content: unknown): DisplayField[] => {
    if (isRecord(content)) {
        return Object.entries(content).map(([key, value]) => ({
            label: toDisplayLabel(key),
            value: normalizeFieldValue(value),
        }));
    }

    if (Array.isArray(content)) {
        return content.map((item, index) => ({
            label: `項目 ${index + 1}`,
            value: normalizeFieldValue(item),
        }));
    }

    return [
        {
            label: "內容",
            value: normalizeFieldValue(content),
        },
    ];
};

const QueryRetailerPage = () => {
    const client = useIotaClient();
    const [retailerAddress, setRetailerAddress] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [retailerCid, setRetailerCid] = useState("");
    const [cidFields, setCidFields] = useState<DisplayField[]>([]);

    const queryRetailer = async () => {
        const cleanedAddress = retailerAddress.trim();
        if (!cleanedAddress) {
            setRetailerCid("");
            setCidFields([]);
            setNotice(null);
            setError("請輸入經銷商地址");
            return;
        }

        if (!PINATA_GATEWAY) {
            setRetailerCid("");
            setCidFields([]);
            setNotice(null);
            setError("缺少 VITE_PINATA_GATEWAY，無法讀取 CID 內容");
            return;
        }

        setIsLoading(true);
        setError(null);
        setNotice(null);
        setRetailerCid("");
        setCidFields([]);

        try {
            const dynamicField = await client.getDynamicFieldObject({
                parentObjectId: REGISTRY_ID,
                name: {
                    type: "address",
                    value: cleanedAddress,
                },
                options: {
                    showContent: true,
                },
            });

            const fieldContent = dynamicField.data?.content as { fields?: Record<string, unknown> } | undefined;
            const retailerInfo = extractRetailerInfo(fieldContent?.fields?.value);
            if (!retailerInfo.identityCid) {
                throw new Error("查無經銷商資訊");
            }
            setRetailerCid(retailerInfo.identityCid);

            if (retailerInfo.isActive === false) {
                setNotice("此經銷商已撤銷，以下為歷史登錄資料");
            }

            const cidUrl = getCIDUrl(retailerInfo.identityCid, PINATA_GATEWAY);
            if (!cidUrl) {
                throw new Error("CID 或 Gateway 無效");
            }

            const response = await fetch(cidUrl);
            if (!response.ok) {
                throw new Error(`CID 內容讀取失敗 (${response.status})`);
            }

            const contentType = response.headers.get("content-type") ?? "";
            if (contentType.includes("application/json")) {
                const json = (await response.json()) as unknown;
                setCidFields(buildDisplayFields(json));
            } else {
                const text = await response.text();
                setCidFields([
                    {
                        label: "內容",
                        value: text || "(CID 內容為空)",
                    },
                ]);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "查詢經銷商失敗";
            const notFoundHint = message.toLowerCase().includes("not found") ? "查無此經銷商地址的登錄紀錄" : message;
            setError(notFoundHint);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="rq-shell">
            <form
                className="rq-card"
                onSubmit={async (e) => {
                    e.preventDefault();
                    await queryRetailer();
                }}>
                <h2 className="rq-heading">經銷商資料查詢</h2>

                <label className="rq-field">
                    經銷商地址
                    <input value={retailerAddress} onChange={(e) => setRetailerAddress(e.target.value)} placeholder="0x..." autoComplete="off" />
                </label>

                <button className="rq-submit" type="submit" disabled={isLoading}>
                    {isLoading ? "查詢中..." : "查詢"}
                </button>

                {error && <p className="rq-status rq-error">{error}</p>}
                {notice && <p className="rq-status rq-notice">{notice}</p>}

                {(retailerCid || cidFields.length > 0) && (
                    <div className="rq-result">
                        {retailerCid && (
                            <div className="rq-field-item">
                                <p className="rq-field-label">CID</p>
                                <p className="rq-field-value">{retailerCid}</p>
                            </div>
                        )}
                        <div className="rq-fields">
                            {cidFields.map((field, index) => (
                                <div className="rq-field-item" key={`${field.label}-${index}`}>
                                    <p className="rq-field-label">{field.label}</p>
                                    <p className="rq-field-value">{field.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    .rq-shell {
        display: flex;
        justify-content: center;
        padding: 24px 12px;
        box-sizing: border-box;
    }

    .rq-card {
        width: min(100%, 920px);
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        background: #fff;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
        box-sizing: border-box;
    }

    .rq-heading {
        margin: 0;
    }

    .rq-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 14px;
    }

    .rq-field input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-sizing: border-box;
    }

    .rq-submit {
        width: fit-content;
        padding: 10px 14px;
        border: none;
        border-radius: 10px;
        background: #2563eb;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
    }

    .rq-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .rq-status {
        margin: 0;
        font-size: 13px;
    }

    .rq-error {
        color: #dc2626;
    }

    .rq-notice {
        color: #b45309;
    }

    .rq-result {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .rq-result p {
        margin: 0;
        overflow-wrap: anywhere;
    }

    .rq-label {
        color: #334155;
        font-weight: 600;
    }

    .rq-fields {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .rq-field-item {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px;
        background: #f8fafc;
    }

    .rq-field-label {
        margin: 0 0 4px;
        color: #0f172a;
        font-size: 12px;
        font-weight: 600;
    }

    .rq-field-value {
        margin: 0;
        border-radius: 8px;
        color: #334155;
        font-size: 14px;
        line-height: 1.45;
        overflow-wrap: anywhere;
    }
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

export default QueryRetailerPage;
