import { useEffect, useRef, useState } from "react";
import { useCurrentAccount, useIotaClient } from "@iota/dapp-kit";
import { shouldShowSellButton } from "../utils/util.ts";
import type { BikeObjectData } from "../utils/util.ts";
import CreateSaleOrderModal from "../components/CreateSaleOrderModal.tsx";
import CreateTicketModal from "../components/CreateTicketModal.tsx";
import TransferBikeModal from "../components/TransferBikeModal.tsx";
import BikeDataDisplay, { BikeDataDisplayStyles } from "../components/BikeDataDisplay.tsx";
import type { BikeNFTContent } from "../utils/cidHelper.ts";
import { Transaction } from "@iota/iota-sdk/transactions";

const BikeTracePage = () => {
    const client = useIotaClient();
    const account = useCurrentAccount();
    const initialObjectIdFromUrl = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("objectId")?.trim() ?? "") : "";
    const [objectId, setObjectId] = useState(initialObjectIdFromUrl);
    const [showMaintenanceButton, setShowMaintenanceButton] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<Awaited<ReturnType<typeof client.getObject>> | null>(null);
    const hasAutoFetched = useRef(false);

    const bikeFields = ((result?.data?.content as { fields?: Record<string, unknown> } | undefined)?.fields ?? {}) as Record<string, unknown>;
    const bikeState = Number(bikeFields.state);
    const ticketBikeId = result?.data?.objectId ?? "";
    const ticketMetadataCid = String(bikeFields.metadata_cid ?? "");
    const ownerData = result?.data?.owner;
    const ticketConsumerAddress =
        ownerData && typeof ownerData === "object" && "AddressOwner" in ownerData ? String((ownerData as { AddressOwner?: unknown }).AddressOwner ?? "") : "";
    const canShowTransferButton =
        !!result?.data?.objectId && !!account?.address && ticketConsumerAddress.toLowerCase() === account.address.toLowerCase() && bikeState === 0;
    const shouldRenderTransferModal = !!result?.data?.objectId && (canShowTransferButton || isTransferModalOpen);

    const bikeData: BikeObjectData | null = result?.data
        ? {
              objectId: String(result.data.objectId ?? ""),
              version: String(result.data.version ?? ""),
              digest: String(result.data.digest ?? ""),
              content: result.data.content,
              owner: result.data.owner,
              previousTransaction: result.data.previousTransaction,
          }
        : null;

    const canShowSellButton = !!bikeData && shouldShowSellButton(bikeData, account?.address);

    const shouldShowMaintenanceButton = async () => {
        const tx = new Transaction();

        tx.moveCall({
            target: `${import.meta.env.VITE_PACKAGE_ID}::registry::registered`,
            arguments: [tx.object(import.meta.env.VITE_REGISTRY_ID), tx.pure.address(account?.address ?? "")],
        });

        const result = await client.devInspectTransactionBlock({
            transactionBlock: tx,
            sender: account?.address ?? "",
        });

        const returnValues = result.results?.[0]?.returnValues;
        if (!returnValues || returnValues.length === 0) return false;

        const [valueBytes] = returnValues[0];
        return valueBytes[0] === 1;
    };

    const refreshCurrentObject = async () => {
        if (!result?.data?.objectId) {
            return;
        }

        await fetchObject(result.data.objectId);
    };

    const fetchObject = async (id: string) => {
        setIsLoading(true);

        const data = await client.getObject({
            id,
            options: {
                showContent: true,
                showOwner: true,
                showPreviousTransaction: true,
            },
        });

        setResult(data);

        if (data.data?.content && account?.address) {
            const canShow = await shouldShowMaintenanceButton();
            var content = data.data.content as any;
            const state = Number((content as { fields: { state: unknown } }).fields.state);
            setShowMaintenanceButton(canShow && state == 0);
        }

        setIsLoading(false);
    };

    const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const id = objectId.trim();
        if (!id) {
            setResult(null);
            return;
        }

        await fetchObject(id);
    };

    useEffect(() => {
        if (!initialObjectIdFromUrl || hasAutoFetched.current) {
            return;
        }

        hasAutoFetched.current = true;
        void fetchObject(initialObjectIdFromUrl);
    }, [initialObjectIdFromUrl]);

    return (
        <div className="trace-shell">
            <form className="trace-card" onSubmit={onSubmit}>
                <h2 className="trace-heading">自行車履歷查詢</h2>

                <label className="trace-field">
                    BikeNFT ObjectID
                    <input value={objectId} onChange={(e) => setObjectId(e.target.value)} placeholder="0x..." autoComplete="off" />
                </label>

                <div className="trace-actions">
                    <button className="trace-submit" type="submit" disabled={isLoading}>
                        {isLoading ? "查詢中..." : "查詢"}
                    </button>
                    {canShowSellButton && <CreateSaleOrderModal bikeObjectId={result?.data?.objectId ?? ""} onSuccess={refreshCurrentObject} />}
                    {shouldRenderTransferModal && (
                        <TransferBikeModal
                            bikeObjectId={result?.data?.objectId ?? ""}
                            onSuccess={refreshCurrentObject}
                            showTrigger={canShowTransferButton}
                            isOpen={isTransferModalOpen}
                            onOpenChange={setIsTransferModalOpen}
                        />
                    )}
                    {showMaintenanceButton && (
                        <CreateTicketModal
                            bikeId={ticketBikeId}
                            metadataCid={ticketMetadataCid}
                            consumerAddress={ticketConsumerAddress}
                            onSuccess={refreshCurrentObject}
                        />
                    )}
                </div>

                {result?.data && (
                    <>
                        <h3 className="trace-json-title">自行車物件資訊</h3>
                        <BikeDataDisplay content={(result.data.content as any)?.fields as BikeNFTContent} objectId={result.data.objectId} />
                    </>
                )}
            </form>
        </div>
    );
};

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    .trace-shell {
        display: flex;
        justify-content: center;
        padding: 24px 12px;
        box-sizing: border-box;
    }

    .trace-card {
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

    .trace-heading {
        margin: 0;
    }

    .trace-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 14px;
    }

    .trace-field input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-sizing: border-box;
    }

    .trace-submit {
        width: fit-content;
        padding: 10px 14px;
        border: none;
        border-radius: 10px;
        background: #2563eb;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
    }

    .trace-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .trace-submit-cancel {
        background: #dc2626;
    }

    .trace-submit-accept {
        background: #16a34a;
    }

    .trace-actions {
        width: 100%;
        display: flex;
        align-items: flex-start;
        gap: 8px;
    }

    .trace-result {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .trace-result p {
        margin: 0;
    }

    .trace-json-title {
        margin: 8px 0 0;
        font-size: 14px;
    }

    .trace-json {
        margin: 0;
        max-height: 340px;
        overflow: auto;
        background: #0f172a;
        color: #d1fae5;
        border-radius: 8px;
        padding: 10px;
        font-size: 12px;
        line-height: 1.45;
    }

    .trace-sell-btn {
        width: fit-content;
        padding: 10px 14px;
        border: none;
        border-radius: 10px;
        background: #16a34a;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
    }

    .trace-status {
        margin: 0;
        font-size: 13px;
    }

    .trace-error {
        color: #dc2626;
    }

    .trace-success {
        color: #16a34a;
    }
`);
if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

if (!document.adoptedStyleSheets.includes(BikeDataDisplayStyles)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, BikeDataDisplayStyles];
}

export default BikeTracePage;
