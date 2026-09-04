import { useState } from "react";
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PinataSDK } from "pinata";
import { QRCodeSVG } from "qrcode.react";
import { getCIDUrl } from "../utils/cidHelper";

export type TicketPartItem = {
    category: string;
    name: string;
};

type CreateTicketModalProps = {
    bikeId: string;
    metadataCid: string;
    consumerAddress: string;
    onSuccess?: (digest: string) => Promise<void> | void;
};

const emptyPart = (): TicketPartItem => ({ category: "", name: "" });

const CreateTicketModal = ({ bikeId, metadataCid, consumerAddress, onSuccess }: CreateTicketModalProps) => {
    const client = useIotaClient();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
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

    const [isOpen, setIsOpen] = useState(false);
    const [isFetchingParts, setIsFetchingParts] = useState(false);
    const [bikeIdInput, setBikeIdInput] = useState("");
    const [description, setDescription] = useState("");
    const [parts, setParts] = useState<TicketPartItem[]>([emptyPart()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [ticketObjectId, setTicketObjectId] = useState<string | null>(null);
    const [qrValue, setQrValue] = useState<string | null>(null);
    const appBaseUrl = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

    const fetchPartsFromMetadata = async (): Promise<TicketPartItem[]> => {
        const gateway = import.meta.env.VITE_PINATA_GATEWAY;
        if (!metadataCid || !gateway) return [emptyPart()];
        try {
            const url = getCIDUrl(metadataCid, gateway);
            const response = await fetch(url);
            const metadata = (await response.json()) as unknown;
            if (!Array.isArray(metadata)) return [emptyPart()];
            const mapped = metadata
                .map((item) => {
                    const part = item as Record<string, unknown>;
                    return {
                        category: String(part.category ?? "").trim(),
                        name: String(part.name ?? "").trim(),
                    };
                })
                .filter((part) => part.category && part.name);
            return mapped.length > 0 ? mapped : [emptyPart()];
        } catch {
            return [emptyPart()];
        }
    };

    const open = async () => {
        setStatus(null);
        setTicketObjectId(null);
        setQrValue(null);
        setDescription("");
        setBikeIdInput(bikeId ?? "");
        setIsFetchingParts(true);
        const fetched = await fetchPartsFromMetadata();
        setParts(fetched);
        setIsFetchingParts(false);
        setIsOpen(true);
    };

    const close = () => setIsOpen(false);

    const updatePart = (index: number, key: keyof TicketPartItem, value: string) => {
        setParts((prev) => prev.map((part, idx) => (idx === index ? { ...part, [key]: value } : part)));
    };

    const addPart = () => setParts((prev) => [...prev, emptyPart()]);
    const removePart = (index: number) => {
        setParts((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((_, idx) => idx !== index);
        });
    };

    const submit = async () => {
        setStatus(null);
        const cleanedBikeId = bikeIdInput.trim();
        const cleanedConsumer = consumerAddress.trim();
        const cleanedDescription = description.trim();

        const validParts = parts.map((part) => ({ category: part.category.trim(), name: part.name.trim() })).filter((part) => part.category && part.name);

        try {
            setIsSubmitting(true);

            const pinata = new PinataSDK({ pinataJwt: import.meta.env.VITE_PINATA_JWT });
            const metadataUpload = await pinata.upload.public.json(validParts);

            const tx = new Transaction();
            tx.moveCall({
                target: `${import.meta.env.VITE_PACKAGE_ID}::maintenance::create_ticket`,
                arguments: [
                    tx.object(import.meta.env.VITE_REGISTRY_ID),
                    tx.pure.id(cleanedBikeId),
                    tx.pure.address(cleanedConsumer),
                    tx.pure.string(cleanedDescription),
                    tx.pure.string(metadataUpload.cid),
                    tx.object("0x6"),
                ],
            });

            const txResult = await signAndExecuteTransaction({ transaction: tx });
            const createdTicket = (txResult.objectChanges ?? [])
                .map((c) => c as unknown as Record<string, unknown>)
                .find(
                    (c) =>
                        String(c.type ?? "") === "created" &&
                        String(c.objectType ?? "").includes("::maintenance::") &&
                        String(c.objectType ?? "")
                            .toLowerCase()
                            .includes("ticket"),
                );
            const ticketObjectId = String(createdTicket?.objectId ?? "");
            setTicketObjectId(ticketObjectId || null);
            const qr = ticketObjectId
                ? `${appBaseUrl}/maintenance?ticketObjectId=${encodeURIComponent(ticketObjectId)}`
                : `https://explorer.iota.org/transaction/${encodeURIComponent(txResult.digest)}?network=testnet`;

            setQrValue(qr);
            setStatus({ type: "success", message: `建立維修單成功，交易資訊: ${txResult.digest}` });
            await onSuccess?.(txResult.digest);
        } catch (error) {
            setStatus({ type: "error", message: error instanceof Error ? error.message : "送出維修資料失敗" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <button className="trace-submit trace-submit-accept" type="button" onClick={open} disabled={isFetchingParts}>
                {isFetchingParts ? "載入中..." : "填寫維修"}
            </button>

            {isOpen && (
                <div className="ticket-modal-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="填寫維修">
                    <div className="ticket-modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3 className="ticket-modal-title">填寫維修</h3>

                        <label className="ticket-field">
                            bike_id
                            <input value={bikeIdInput} onChange={(e) => setBikeIdInput(e.target.value)} placeholder="0x..." autoComplete="off" />
                        </label>

                        <div className="ticket-parts-block">
                            <div className="ticket-parts-header">
                                <span>零件清單 (可調整)</span>
                                <button className="ticket-add-part" type="button" onClick={addPart}>
                                    + 新增零件
                                </button>
                            </div>

                            {parts.map((part, index) => (
                                <div className="ticket-part-row" key={`ticket-part-${index}`}>
                                    <input
                                        value={part.category}
                                        onChange={(e) => updatePart(index, "category", e.target.value)}
                                        placeholder="分類 (category)"
                                        autoComplete="off"
                                    />
                                    <input
                                        value={part.name}
                                        onChange={(e) => updatePart(index, "name", e.target.value)}
                                        placeholder="名稱 (name)"
                                        autoComplete="off"
                                    />
                                    <button type="button" className="ticket-remove-part" onClick={() => removePart(index)} disabled={parts.length <= 1}>
                                        刪除
                                    </button>
                                </div>
                            ))}
                        </div>

                        <label className="ticket-field">
                            維修描述 (description) *
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="請輸入維修內容，例如更換煞車皮與鍊條校正"
                                rows={4}
                            />
                        </label>

                        {status && <p className={`ticket-status ${status.type === "error" ? "ticket-error" : "ticket-success"}`}>{status.message}</p>}

                        {qrValue && (
                            <div className="ticket-qr-wrap">
                                {ticketObjectId && <p className="ticket-qr-value">Object ID：{ticketObjectId}</p>}
                                <p className="ticket-qr-title">維修單 QR Code</p>
                                <QRCodeSVG value={qrValue} size={140} />
                            </div>
                        )}

                        <div className="ticket-actions">
                            <button className="ticket-cancel-btn" type="button" onClick={close} disabled={isSubmitting}>
                                取消
                            </button>
                            <button className="ticket-submit-btn" type="button" onClick={submit} disabled={isSubmitting}>
                                確認建立
                            </button>
                        </div>
                    </div>
                    <style>{styles}</style>
                </div>
            )}
        </>
    );
};

const styles = `
	.ticket-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 16px;
		z-index: 1000;
	}

	.ticket-modal-card {
		width: min(100%, 640px);
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		border-radius: 12px;
		background: #ffffff;
		box-shadow: 0 16px 40px rgba(15, 23, 42, 0.24);
		box-sizing: border-box;
		max-height: 88vh;
		overflow-y: auto;
	}

	.ticket-modal-title {
		margin: 0;
		font-size: 18px;
	}

	.ticket-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
	}

	.ticket-field input,
	.ticket-field textarea,
	.ticket-part-row input {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		box-sizing: border-box;
		font-size: 14px;
		font-family: inherit;
	}

	.ticket-field textarea {
		resize: vertical;
		min-height: 88px;
	}

	.ticket-parts-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		padding: 10px;
		background: #fafafa;
	}

	.ticket-parts-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #334155;
		font-weight: 600;
	}

	.ticket-add-part,
	.ticket-remove-part {
		border: 1px solid #cbd5e1;
		background: #fff;
		color: #0f172a;
		border-radius: 8px;
		padding: 6px 10px;
		font-size: 12px;
		cursor: pointer;
		white-space: nowrap;
	}

	.ticket-remove-part:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ticket-part-row {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 8px;
	}

	.ticket-status {
		margin: 0;
		font-size: 13px;
	}

	.ticket-error {
		color: #dc2626;
	}

	.ticket-success {
		color: #16a34a;
	}

	.ticket-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

    .ticket-qr-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 10px;
        border: 1px dashed #cbd5e1;
        border-radius: 10px;
        background: #f8fafc;
    }

    .ticket-qr-title {
        margin: 0;
        font-size: 13px;
        color: #334155;
        font-weight: 600;
    }

    .ticket-qr-value {
        margin: 0;
        font-size: 11px;
        color: #64748b;
        word-break: break-all;
        text-align: center;
    }

    .ticket-qr-link {
        margin: 0;
        font-size: 11px;
        color: #2563eb;
        word-break: break-all;
        text-align: center;
    }

	.ticket-cancel-btn,
	.ticket-submit-btn {
		width: fit-content;
		padding: 10px 14px;
		border-radius: 10px;
		font-size: 14px;
		cursor: pointer;
		border: none;
	}

	.ticket-cancel-btn {
		border: 1px solid #d1d5db;
		background: #ffffff;
		color: #0f172a;
	}

	.ticket-submit-btn {
		background: #16a34a;
		color: #ffffff;
	}

	.ticket-cancel-btn:disabled,
	.ticket-submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.ticket-part-row {
			grid-template-columns: 1fr;
		}
	}
`;

export default CreateTicketModal;
