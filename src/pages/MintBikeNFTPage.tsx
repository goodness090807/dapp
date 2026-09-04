import { useCallback, useState } from "react";
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PinataSDK } from "pinata";
import type { IotaObjectChange } from "@iota/iota-sdk/client";
import { QRCodeSVG } from "qrcode.react";

function useMintBike() {
    const client = useIotaClient();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) =>
            await client.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showRawEffects: true,
                    showObjectChanges: true,
                },
            }),
    });

    const mintBike = useCallback(
        async (
            input: {
                name: string;
                frameNo: string;
                brand: string;
                model: string;
                frameMaterial: string;
                manufacturedYear: number;
                retailerAddress: string;
                imageFile: File;
                manufacturerWarrantyFile: File;
                parts: {
                    category: string;
                    name: string;
                }[];
            },
            options?: Parameters<typeof signAndExecuteTransaction>[1],
        ) => {
            const pinata = new PinataSDK({ pinataJwt: import.meta.env.VITE_PINATA_JWT });
            const imageUpload = await pinata.upload.public.file(input.imageFile);
            const manufacturerWarrantyUpload = await pinata.upload.public.file(input.manufacturerWarrantyFile);
            const metadataUpload = await pinata.upload.public.json(input.parts);

            const tx = new Transaction();
            tx.moveCall({
                target: `${import.meta.env.VITE_PACKAGE_ID}::bike::mint`,
                arguments: [
                    tx.object(import.meta.env.VITE_REGISTRY_ID),
                    tx.pure.string(input.name),
                    tx.pure.string(input.frameNo),
                    tx.pure.string(input.brand),
                    tx.pure.string(input.model),
                    tx.pure.string(input.frameMaterial),
                    tx.pure.u64(input.manufacturedYear),
                    tx.pure.string(imageUpload.cid),
                    tx.pure.string(manufacturerWarrantyUpload.cid),
                    tx.pure.string(metadataUpload.cid),
                    tx.pure.address(input.retailerAddress),
                    tx.object("0x6"),
                ],
            });

            return signAndExecuteTransaction({ transaction: tx }, options);
        },
        [signAndExecuteTransaction],
    );

    return { mintBike };
}

