import { useMemo, useState } from "react";
import { useCurrentAccount } from "@iota/dapp-kit";
import { STATE_PENDING_SALE, type BikeNFT, useCreateSaleOrder, useRetailerBikes } from "./retailerFunction";

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

type RetailerFeatureKey = "pendingBikes" | "createSaleOrder";

type RetailerFeatureItem = {
    key: RetailerFeatureKey;
    title: string;
    description: string;
    badge?: string;
};

const FEATURE_ITEMS: RetailerFeatureItem[] = [
    {
        key: "pendingBikes",
        title: "自行車清單",
        description: "顯示目前帳戶底下所有 BikeNFT（含已放入交車單）；只有待銷售且未在交車單內可建立交車單。",
        badge: "已實作",
    },
    {
        key: "createSaleOrder",
        title: "建立銷售訂單",
        description: "選擇車輛、填入消費者地址與保固書，呼叫 create_sale_order。",
        badge: "已實作",
    },
];

export function RetailerPage() {
    const account = useCurrentAccount();
    const [activeFeature, setActiveFeature] = useState<RetailerFeatureKey>("pendingBikes");
    const [selectedBikeId, setSelectedBikeId] = useState<string>("");

    const activeItem = useMemo(
        () => FEATURE_ITEMS.find((item) => item.key === activeFeature) ?? FEATURE_ITEMS[0],
        [activeFeature],
    );

    const handleSelectBike = (bikeObjectId: string) => {
        setSelectedBikeId(bikeObjectId);
        setActiveFeature("createSaleOrder");
    };

    return (
        <div className="retailer-shell">
            <div className="retailer-layout">
                <aside className="retailer-sidebar">
                    <h2>Retailer 功能</h2>

                    <div className="retailer-menu">
                        {FEATURE_ITEMS.map((item) => {
                            const active = item.key === activeFeature;
                            return (
                                <button
                                    key={item.key}
                                    className={`retailer-menu-item ${active ? "retailer-menu-item-active" : ""}`}
                                    onClick={() => setActiveFeature(item.key)}>
                                    <div className="retailer-menu-title-row">
                                        <span>{item.title}</span>
                                        {item.badge && <em>{item.badge}</em>}
                                    </div>
                                    <small>{item.description}</small>
                                </button>
                            );
                        })}
                    </div>

                    {account && (
                        <div className="retailer-account-info">
                            <small>目前帳戶</small>
                            <code>{`${account.address.slice(0, 8)}…${account.address.slice(-6)}`}</code>
                        </div>
                    )}
                </aside>

                <section className="retailer-content">
                    <header className="retailer-content-head">
                        <h3>{activeItem.title}</h3>
                        {activeItem.badge && <span className="retailer-badge">{activeItem.badge}</span>}
                    </header>

                    {activeFeature === "pendingBikes" && <PendingBikesPanel onSelectBike={handleSelectBike} />}
                    {activeFeature === "createSaleOrder" && (
                        <CreateSaleOrderPanel
                            defaultBikeId={selectedBikeId}
                            onBack={() => setActiveFeature("pendingBikes")}
                        />
                    )}
                </section>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────── */
/*  自行車清單                                                      */
/* ─────────────────────────────────────────────────────────────── */

function PendingBikesPanel({ onSelectBike }: { readonly onSelectBike: (id: string) => void }) {
    const { fetchBikes, bikes, isPending, error } = useRetailerBikes();
    const pendingCount = bikes.filter((bike) => bike.state === STATE_PENDING_SALE).length;

    return (
        <div className="retailer-stack">
            <div className="retailer-toolbar">
                <button className="retailer-primary-btn" onClick={fetchBikes} disabled={isPending}>
                    {isPending ? "查詢中…" : "重新整理"}
                </button>
                {bikes.length > 0 && (
                    <span className="retailer-count">
                        共 {bikes.length} 輛（待銷售 {pendingCount} 輛）
                    </span>
                )}
            </div>

            {error && <p className="retailer-status retailer-status-error">{error}</p>}

            {!isPending && bikes.length === 0 && !error && (
                <div className="retailer-empty">
                    <p>目前沒有可顯示的自行車，請按「重新整理」或確認錢包是否已連接。</p>
                </div>
            )}

            <div className="retailer-bike-grid">
                {bikes.map((bike) => (
                    <BikeCard key={bike.objectId} bike={bike} onSelectBike={onSelectBike} />
                ))}
            </div>
        </div>
    );
}

function BikeCard({ bike, onSelectBike }: { readonly bike: BikeNFT; readonly onSelectBike: (id: string) => void }) {
    const imageUrl = bike.imageCid ? `${IPFS_GATEWAY}${bike.imageCid}` : null;
    const canCreateOrder = bike.state === STATE_PENDING_SALE;

    return (
        <article className="retailer-bike-card">
            {imageUrl && (
                <div className="retailer-bike-img-wrap">
                    <img src={imageUrl} alt={bike.name} className="retailer-bike-img" />
                </div>
            )}

            <div className="retailer-bike-body">
                <h4 className="retailer-bike-name">{bike.name || "—"}</h4>

                <dl className="retailer-bike-dl">
                    <dt>品牌 / 型號</dt>
                    <dd>
                        {bike.brand} {bike.model}
                    </dd>

                    <dt>車架號碼</dt>
                    <dd>{bike.frameNo}</dd>

                    <dt>車架材質</dt>
                    <dd>{bike.frameMaterial}</dd>

                    <dt>製造年份</dt>
                    <dd>{bike.manufacturedYear}</dd>

                    <dt>狀態</dt>
                    <dd>{canCreateOrder ? "待銷售 (1)" : `非待銷售 (${bike.state})`}</dd>

                    <dt>Object ID</dt>
                    <dd className="retailer-mono">{`${bike.objectId.slice(0, 10)}…${bike.objectId.slice(-6)}`}</dd>
                </dl>

                <button
                    className="retailer-primary-btn retailer-bike-action"
                    onClick={() => onSelectBike(bike.objectId)}
                    disabled={!canCreateOrder}>
                    建立銷售訂單
                </button>
            </div>
        </article>
    );
}

/* ─────────────────────────────────────────────────────────────── */
/*  建立銷售訂單                                                    */
/* ─────────────────────────────────────────────────────────────── */

function CreateSaleOrderPanel({
    defaultBikeId,
    onBack,
}: {
    readonly defaultBikeId: string;
    readonly onBack: () => void;
}) {
    const { createSaleOrder, isPending, error, orderObjectId } = useCreateSaleOrder();

    const [bikeObjectId, setBikeObjectId] = useState(defaultBikeId);
    const [recipient, setRecipient] = useState("");
    const [certificateFile, setCertificateFile] = useState<File | null>(null);

    const canSubmit =
        Boolean(bikeObjectId.trim()) && Boolean(recipient.trim()) && Boolean(certificateFile) && !isPending;

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!certificateFile) return;

        await createSaleOrder({
            bikeObjectId: bikeObjectId.trim(),
            recipient: recipient.trim(),
            certificateFile,
        });
    };

    return (
        <div className="retailer-stack">
            <button className="retailer-back-btn" type="button" onClick={onBack}>
                ← 返回清單
            </button>

            <form className="retailer-form-card" onSubmit={submit}>
                <section className="retailer-form-section">
                    <div className="retailer-section-head">
                        <h4>銷售訂單資訊</h4>
                        <p>請確認車輛 Object ID 正確，並填入消費者地址與保固書檔案。</p>
                    </div>

                    <div className="retailer-grid retailer-grid-compact">
                        <label className="retailer-field-full">
                            自行車 Object ID
                            <input
                                value={bikeObjectId}
                                onChange={(e) => setBikeObjectId(e.target.value)}
                                placeholder="0x…"
                                disabled={isPending}
                            />
                            <small>可從「待銷售自行車清單」點選「建立銷售訂單」自動帶入。</small>
                        </label>

                        <label className="retailer-field-full">
                            消費者地址（recipient）
                            <input
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="0x…"
                                disabled={isPending}
                            />
                        </label>

                        <label className="retailer-file-field retailer-field-full">
                            保固書（certificate）
                            <input
                                type="file"
                                onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)}
                                disabled={isPending}
                            />
                            <small>
                                {certificateFile
                                    ? `已選擇：${certificateFile.name}`
                                    : "選擇保固書檔案，將上傳至 IPFS 後取得 CID"}
                            </small>
                        </label>
                    </div>
                </section>

                <button className="retailer-primary-btn" type="submit" disabled={!canSubmit}>
                    {isPending ? "上傳 IPFS 並建立訂單…" : "建立銷售訂單"}
                </button>
            </form>

            {error && <p className="retailer-status retailer-status-error">{error}</p>}
            {orderObjectId && (
                <p className="retailer-status retailer-status-success">
                    訂單建立成功！SaleOrder Object ID：{orderObjectId}
                </p>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Scoped CSS                                                      */
/* ─────────────────────────────────────────────────────────────── */

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .retailer-shell {
    min-height: calc(100vh - 64px);
    padding: 12px 14px 18px;
    box-sizing: border-box;
  }

  .retailer-layout {
    width: min(1420px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(220px, 280px) 1fr;
    gap: 10px;
    align-items: start;
  }

  .retailer-sidebar,
  .retailer-content,
  .retailer-form-card {
    border-radius: 18px;
    border: 1px solid #d5ddd7;
    background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(245,250,246,0.98) 100%);
    box-shadow: 0 18px 36px rgba(16, 24, 40, 0.06);
  }

  .retailer-sidebar,
  .retailer-content {
    padding: 14px;
  }

  .retailer-sidebar h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #111827;
  }

  .retailer-menu {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .retailer-menu-item {
    width: 100%;
    text-align: left;
    border: 1px solid #d7dfd9;
    border-radius: 12px;
    background: #ffffff;
    padding: 10px 11px;
    cursor: pointer;
    transition: transform .15s, box-shadow .15s, border-color .15s;
  }

  .retailer-menu-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(16, 24, 40, 0.08);
  }

  .retailer-menu-item-active {
    border-color: #16a34a;
    background: linear-gradient(135deg, #f0fdf4, #dcfce7);
    box-shadow: 0 6px 14px rgba(22, 163, 74, 0.15);
  }

  .retailer-menu-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 13px;
    color: #111827;
  }

  .retailer-menu-title-row em {
    font-style: normal;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 20px;
    background: #dcfce7;
    color: #15803d;
  }

  .retailer-menu-item small {
    display: block;
    margin-top: 3px;
    font-size: 11px;
    color: #6b7280;
    line-height: 1.4;
  }

  .retailer-account-info {
    margin-top: 14px;
    padding: 8px 10px;
    border-radius: 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .retailer-account-info small {
    font-size: 10px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .retailer-account-info code {
    font-size: 11px;
    color: #374151;
    word-break: break-all;
  }

  .retailer-content-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .retailer-content-head h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }

  .retailer-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 20px;
    background: #dcfce7;
    color: #15803d;
  }

  /* ── 通用元件 ── */

  .retailer-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .retailer-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .retailer-count {
    font-size: 13px;
    color: #374151;
  }

  .retailer-primary-btn {
    padding: 9px 20px;
    border-radius: 10px;
    border: none;
    background: #16a34a;
    color: #fff;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background .15s, transform .12s;
  }

  .retailer-primary-btn:hover:not(:disabled) {
    background: #15803d;
    transform: translateY(-1px);
  }

  .retailer-primary-btn:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .retailer-back-btn {
    align-self: flex-start;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: #fff;
    font-size: 12px;
    color: #374151;
    cursor: pointer;
    transition: background .12s;
  }

  .retailer-back-btn:hover {
    background: #f3f4f6;
  }

  .retailer-empty {
    padding: 32px;
    text-align: center;
    color: #6b7280;
    border: 1px dashed #d1d5db;
    border-radius: 14px;
    font-size: 13px;
  }

  /* ── 自行車卡片格 ── */

  .retailer-bike-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
  }

  .retailer-bike-card {
    border-radius: 14px;
    border: 1px solid #d5ddd7;
    background: #fff;
    overflow: hidden;
    box-shadow: 0 6px 16px rgba(16, 24, 40, 0.05);
    display: flex;
    flex-direction: column;
    transition: box-shadow .15s, transform .15s;
  }

  .retailer-bike-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px rgba(16, 24, 40, 0.1);
  }

  .retailer-bike-img-wrap {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #f3f4f6;
  }

  .retailer-bike-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .retailer-bike-body {
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .retailer-bike-name {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .retailer-bike-dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 10px;
    font-size: 12px;
  }

  .retailer-bike-dl dt {
    color: #9ca3af;
    font-weight: 600;
    white-space: nowrap;
  }

  .retailer-bike-dl dd {
    margin: 0;
    color: #374151;
    word-break: break-all;
  }

  .retailer-mono {
    font-family: monospace;
    font-size: 11px;
  }

  .retailer-bike-action {
    margin-top: auto;
    width: 100%;
  }

  /* ── 表單 ── */

  .retailer-form-card {
    padding: 18px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .retailer-form-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .retailer-section-head h4 {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .retailer-section-head p {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
  }

  .retailer-grid {
    display: grid;
    gap: 10px 14px;
  }

  .retailer-grid-compact {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }

  .retailer-field-full {
    grid-column: 1 / -1;
  }

  .retailer-form-card label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }

  .retailer-form-card input[type="text"],
  .retailer-form-card input:not([type]),
  .retailer-form-card input[type="file"] {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    font-size: 13px;
    background: #fff;
    color: #111827;
    transition: border-color .12s;
  }

  .retailer-form-card input:focus {
    outline: none;
    border-color: #16a34a;
    box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
  }

  .retailer-form-card input:disabled {
    background: #f9fafb;
    color: #9ca3af;
  }

  .retailer-file-field small {
    font-size: 11px;
    font-weight: 400;
    color: #6b7280;
  }

  /* ── 狀態訊息 ── */

  .retailer-status {
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
    margin: 0;
  }

  .retailer-status-error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .retailer-status-success {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
    word-break: break-all;
  }
`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
