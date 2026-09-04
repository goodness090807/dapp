import { useEffect, useRef, useState } from "react";
import { useCurrentAccount, useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { getCIDUrl } from "../utils/cidHelper";

type TicketInfo = {
    ticketObjectId: string;
    bikeId: string;
    retailerAddress: string;
    consumerAddress: string;
    description: string;
    metadataCid: string;
    state: string;
    createdAt: string;
    updatedAt: string;
};

const readFieldAsString = (fields: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
        const value = fields[key];
        if (value != null && String(value).trim() !== "") {
            return String(value);
        }
    }
    return "";
};

const formatTimestamp = (value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return "-";
    return new Date(num).toLocaleString("zh-TW");
};

const QueryMaintenancePage = () => {
    const client = useIotaClient();
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const initialObjectIdFromUrl = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("ticketObjectId")?.trim() ?? "") : "";

    const [ticketObjectId, setTicketObjectId] = useState(initialObjectIdFromUrl);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<TicketInfo | null>(null);
    const [parts, setParts] = useState<Array<Record<string, unknown>>>([]);
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const hasAutoFetched = useRef(false);

    const explorerUrl = result?.ticketObjectId ? `https://explorer.iota.org/object/${result.ticketObjectId}?network=testnet` : "";
    const showCancelMaintenanceButton =
        !!result && !!account?.address && !!result.retailerAddress && result.retailerAddress.toLowerCase() === account.address.toLowerCase();
    const showAcceptMaintenanceButton =
        !!result && !!account?.address && !!result.consumerAddress && result.consumerAddress.toLowerCase() === account.address.toLowerCase();

    const fetchTicketInfo = async (id: string, options?: { preserveActionMessage?: boolean }) => {
        const preserveActionMessage = options?.preserveActionMessage ?? false;
        setIsLoading(true);
        setError(null);
        setResult(null);
        setParts([]);
        if (!preserveActionMessage) {
            setActionMessage(null);
        }

        try {
            const ticket = await client.getObject({
                id,
                options: {
                    showContent: true,
                    showType: true,
                },
            });

            const content = ticket.data?.content as { fields?: Record<string, unknown> } | undefined;
            const fields = (content?.fields ?? {}) as Record<string, unknown>;

            if (!ticket.data || !content || Object.keys(fields).length === 0) {
                return;
            }

            const bikeId = readFieldAsString(fields, ["bike_id", "bikeId"]);
            const retailerAddress = readFieldAsString(fields, ["dealer", "dealer_address", "shop", "shop_address"]);
            const consumerAddress = readFieldAsString(fields, ["consumer", "consumer_address", "owner", "owner_address"]);
            const description = readFieldAsString(fields, ["description", "note", "repair_type"]);
            const metadataCid = readFieldAsString(fields, ["new_metadata_cid", "newMetadataCid", "metadata_cid", "metadataCid"]);
            const state = readFieldAsString(fields, ["state", "status"]);
            const createdAt = readFieldAsString(fields, ["created_at", "createdAt", "issued_at"]);
            const updatedAt = readFieldAsString(fields, ["updated_at", "updatedAt", "completed_at"]);

            if (!bikeId) {
                return;
            }

            setResult({
                ticketObjectId: id,
                bikeId,
                retailerAddress,
                consumerAddress,
                description,
                metadataCid,
                state,
                createdAt,
                updatedAt,
            });

            if (metadataCid && import.meta.env.VITE_PINATA_GATEWAY) {
                try {
                    const url = getCIDUrl(metadataCid, import.meta.env.VITE_PINATA_GATEWAY);
                    const response = await fetch(url);
                    const metadata = (await response.json()) as unknown;
                    setParts(Array.isArray(metadata) ? (metadata as Array<Record<string, unknown>>) : []);
                } catch {
                    setParts([]);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "查詢維修單失敗");
        } finally {
            setIsLoading(false);
        }
    };

    const cancelMaintenance = async (ticket: TicketInfo) => {
        const tx = new Transaction();
        tx.moveCall({
            target: import.meta.env.VITE_MAINTENANCE_CANCEL_FUNCTION || `${import.meta.env.VITE_PACKAGE_ID}::maintenance::cancel_ticket`,
            arguments: [tx.object(ticket.ticketObjectId)],
        });

        return await signAndExecuteTransaction({ transaction: tx });
    };

    const acceptMaintenance = async (ticket: TicketInfo) => {
        const tx = new Transaction();
        tx.moveCall({
            target: import.meta.env.VITE_MAINTENANCE_ACCEPT_FUNCTION || `${import.meta.env.VITE_PACKAGE_ID}::maintenance::accept_ticket`,
            arguments: [tx.object(ticket.bikeId), tx.object(ticket.ticketObjectId), tx.object("0x6")],
        });

        return await signAndExecuteTransaction({ transaction: tx });
    };

    const handleCancelMaintenance = async () => {
        if (!result) return;
        setActionMessage(null);
        setIsSubmittingAction(true);

        try {
            const txResult = await cancelMaintenance(result);
            const digest = String(txResult.digest ?? "");
            setActionMessage(`取消維修成功，交易資訊: ${digest || "交易已送出"}`);
            await fetchTicketInfo(result.ticketObjectId, { preserveActionMessage: true });
        } catch (err) {
            setActionMessage(err instanceof Error ? `取消維修失敗: ${err.message}` : "取消維修失敗");
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleAcceptMaintenance = async () => {
        if (!result) return;
        setActionMessage(null);
        setIsSubmittingAction(true);

        try {
            const txResult = await acceptMaintenance(result);
            const digest = String(txResult.digest ?? "");
            setActionMessage(`接受維修成功，交易資訊: ${digest || "交易已送出"}`);
            await fetchTicketInfo(result.ticketObjectId, { preserveActionMessage: true });
        } catch (err) {
            setActionMessage(err instanceof Error ? `接受維修失敗: ${err.message}` : "接受維修失敗");
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const id = ticketObjectId.trim();
        if (!id) {
            setResult(null);
            setError(null);
            setParts([]);
            setActionMessage(null);
            return;
        }

        await fetchTicketInfo(id);
    };

    useEffect(() => {
        if (!initialObjectIdFromUrl || hasAutoFetched.current) {
            return;
        }

        hasAutoFetched.current = true;
        void fetchTicketInfo(initialObjectIdFromUrl);
    }, [initialObjectIdFromUrl]);

    return (
        <div className="mq-shell">
            <form className="mq-card" onSubmit={onSubmit}>
                <h2 className="mq-heading">維修單查詢</h2>

                <label className="mq-field">
                    Ticket ObjectID
                    <input value={ticketObjectId} onChange={(e) => setTicketObjectId(e.target.value)} placeholder="0x..." autoComplete="off" />
                </label>

                <div className="mq-actions">
                    <button className="mq-submit" type="submit" disabled={isLoading}>
                        {isLoading ? "查詢中..." : "查詢"}
                    </button>
                    {showCancelMaintenanceButton && (
                        <button className="mq-submit mq-cancel" type="button" onClick={handleCancelMaintenance} disabled={isSubmittingAction || isLoading}>
                            取消維修
                        </button>
                    )}
                    {showAcceptMaintenanceButton && (
                        <button className="mq-submit mq-accept" type="button" onClick={handleAcceptMaintenance} disabled={isSubmittingAction || isLoading}>
                            接受維修
                        </button>
                    )}
                </div>

                {error && <p className="mq-status mq-error">{error}</p>}
                {actionMessage && <p className="mq-status mq-success">{actionMessage}</p>}

                {!isLoading && !error && result && (
                    <div className="mq-result">
                        <div className="mq-result-header">
                            <h3 className="mq-result-title">維修單資訊</h3>
                            {explorerUrl && (
                                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="mq-chain-link">
                                    查看鏈上
                                </a>
                            )}
                        </div>

                        <div className="mq-grid">
                            <p>
                                <span className="mq-label">維修單 ID:</span> {result.ticketObjectId || "-"}
                            </p>
                            <p>
                                <span className="mq-label">自行車 ID:</span> {result.bikeId || "-"}
                            </p>
                            <p>
                                <span className="mq-label">維修經銷商:</span> {result.retailerAddress || "-"}
                            </p>
                            <p>
                                <span className="mq-label">車主:</span> {result.consumerAddress || "-"}
                            </p>
                            <p>
                                <span className="mq-label">建立時間:</span> {formatTimestamp(result.createdAt)}
                            </p>
                        </div>

                        <div className="mq-block">
                            <p className="mq-subtitle">維修描述</p>
                            <p className="mq-description">{result.description || "-"}</p>
                        </div>

                        <div className="mq-block">
                            <p className="mq-subtitle">預計變更後的零件資訊</p>
                            {parts.length > 0 ? (
                                <div className="mq-parts-list">
                                    {parts.map((part, index) => (
                                        <div className="mq-part-item" key={`maintenance-part-${index}`}>
                                            <span className="mq-part-category">{String(part.category ?? "-")}</span>
                                            <span className="mq-part-name">{String(part.name ?? "-")}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mq-empty">無零件資訊</p>
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
	.mq-shell {
		display: flex;
		justify-content: center;
		padding: 24px 12px;
		box-sizing: border-box;
	}

	.mq-card {
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

	.mq-heading {
		margin: 0;
	}

	.mq-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
	}

	.mq-field input {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		box-sizing: border-box;
	}

	.mq-actions {
		display: flex;
		gap: 8px;
	}

	.mq-submit {
		width: fit-content;
		padding: 10px 14px;
		border: none;
		border-radius: 10px;
		background: #2563eb;
		color: #fff;
		font-size: 14px;
		cursor: pointer;
	}

	.mq-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

    .mq-cancel {
        background: #dc2626;
    }

    .mq-accept {
        background: #16a34a;
    }

	.mq-status {
		margin: 0;
		font-size: 13px;
	}

    .mq-tx-link {
        color: #1d4ed8;
        font-weight: 600;
        text-decoration: none;
    }

    .mq-tx-link:hover {
        text-decoration: underline;
    }

	.mq-error {
		color: #dc2626;
	}

    .mq-success {
        color: #16a34a;
    }

	.mq-result {
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.mq-result-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.mq-result-title {
		margin: 0;
		font-size: 15px;
	}

	.mq-chain-link {
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

	.mq-chain-link:hover {
		background: #dbeafe;
	}

	.mq-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px 14px;
	}

	.mq-grid p {
		margin: 0;
		font-size: 13px;
		word-break: break-word;
	}

	.mq-label {
		color: #6b7280;
		font-weight: 600;
	}

	.mq-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mq-subtitle {
		margin: 0;
		font-size: 13px;
		font-weight: 700;
		color: #111827;
	}

	.mq-description,
	.mq-empty {
		margin: 0;
		font-size: 13px;
		color: #374151;
	}

	.mq-parts-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.mq-part-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: #fafafa;
		min-width: 0;
	}

	.mq-part-category {
		font-size: 11px;
		color: #1d4ed8;
		font-weight: 600;
	}

	.mq-part-name {
		font-size: 12px;
		color: #111827;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.mq-grid {
			grid-template-columns: 1fr;
		}

		.mq-parts-list {
			grid-template-columns: 1fr;
		}
	}
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

export default QueryMaintenancePage;