export function MintBikeNFTPage() {
    const { mintBike } = useMintBike();
    const appBaseUrl = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const bikeTraceBaseUrl = `${appBaseUrl}/biketrace?objectId=`;
    const [txDigest, setTxDigest] = useState<string | null>(null);
    const [objectID, setObjectID] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        frameNo: "",
        brand: "",
        model: "",
        frameMaterial: "",
        manufacturedYear: String(new Date().getFullYear()),
        retailerAddress: "",
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [manufacturerWarrantyFile, setManufacturerWarrantyFile] = useState<File | null>(null);
    const [parts, setParts] = useState([{ category: "", name: "" }]);

    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
    const setPart = (index: number, key: "category" | "name") => (e: React.ChangeEvent<HTMLInputElement>) => {
        setParts((prev) => prev.map((part, i) => (i === index ? { ...part, [key]: e.target.value } : part)));
    };

    const addPart = () => {
        setParts((prev) => [...prev, { category: "", name: "" }]);
    };

    const removePart = (index: number) => {
        setParts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    };

    return (
        <div className="mint-shell">
            <form
                className="mint-card"
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (!imageFile || !manufacturerWarrantyFile) return;

                    const validParts = parts.filter((part) => part.category.trim() && part.name.trim());
                    if (validParts.length === 0) return;

                    await mintBike(
                        {
                            ...form,
                            manufacturedYear: Number(form.manufacturedYear),
                            imageFile,
                            manufacturerWarrantyFile,
                            parts: validParts,
                        },
                        {
                            onSuccess: (result) => {
                                const bikeNft = result.objectChanges?.find(
                                    (c): c is Extract<IotaObjectChange, { type: "created" }> =>
                                        c.type === "created" && c.objectType.includes("::bike::BikeNFT"),
                                );
                                setTxDigest(result.digest);
                                setObjectID(bikeNft?.objectId ?? null);
                            },
                        },
                    );
                }}>
                <h2 className="mint-heading">鑄造自行車</h2>

                <div className="mint-grid">
                    <div className="mint-main-fields">
                        {(
                            [
                                ["name", "自行車名稱"],
                                ["frameNo", "車架號碼"],
                                ["brand", "品牌"],
                                ["model", "型號"],
                                ["frameMaterial", "車架材質"],
                                ["manufacturedYear", "製造年份"],
                                ["retailerAddress", "經銷商地址"],
                            ] as const
                        ).map(([key, label]) => (
                            <label key={key} className="mint-field">
                                {label}
                                <input type={key === "manufacturedYear" ? "number" : "text"} value={form[key]} onChange={set(key)} />
                            </label>
                        ))}

                        <label className="mint-field mint-file-field">
                            車輛圖片
                            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                        </label>

                        <label className="mint-field mint-file-field">
                            原廠保固檔案
                            <input type="file" accept=".pdf,image/*" onChange={(e) => setManufacturerWarrantyFile(e.target.files?.[0] ?? null)} />
                        </label>
                    </div>

                    <div className="mint-parts mint-parts-panel">
                        <div className="mint-parts-header">
                            <h3>零件清單</h3>
                            <button type="button" className="mint-add-part" onClick={addPart}>
                                新增零件
                            </button>
                        </div>

                        {parts.map((part, index) => (
                            <div className="mint-part-row" key={`part-${index}`}>
                                <input type="text" placeholder="零件類別" value={part.category} onChange={setPart(index, "category")} />
                                <input type="text" placeholder="零件名稱" value={part.name} onChange={setPart(index, "name")} />
                                <button type="button" className="mint-remove-part" onClick={() => removePart(index)} disabled={parts.length <= 1}>
                                    刪除
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <button className="mint-submit" type="submit">
                    確認鑄造
                </button>

                {objectID && (
                    <div className="mint-qr-block">
                        {txDigest && <p className="mint-status mint-success">成功，交易資訊: {txDigest}</p>}
                        <p className="mint-status mint-success">Object ID：{objectID}</p> <p className="mint-qr-title">自行車QR Code</p>
                        <QRCodeSVG value={`${bikeTraceBaseUrl}${encodeURIComponent(objectID)}`} size={160} />
                    </div>
                )}
            </form>
        </div>
    );
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .mint-shell {
	display: flex;
	justify-content: center;
  padding: 20px 12px;
	box-sizing: border-box;
  }

  .mint-card {
  width: min(100%, 1120px);
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

  .mint-heading {
	margin: 0 0 4px;
  }

  .mint-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
    gap: 16px;
    align-items: start;
  }

  .mint-main-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
  }

  .mint-main-fields .mint-file-field {
    grid-column: 1 / -1;
  }

  .mint-field {
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 14px;
  }

  .mint-field input {
	width: 100%;
	padding: 8px 10px;
	border: 1px solid #d1d5db;
	border-radius: 8px;
	box-sizing: border-box;
  }

  .mint-parts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mint-parts-panel {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 10px;
    max-height: 440px;
    overflow: auto;
  }

  .mint-parts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .mint-parts-header h3 {
    margin: 0;
    font-size: 15px;
  }

  .mint-add-part,
  .mint-remove-part {
    padding: 6px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
  }

  .mint-add-part:hover,
  .mint-remove-part:hover:not(:disabled) {
    background: #f8fafc;
  }

  .mint-part-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 8px;
  }

  .mint-part-row input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    box-sizing: border-box;
  }

  .mint-submit {
	margin-top: 4px;
	padding: 10px;
	border: 0;
	border-radius: 10px;
	background: #2563eb;
	color: #fff;
	cursor: pointer;
  }

  .mint-submit:disabled {
	opacity: 0.5;
	cursor: not-allowed;
  }

  .mint-status {
	margin: 0;
	font-size: 13px;
  }

  .mint-error { color: #dc2626; }
  .mint-success { color: #16a34a; }

  .mint-qr-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 0 4px;
  }

  .mint-qr-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
  }

  @media (max-width: 640px) {
    .mint-card {
      padding: 14px;
      border-radius: 14px;
    }

    .mint-grid {
      grid-template-columns: 1fr;
    }

    .mint-main-fields {
      grid-template-columns: 1fr;
    }

    .mint-part-row {
      grid-template-columns: 1fr;
    }

    .mint-parts-panel {
      max-height: none;
      padding: 8px;
    }

    .mint-parts-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .mint-add-part,
    .mint-remove-part {
      width: 100%;
    }
  }

  @media (min-width: 641px) and (max-width: 980px) {
    .mint-grid {
      grid-template-columns: 1fr;
    }

    .mint-main-fields {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mint-parts-panel {
      max-height: none;
    }
  }
`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
