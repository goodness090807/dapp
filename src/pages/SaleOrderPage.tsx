import { useEffect, useRef, useState } from "react";
import { useCurrentAccount, useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import BikeDataDisplay, { BikeDataDisplayStyles } from "../components/BikeDataDisplay";
import { getCIDUrl } from "../utils/cidHelper";
import type { BikeNFTContent } from "../utils/cidHelper";

export type SaleOrderInfo = {
    saleOrderObjectId: string;
    bikeId: string;
    createdAt: string;
    bikeContent: BikeNFTContent | null;
    dealerIdentityCid: string;
    certificateCid: string;
    dealerAddress: string;
    consumerAddress: string;
    dealerInfo: Record<string, unknown>;
};

const readFieldAsString = (fields: Record<string, unknown>, key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    const fieldKey = keys.find((item) => fields[item] != null);
    if (!fieldKey) return "";
    const value = fields[fieldKey];
    if (value == null) return "";
    return String(value);
};

const formatGeneralTimestamp = (timestamp: string) => {
    const num = Number(timestamp);
    if (!Number.isFinite(num)) return timestamp || "-";
    const normalized = num < 1e11 ? num * 1000 : num;
    return new Date(normalized).toLocaleString("zh-TW", { hour12: false });
};

const dealerFieldLabelMap: Record<string, string> = {
    name: "名稱",
    phone: "電話",
    location: "聯絡地址",
};

const toDealerFieldLabel = (key: string) => dealerFieldLabelMap[key.toLowerCase()] ?? key;

const SaleOrderPage = () => {
    const client = useIotaClient();
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const initialObjectIdFromUrl = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("saleOrderObjectId")?.trim() ?? "") : "";

    const [saleOrderObjectId, setSaleOrderObjectId] = useState(initialObjectIdFromUrl);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [result, setResult] = useState<SaleOrderInfo | null>(null);
    const hasAutoFetched = useRef(false);
    const explorerUrl = result?.saleOrderObjectId ? `https://explorer.iota.org/object/${result.saleOrderObjectId}?network=testnet` : "";

    const showCancelSaleOrderButton = !!result && !!account?.address && result.dealerAddress.toLowerCase() === account.address.toLowerCase();
    const showAcceptSaleOrderButton = !!result && !!account?.address && result.consumerAddress.toLowerCase() === account.address.toLowerCase();

    const fetchSaleOrderInfo = async (id: string) => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const saleOrder = await client.getObject({
                id,
                options: {
                    showContent: true,
                },
            });

            const saleContent = saleOrder.data?.content as any;
            const fields = ((saleContent as Record<string, unknown>)?.fields ?? {}) as Record<string, unknown>;
            const bikeId = readFieldAsString(fields, "bike_id");

            if (!bikeId) {
                return;
            }

            const bikeObject = await client.getObject({
                id: bikeId,
                options: {
                    showContent: true,
                },
            });
            const bikeContent = ((bikeObject.data?.content as { fields?: unknown } | undefined)?.fields ?? null) as BikeNFTContent | null;
            const dealerIdentityCid = readFieldAsString(fields, "dealer_identity_cid");
            const certificateCid = readFieldAsString(fields, "certificate_cid");
            const dealerAddress = readFieldAsString(fields, ["dealer", "retailer"]);
            const consumerAddress = readFieldAsString(fields, "consumer");
            const createdAt = formatGeneralTimestamp(readFieldAsString(fields, "created_at"));

            let dealerInfo: Record<string, unknown> = {};
            if (dealerIdentityCid) {
                try {
                    const url = getCIDUrl(dealerIdentityCid, import.meta.env.VITE_PINATA_GATEWAY);
                    const response = await fetch(url);
                    dealerInfo = (await response.json()) as Record<string, unknown>;
                } catch {
                    dealerInfo = {};
                }
            }

            setResult({
                saleOrderObjectId: id,
                bikeId,
                createdAt,
                bikeContent,
                dealerIdentityCid,
                certificateCid,
                dealerAddress,
                consumerAddress,
                dealerInfo,
            });
        } catch {
            setResult(null);
            // Clear current UI when object is not found or parsing fails.
        } finally {
            setIsLoading(false);
        }
    };

    const cancelSaleOrder = async (saleOrder: SaleOrderInfo) => {
        const bike = await client.getObject({
            id: saleOrder.bikeId,
            options: { showContent: true },
        });

        const bikeRef = {
            objectId: bike.data?.objectId!,
            version: bike.data?.version!,
            digest: bike.data?.digest!,
        };

        const tx = new Transaction();
        tx.moveCall({
            target: `${import.meta.env.VITE_PACKAGE_ID}::bike::cancel_sale_order`,
            arguments: [tx.object(saleOrder.saleOrderObjectId), tx.receivingRef(bikeRef)],
        });

        const result = await signAndExecuteTransaction({ transaction: tx });
        return result;
    };

    const acceptSaleOrder = async (saleOrder: SaleOrderInfo) => {
        const bike = await client.getObject({
            id: saleOrder.bikeId,
            options: { showContent: true },
        });
        const bikeRef = {
            objectId: bike.data?.objectId!,
            version: bike.data?.version!,
            digest: bike.data?.digest!,
        };

        const tx = new Transaction();
        tx.moveCall({
            target: `${import.meta.env.VITE_PACKAGE_ID}::bike::claim_sale`,
            arguments: [tx.object(saleOrder.saleOrderObjectId), tx.receivingRef(bikeRef), tx.object("0x6")],
        });

        const result = await signAndExecuteTransaction({ transaction: tx });
        return result;
    };

    const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const id = saleOrderObjectId.trim();
        setActionMessage(null);
        if (!id) {
            return;
        }

        await fetchSaleOrderInfo(id);
    };

    useEffect(() => {
        if (!initialObjectIdFromUrl || hasAutoFetched.current) {
            return;
        }

        hasAutoFetched.current = true;
        void fetchSaleOrderInfo(initialObjectIdFromUrl);
    }, [initialObjectIdFromUrl]);

    return (
        <div className="so-shell">
            <form className="so-card" onSubmit={onSubmit}>
                <h2 className="so-heading">銷售單查詢</h2>

                <label className="so-field">
                    SaleOrder ObjectID
                    <input value={saleOrderObjectId} onChange={(e) => setSaleOrderObjectId(e.target.value)} placeholder="0x..." autoComplete="off" />
                </label>

                <div className="so-actions">
                    <button className="so-submit" type="submit" disabled={isLoading}>
                        查詢
                    </button>
                    {showCancelSaleOrderButton && (
                        <button
                            className="so-submit so-cancel"
                            type="button"
                            onClick={async () => {
                                const txResult = await cancelSaleOrder(result);
                                setActionMessage(`取消銷售成功，交易資訊: ${txResult.digest}`);
                                await fetchSaleOrderInfo(result.saleOrderObjectId);
                            }}>
                            取消銷售
                        </button>
                    )}
                    {showAcceptSaleOrderButton && (
                        <button
                            className="so-submit so-accept"
                            type="button"
                            onClick={async () => {
                                const txResult = await acceptSaleOrder(result);
                                setActionMessage(`接受銷售成功，交易資訊: ${txResult.digest}`);
                                await fetchSaleOrderInfo(result.saleOrderObjectId);
                            }}>
                            接受銷售
                        </button>
                    )}
                </div>

                {error && <p className="so-status so-error">{error}</p>}
                {actionMessage && <p className="so-status so-success">{actionMessage}</p>}

                {!isLoading && !error && result && (
                    <div className="so-result">
                        <div className="so-result-header">
                            <h3 className="so-result-title">銷售單資訊</h3>
                            {explorerUrl && (
                                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="so-chain-link">
                                    查看鏈上
                                </a>
                            )}
                        </div>
                        <div className="so-sale-info-container">
                            <div className="so-store-info">
                                <div className="so-address-details">
                                    <p>
                                        <span className="so-label">建立時間:</span> {result.createdAt || "-"}
                                    </p>
                                    <p>
                                        <span className="so-label">經銷商地址:</span> {result.dealerAddress || "-"}
                                    </p>
                                    <p>
                                        <span className="so-label">消費者地址:</span> {result.consumerAddress || "-"}
                                    </p>
                                </div>

                                <p>
                                    <strong>經銷商資訊:</strong>
                                </p>
                                {Object.entries(result.dealerInfo).length > 0 ? (
                                    <div className="so-retailer-details">
                                        {Object.entries(result.dealerInfo).map(([key, value]) => (
                                            <p key={key}>
                                                <span className="so-label">{toDealerFieldLabel(key)}:</span> {String(value) || "-"}
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="so-status">無店家資訊</p>
                                )}
                            </div>

                            <div className="so-cert-container">
                                <p>
                                    <strong>保固資訊:</strong>
                                </p>
                                {result.certificateCid ? (
                                    <img src={`https://gateway.pinata.cloud/ipfs/${result.certificateCid}`} alt="保固資訊" className="so-certificate-img" />
                                ) : (
                                    <p className="so-status">無保固資訊</p>
                                )}
                            </div>
                        </div>

                        <div className="so-bike-info">
                            <p>
                                <strong>自行車資訊:</strong>
                            </p>
                            {result.bikeContent ? (
                                <BikeDataDisplay content={result.bikeContent} objectId={result.bikeId} />
                            ) : (
                                <p className="so-status">無自行車資訊</p>
                            )}
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
	.so-shell {
		display: flex;
		justify-content: center;
		padding: 24px 12px;
		box-sizing: border-box;
	}

	.so-card {
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

	.so-heading {
		margin: 0;
	}

    .so-result-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
    }

	.so-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
	}

	.so-field input {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		box-sizing: border-box;
	}

	.so-actions {
		width: 100%;
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

    .so-chain-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: #eef6ff;
        color: #1d4ed8;
        font-size: 13px;
        font-weight: 600;
        text-decoration: none;
    }

    .so-chain-link:hover {
        background: #dbeafe;
    }

	.so-submit {
		width: fit-content;
		padding: 10px 14px;
		border: none;
		border-radius: 10px;
		background: #2563eb;
		color: #fff;
		font-size: 14px;
		cursor: pointer;
	}

    .so-cancel {
        background: #dc2626;
    }

    .so-accept {
        background: #16a34a;
    }

	.so-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.so-status {
		margin: 0;
		font-size: 13px;
	}

	.so-error {
		color: #dc2626;
	}

    .so-success {
        color: #16a34a;
    }

	.so-result {
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.so-result-title {
		margin: 0;
		font-size: 15px;
	}

	.so-result p {
		margin: 0;
	}

	.so-sale-info-container {
		display: flex;
		gap: 15px;
		margin-top: 8px;
	}

	.so-store-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

    .so-address-details {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .so-address-details p {
        margin: 0;
        font-size: 13px;
        line-height: 1.4;
        word-break: break-word;
    }

	.so-retailer-details {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.so-retailer-details p {
		margin: 0;
		font-size: 13px;
		line-height: 1.4;
		word-break: break-word;
	}

	.so-label {
		color: #6b7280;
		font-weight: 500;
	}

	.so-cert-container {
		flex: 0 0 380px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

    .so-bike-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    }

	.so-certificate-img {
		width: 100%;
		height: auto;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	@media (max-width: 920px) {
		.so-sale-info-container {
			flex-direction: column;
		}

		.so-cert-container {
			flex: initial;
		}
	}
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

if (!document.adoptedStyleSheets.includes(BikeDataDisplayStyles)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, BikeDataDisplayStyles];
}

export default SaleOrderPage;
