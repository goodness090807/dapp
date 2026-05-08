import { useMemo, useState } from "react";
import { type BikePart, useMintBikeNft } from "./manufacturerFunction";

type ManufacturerFeatureKey = "mintBike" | "mintGuide";

type ManufacturerFeatureItem = {
    key: ManufacturerFeatureKey;
    title: string;
    description: string;
    badge?: string;
};

const FEATURE_ITEMS: ManufacturerFeatureItem[] = [
    {
        key: "mintBike",
        title: "鑄造自行車 NFT",
        description: "先把車輛圖片與零件 metadata 上傳到 IPFS，再呼叫鏈上 mint_bike_nft。",
        badge: "已實作",
    },
];

const PART_CATEGORY_OPTIONS = [
    "車架",
    "前叉",
    "把手",
    "龍頭",
    "座墊",
    "座管",
    "曲柄",
    "中軸",
    "踏板",
    "鏈條",
    "飛輪",
    "變速器",
    "變把",
    "煞車夾器",
    "煞車碟盤",
    "輪組",
    "輪圈",
    "花鼓",
    "外胎",
    "內胎",
    "電池",
    "馬達",
    "控制器",
    "燈具",
    "貨架",
    "其他",
];

function createEmptyPart(category = "車架"): BikePart {
    return {
        category,
        name: "",
    };
}

