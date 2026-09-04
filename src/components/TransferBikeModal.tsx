import { useState } from "react";
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";

type TransferBikeModalProps = {
    bikeObjectId: string;
    onSuccess?: () => Promise<void> | void;
    showTrigger?: boolean;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
};

const TransferBikeModal = ({ bikeObjectId, onSuccess, showTrigger = true, isOpen: controlledIsOpen, onOpenChange }: TransferBikeModalProps) => {
    const client = useIotaClient();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) =>
            await client.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showRawEffects: true,
                },
            }),
    });

    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [recipient, setRecipient] = useState("");
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const isModalOpen = typeof controlledIsOpen === "boolean" ? controlledIsOpen : internalIsOpen;
    const setOpen = (open: boolean) => {
        if (typeof controlledIsOpen !== "boolean") {
            setInternalIsOpen(open);
        }
        onOpenChange?.(open);
    };

    const close = () => {
        setOpen(false);
    };

    const transferBike = async () => {
        const recipientAddress = recipient.trim();
        if (!recipientAddress) {
            setStatus({ type: "error", message: "請輸入接收者地址。" });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
            const tx = new Transaction();
            tx.moveCall({
                target: `${import.meta.env.VITE_PACKAGE_ID}::bike::transfer_bike`,
                arguments: [tx.object(bikeObjectId), tx.pure.address(recipientAddress)],
            });

            const txResult = await signAndExecuteTransaction({ transaction: tx });
            setStatus({ type: "success", message: `移轉成功，交易資訊: ${txResult.digest}` });
            await onSuccess?.();
        } catch (error) {
            setStatus({ type: "error", message: error instanceof Error ? error.message : "移轉失敗" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {showTrigger && (
                <button className="trace-transfer-btn" type="button" onClick={() => setOpen(true)}>
                    移轉
                </button>
            )}

            {isModalOpen && (
                <div className="trace-modal-overlay" role="dialog" aria-modal="true" aria-label="移轉自行車 NFT">
                    <div className="trace-modal-card">
                        <h3 className="trace-modal-title">移轉自行車</h3>

                        <label className="trace-field">
                            接收者地址
                            <input
                                className="trace-sale-input"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="0x..."
                                autoComplete="off"
                            />
                        </label>

                        {status && <p className={`trace-status ${status.type === "error" ? "trace-error" : "trace-success"}`}>{status.message}</p>}

                        <div className="trace-modal-actions">
                            <button className="trace-cancel-btn" type="button" onClick={close} disabled={isSubmitting}>
                                關閉
                            </button>
                            <button className="trace-transfer-btn" type="button" onClick={transferBike} disabled={isSubmitting}>
                                確認移轉
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    .trace-sale-input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-sizing: border-box;
    }

    .trace-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 16px;
        z-index: 1000;
    }

    .trace-modal-card {
        width: min(100%, 520px);
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.24);
        box-sizing: border-box;
    }

    .trace-modal-title {
        margin: 0;
        font-size: 18px;
    }

    .trace-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }

    .trace-cancel-btn {
        width: fit-content;
        padding: 10px 14px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        background: #ffffff;
        color: #0f172a;
        font-size: 14px;
        cursor: pointer;
    }

    .trace-transfer-btn {
        width: fit-content;
        padding: 10px 14px;
        border: none;
        border-radius: 10px;
        background: #0f766e;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
    }

    .trace-transfer-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .trace-cancel-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

export default TransferBikeModal;
