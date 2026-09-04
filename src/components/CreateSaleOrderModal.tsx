import { useState } from "react";
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import type { IotaObjectChange } from "@iota/iota-sdk/client";
import { PinataSDK } from "pinata";
import { QRCodeSVG } from "qrcode.react";

type CreateSaleOrderModalProps = {
    bikeObjectId: string;
    onSuccess?: () => Promise<void> | void;
};

const CreateSaleOrderModal = ({ bikeObjectId, onSuccess }: CreateSaleOrderModalProps) => {
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [consumerAddress, setConsumerAddress] = useState("");
    const [certificateFile, setCertificateFile] = useState<File | null>(null);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [saleOrderObjectId, setSaleOrderObjectId] = useState<string | null>(null);
    const appBaseUrl = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const saleOrderUrl = saleOrderObjectId ? `${appBaseUrl}/saleorder?saleOrderObjectId=${encodeURIComponent(saleOrderObjectId)}` : "";

    const onCreateSaleOrder = async () => {
        setIsSubmitting(true);
        setStatus(null);

        const pinata = new PinataSDK({ pinataJwt: import.meta.env.VITE_PINATA_JWT });
        const imageUpload = await pinata.upload.public.file(certificateFile!);

        const tx = new Transaction();
        tx.moveCall({
            target: `${import.meta.env.VITE_PACKAGE_ID}::bike::create_sale_order`,
            arguments: [
                tx.object(import.meta.env.VITE_REGISTRY_ID),
                tx.object(bikeObjectId),
                tx.pure.address(consumerAddress),
                tx.pure.string(imageUpload.cid),
                tx.object("0x6"),
            ],
        });

        const txResult = await signAndExecuteTransaction({ transaction: tx });

        const saleOrder = txResult.objectChanges?.find(
            (c): c is Extract<IotaObjectChange, { type: "created" }> => c.type === "created" && c.objectType.includes("::bike::SaleOrder"),
        );
        setSaleOrderObjectId(saleOrder?.objectId ?? null);

        setStatus({ type: "success", message: `成功，交易資訊: ${txResult.digest}` });

        setIsSubmitting(false);
    };

    return (
        <>
            <button className="trace-sell-btn" type="button" onClick={() => setIsOpen(true)}>
                建立銷售
            </button>

            {isOpen && (
                <div className="trace-modal-overlay" role="dialog" aria-modal="true" aria-label="建立銷售資訊">
                    <div className="trace-modal-card">
                        <h3 className="trace-modal-title">建立銷售</h3>
                        <label className="trace-field">
                            買家地址
                            <input
                                className="trace-sale-input"
                                value={consumerAddress}
                                onChange={(e) => setConsumerAddress(e.target.value)}
                                placeholder="0x..."
                                autoComplete="off"
                            />
                        </label>
                        <label className="trace-field">
                            保固資訊
                            <input
                                className="trace-sale-input"
                                type="file"
                                accept=".png,.svg"
                                onChange={(e) => setCertificateFile(e.target.files ? e.target.files[0] : null)}
                                autoComplete="off"
                            />
                        </label>

                        {status && <p className={`trace-status ${status.type === "error" ? "trace-error" : "trace-success"}`}>{status.message}</p>}

                        {saleOrderObjectId && (
                            <div className="trace-sale-qr-wrap">
                                <p className="trace-sale-qr-title">Object ID：{saleOrderObjectId}</p>
                                <p className="trace-sale-qr-title">銷售單 QR Code</p>
                                <QRCodeSVG value={saleOrderUrl} size={140} />
                            </div>
                        )}

                        <div className="trace-modal-actions">
                            <button className="trace-cancel-btn" type="button" onClick={async () => await onSuccess?.()} disabled={isSubmitting}>
                                取消
                            </button>
                            <button className="trace-sell-btn" type="button" onClick={onCreateSaleOrder} disabled={isSubmitting}>
                                確認建立
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

    .trace-sale-qr-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    .trace-sale-qr-title {
        margin: 0;
        font-size: 13px;
        color: #374151;
    }

    .trace-sale-qr-link {
        margin: 0;
        font-size: 11px;
        color: #2563eb;
        word-break: break-all;
        text-align: center;
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

    .trace-sell-btn:disabled,
    .trace-cancel-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`);
if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

export default CreateSaleOrderModal;