export function ManufacturerPage() {
    const [activeFeature, setActiveFeature] = useState<ManufacturerFeatureKey>("mintBike");

    const activeItem = useMemo(
        () => FEATURE_ITEMS.find((item) => item.key === activeFeature) ?? FEATURE_ITEMS[0],
        [activeFeature],
    );

    return (
        <div className="manufacturer-shell">
            <div className="manufacturer-layout">
                <aside className="manufacturer-sidebar">
                    <h2>Manufacturer 功能</h2>

                    <div className="manufacturer-menu">
                        {FEATURE_ITEMS.map((item) => {
                            const active = item.key === activeFeature;
                            return (
                                <button
                                    key={item.key}
                                    className={`manufacturer-menu-item ${active ? "manufacturer-menu-item-active" : ""}`}
                                    onClick={() => setActiveFeature(item.key)}>
                                    <div className="manufacturer-menu-title-row">
                                        <span>{item.title}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <section className="manufacturer-content">
                    <header className="manufacturer-content-head">
                        <h3>{activeItem.title}</h3>
                    </header>

                    {activeFeature === "mintBike" ? <MintBikePanel /> : <MetadataGuidePanel />}
                </section>
            </div>
        </div>
    );
}

function MintBikePanel() {
    const { mintBike, isPending, bikeObjectId, error } = useMintBikeNft();
    const [name, setName] = useState("");
    const [frameNo, setFrameNo] = useState("");
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [frameMaterial, setFrameMaterial] = useState("");
    const [manufacturedYear, setManufacturedYear] = useState(String(new Date().getFullYear()));
    const [retailerAddress, setRetailerAddress] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [parts, setParts] = useState<BikePart[]>([]);

    const canSubmit =
        Boolean(name.trim()) &&
        Boolean(frameNo.trim()) &&
        Boolean(brand.trim()) &&
        Boolean(model.trim()) &&
        Boolean(frameMaterial.trim()) &&
        Boolean(retailerAddress.trim()) &&
        Boolean(imageFile) &&
        !isPending;

    const updatePart = (index: number, field: keyof BikePart, value: string) => {
        setParts((current) =>
            current.map((part, itemIndex) => (itemIndex === index ? { ...part, [field]: value } : part)),
        );
    };

    const addPart = () => {
        setParts((current) => [...current, createEmptyPart("其他")]);
    };

    const removePart = (index: number) => {
        setParts((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
    };

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!imageFile) {
            return;
        }

        await mintBike({
            name,
            frameNo,
            brand,
            model,
            frameMaterial,
            manufacturedYear: Number(manufacturedYear),
            retailerAddress,
            imageFile,
            parts,
        });
    };

    return (
        <div className="manufacturer-stack">
            <form className="manufacturer-form-card" onSubmit={submit}>
                <section className="manufacturer-form-section">
                    <div className="manufacturer-section-head">
                        <h4>自行車基本資訊</h4>
                    </div>

                    <div className="manufacturer-grid manufacturer-grid-3 manufacturer-grid-compact">
                        <label>
                            自行車名稱
                            <input value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} />
                        </label>

                        <label>
                            車架號碼
                            <input value={frameNo} onChange={(e) => setFrameNo(e.target.value)} disabled={isPending} />
                        </label>

                        <label>
                            品牌
                            <input value={brand} onChange={(e) => setBrand(e.target.value)} disabled={isPending} />
                        </label>

                        <label>
                            型號
                            <input value={model} onChange={(e) => setModel(e.target.value)} disabled={isPending} />
                        </label>

                        <label>
                            車架材質
                            <input
                                value={frameMaterial}
                                onChange={(e) => setFrameMaterial(e.target.value)}
                                disabled={isPending}
                            />
                        </label>

                        <label>
                            製造年份
                            <input
                                type="number"
                                min="1900"
                                max="2999"
                                value={manufacturedYear}
                                onChange={(e) => setManufacturedYear(e.target.value)}
                                disabled={isPending}
                            />
                        </label>

                        <label className="manufacturer-field-span-3">
                            零售商地址
                            <input
                                value={retailerAddress}
                                onChange={(e) => setRetailerAddress(e.target.value)}
                                disabled={isPending}
                            />
                        </label>

                        <label className="manufacturer-file-field manufacturer-field-span-3">
                            車輛圖片
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                                disabled={isPending}
                            />
                            <small>{imageFile ? `已選擇：${imageFile.name}` : "請選擇要上傳至 IPFS 的車輛圖片"}</small>
                        </label>
                    </div>
                </section>

                <section className="manufacturer-form-section">
                    <div className="manufacturer-section-head manufacturer-section-head-inline">
                        <div>
                            <h4>零件 Metadata</h4>
                        </div>

                        <button
                            className="manufacturer-secondary-btn"
                            type="button"
                            onClick={addPart}
                            disabled={isPending}>
                            新增零件
                        </button>
                    </div>

                    <div className="manufacturer-parts">
                        {parts.length === 0 ? (
                            <div className="manufacturer-empty-parts">尚未新增零件，請按「新增零件」。</div>
                        ) : (
                            parts.map((part, index) => (
                                <article key={`${part.category}-${index}`} className="manufacturer-part-card">
                                    <div className="manufacturer-part-head">
                                        <strong>零件 {index + 1}</strong>
                                        <button
                                            className="manufacturer-text-btn"
                                            type="button"
                                            onClick={() => removePart(index)}
                                            disabled={isPending}>
                                            刪除
                                        </button>
                                    </div>

                                    <div className="manufacturer-grid manufacturer-grid-2 manufacturer-grid-compact">
                                        <label>
                                            類別
                                            <select
                                                value={part.category}
                                                onChange={(e) => updatePart(index, "category", e.target.value)}
                                                disabled={isPending}>
                                                {PART_CATEGORY_OPTIONS.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label>
                                            名稱
                                            <input
                                                value={part.name}
                                                onChange={(e) => updatePart(index, "name", e.target.value)}
                                                disabled={isPending}
                                            />
                                        </label>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </section>

                <button className="manufacturer-primary-btn" type="submit" disabled={!canSubmit}>
                    {isPending ? "處理中..." : "上傳 IPFS 並鑄造自行車"}
                </button>
            </form>

            {error && <p className="manufacturer-status manufacturer-status-error">{error}</p>}
            {bikeObjectId && (
                <p className="manufacturer-status manufacturer-status-success">鑄造成功，Object ID：{bikeObjectId}</p>
            )}
        </div>
    );
}

function MetadataGuidePanel() {
    return (
        <div className="manufacturer-card manufacturer-guide-card">
            <h4>Metadata JSON 範例</h4>
            <pre>{`{
  "bike": {
    "name": "Urban Explorer",
    "qrcode_id_hash": "0xabc123",
    "frame_no": "FRM-2026-0001",
    "brand": "VELO",
    "model": "X1",
    "frame_material": "Aluminum",
    "manufactured_year": 2026,
    "manufacturer_address": "0x...",
    "retailer_address": "0x...",
    "image_cid": "bafy...",
    "created_at": "2026-05-07T12:00:00.000Z"
  },
  "parts": [
    {
      "category": "車架",
      "name": "Main Frame"
    }
  ]
}`}</pre>
            <p>建議至少填寫車架、前叉、輪組、變速系統、煞車系統、座墊等核心零件，後續保固或追溯會更完整。</p>
        </div>
    );
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .manufacturer-shell {
    min-height: calc(100vh - 64px);
    padding: 12px 14px 18px;
    box-sizing: border-box;
  }

  .manufacturer-layout {
    width: min(1420px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(220px, 280px) 1fr;
    gap: 10px;
    align-items: start;
  }

  .manufacturer-sidebar,
  .manufacturer-content,
  .manufacturer-card,
  .manufacturer-form-card {
    border-radius: 18px;
    border: 1px solid #d5ddd7;
    background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(245,250,246,0.98) 100%);
    box-shadow: 0 18px 36px rgba(16, 24, 40, 0.06);
  }

  .manufacturer-sidebar,
  .manufacturer-content {
    padding: 14px;
  }

  .manufacturer-sidebar h2,
  .manufacturer-content-head h3,
  .manufacturer-section-head h4,
  .manufacturer-card h4 {
    margin: 0;
  }

  .manufacturer-sidebar p,
  .manufacturer-section-head p,
  .manufacturer-guide-card p {
    color: #53625b;
    line-height: 1.6;
  }

  .manufacturer-menu {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .manufacturer-menu-item {
    width: 100%;
    text-align: left;
    border: 1px solid #d7dfd9;
    border-radius: 12px;
    background: #ffffff;
    padding: 10px 11px;
    cursor: pointer;
    transition: transform .15s, box-shadow .15s, border-color .15s;
  }

  .manufacturer-menu-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(16, 24, 40, 0.08);
  }

  .manufacturer-menu-item-active {
    border-color: #1f7a4f;
    box-shadow: 0 0 0 3px rgba(31, 122, 79, 0.12);
  }

  .manufacturer-menu-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    color: #16201b;
    font-size: 14px;
    font-weight: 700;
  }

  .manufacturer-menu-title-row em,
  .manufacturer-content-head span {
    font-style: normal;
    font-size: 11px;
    font-weight: 700;
    background: #e2f3e8;
    color: #15603e;
    border-radius: 999px;
    padding: 4px 8px;
    flex-shrink: 0;
  }

  .manufacturer-menu-item small {
    display: block;
    margin-top: 7px;
    color: #53625b;
    font-size: 12px;
    line-height: 1.5;
  }

  .manufacturer-content-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    margin-bottom: 10px;
  }

  .manufacturer-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .manufacturer-card,
  .manufacturer-form-card {
    padding: 14px;
  }

  .manufacturer-card-muted {
    background: linear-gradient(135deg, #eff8f1 0%, #fbfdfb 100%);
  }

  .manufacturer-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .manufacturer-summary-grid span {
    display: block;
    color: #53625b;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .manufacturer-summary-grid strong {
    display: block;
    color: #16201b;
    line-height: 1.5;
    word-break: break-word;
  }

  .manufacturer-form-card {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 10px;
    align-items: start;
  }

  .manufacturer-form-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .manufacturer-form-section:nth-of-type(2) {
    max-height: calc(100vh - 280px);
    overflow: auto;
  }

  .manufacturer-section-head-inline {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .manufacturer-grid {
    display: grid;
    gap: 8px;
  }

  .manufacturer-grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .manufacturer-grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .manufacturer-grid-compact label {
    gap: 4px;
  }

  .manufacturer-grid label {
    display: grid;
    gap: 7px;
    color: #16201b;
    font-size: 12px;
    font-weight: 600;
  }

  .manufacturer-grid input,
  .manufacturer-grid select,
  .manufacturer-grid textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #c5d1c8;
    border-radius: 10px;
    padding: 9px 10px;
    background: #fff;
    font-size: 13px;
    outline: none;
    transition: border-color .15s, box-shadow .15s;
    font-family: inherit;
    resize: vertical;
  }

  .manufacturer-grid input:focus,
  .manufacturer-grid select:focus,
  .manufacturer-grid textarea:focus {
    border-color: #1f7a4f;
    box-shadow: 0 0 0 3px rgba(31, 122, 79, 0.12);
  }

  .manufacturer-file-field small {
    color: #53625b;
    font-weight: 400;
  }

  .manufacturer-field-span-2 {
    grid-column: span 2;
  }

  .manufacturer-field-span-3 {
    grid-column: span 3;
  }

  .manufacturer-parts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .manufacturer-empty-parts {
    padding: 11px;
    border: 1px dashed #c5d1c8;
    border-radius: 12px;
    color: #53625b;
    background: #f8fcf9;
    font-size: 13px;
  }

  .manufacturer-part-card {
    padding: 10px;
    border: 1px solid #d7dfd9;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.92);
  }

  .manufacturer-part-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    gap: 10px;
  }

  .manufacturer-primary-btn,
  .manufacturer-secondary-btn,
  .manufacturer-text-btn {
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  .manufacturer-primary-btn {
    grid-column: 1 / -1;
    min-height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #1f7a4f 0%, #0f5130 100%);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    box-shadow: 0 14px 28px rgba(21, 96, 62, 0.2);
  }

  .manufacturer-primary-btn:disabled {
    opacity: .5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .manufacturer-secondary-btn {
    padding: 8px 12px;
    border-radius: 10px;
    background: #edf7f0;
    color: #15603e;
    font-weight: 700;
  }

  .manufacturer-text-btn {
    background: transparent;
    color: #9f1239;
    font-weight: 700;
  }

  .manufacturer-status {
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid transparent;
    word-break: break-word;
  }

  .manufacturer-status-error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
  }

  .manufacturer-status-success {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #047857;
  }

  .manufacturer-status-panel dl {
    margin: 12px 0 0;
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 8px 12px;
  }

  .manufacturer-status-panel dt {
    color: #53625b;
    font-weight: 700;
  }

  .manufacturer-status-panel dd {
    margin: 0;
    color: #16201b;
    word-break: break-word;
  }

  .manufacturer-guide-card pre {
    margin: 12px 0;
    padding: 14px;
    overflow-x: auto;
    border-radius: 14px;
    background: #132019;
    color: #e8fff0;
    font-size: 12px;
    line-height: 1.65;
  }

  @media (max-width: 960px) {
    .manufacturer-layout {
      grid-template-columns: 1fr;
    }

    .manufacturer-form-card {
      grid-template-columns: 1fr;
    }

    .manufacturer-form-section:nth-of-type(2) {
      max-height: none;
      overflow: visible;
    }

    .manufacturer-grid-2,
    .manufacturer-grid-3,
    .manufacturer-summary-grid,
    .manufacturer-status-panel dl {
      grid-template-columns: 1fr;
    }

    .manufacturer-field-span-2,
    .manufacturer-field-span-3 {
      grid-column: auto;
    }
  }

  @media (max-width: 640px) {
    .manufacturer-shell {
      padding: 24px 12px 36px;
    }

    .manufacturer-sidebar,
    .manufacturer-content,
    .manufacturer-card,
    .manufacturer-form-card {
      padding: 16px;
      border-radius: 16px;
    }

    .manufacturer-section-head-inline,
    .manufacturer-part-head,
    .manufacturer-content-head {
      flex-direction: column;
      align-items: stretch;
    }
  }
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
