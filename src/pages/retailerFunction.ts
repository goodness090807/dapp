import { useCallback, useState } from "react";
import { useCurrentAccount, useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PinataSDK } from "pinata";

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID as string;
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string;
const CLOCK_ID = "0x6";

/** 與合約 STATE_PENDING_SALE 一致 */
export const STATE_PENDING_SALE = 1;

export type BikeNFT = {
    objectId: string;
    name: string;
    frameNo: string;
    brand: string;
    model: string;
    frameMaterial: string;
    manufacturedYear: number;
    imageCid: string;
    state: number;
    manufacturerAddress: string;
    retailerAddress: string;
    registeredAt: number;
};

type OwnedObjectContent = {
    fields?: Record<string, unknown>;
};

type OwnedObjectData = {
    objectId?: string;
    content?: OwnedObjectContent;
};

type OwnedObjectItem = {
    data?: OwnedObjectData;
};
function normalizeMoveNumber(value: unknown, fallback = -1): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    if (typeof value === "bigint") return Number(value);
    return fallback;
}

/** 查詢目前帳戶擁有的所有 BikeNFT */
export function useRetailerBikes() {
    const client = useIotaClient();
    const account = useCurrentAccount();

    const [bikes, setBikes] = useState<BikeNFT[]>([]);
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBikes = useCallback(async () => {
        if (!account?.address) {
            setError("請先連接錢包");
            return;
        }

        setIsPending(true);
        setError(null);
        setBikes([]);

        try {
            const result = await client.getOwnedObjects({
                owner: account.address,
                filter: { StructType: `${PACKAGE_ID}::bike::BikeNFT` },
                options: { showContent: true, showType: true },
            });

            const parsed: BikeNFT[] = [];

            for (const item of result.data as OwnedObjectItem[]) {
                const fields = item.data?.content?.fields as Record<string, unknown> | undefined;
                if (!fields) continue;

                const state = normalizeMoveNumber(fields["state"]);

                parsed.push({
                    objectId: item.data?.objectId ?? "",
                    name: String(fields["name"] ?? ""),
                    frameNo: String(fields["frame_no"] ?? ""),
                    brand: String(fields["brand"] ?? ""),
                    model: String(fields["model"] ?? ""),
                    frameMaterial: String(fields["frame_material"] ?? ""),
                    manufacturedYear: normalizeMoveNumber(fields["manufactured_year"], 0),
                    imageCid: String(fields["image_cid"] ?? ""),
                    state,
                    manufacturerAddress: String(fields["manufacturer_address"] ?? ""),
                    retailerAddress: String(fields["retailer_address"] ?? ""),
                    registeredAt: normalizeMoveNumber(fields["registered_at"], 0),
                });
            }

            setBikes(parsed);
        } catch (err) {
            setError(err instanceof Error ? err.message : "查詢失敗");
        } finally {
            setIsPending(false);
        }
    }, [account, client]);

    return { fetchBikes, bikes, isPending, error };
}

/** 建立新車銷售訂單 — create_sale_order */
export function useCreateSaleOrder() {
    const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
    const client = useIotaClient();

    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orderObjectId, setOrderObjectId] = useState<string | null>(null);

    const createSaleOrder = useCallback(
        async (input: { bikeObjectId: string; recipient: string; certificateFile: File }) => {
            setIsPending(true);
            setError(null);
            setOrderObjectId(null);

            try {
                const bikeObj = await client.getObject({
                    id: input.bikeObjectId,
                    options: { showContent: true },
                });

                const bikeStateRaw = (bikeObj.data?.content as { fields?: Record<string, unknown> } | undefined)
                    ?.fields?.["state"];
                const bikeState = normalizeMoveNumber(bikeStateRaw);
                if (bikeState !== STATE_PENDING_SALE) {
                    throw new Error(`此自行車目前 state=${bikeState}，只有待銷售(state=1)可建立交車單`);
                }

                // 上傳保固書至 IPFS
                const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });
                const certUpload = await pinata.upload.public.file(input.certificateFile);

                const tx = new Transaction();
                tx.moveCall({
                    target: `${PACKAGE_ID}::bike::create_sale_order`,
                    arguments: [
                        tx.object(input.bikeObjectId),
                        tx.pure.address(input.recipient),
                        tx.pure.string(certUpload.cid),
                        tx.object(CLOCK_ID),
                    ],
                });

                const { digest } = await signAndExecute({
                    transaction: tx,
                    options: { showEvents: true, showObjectChanges: true },
                });

                const txResult = await client.waitForTransaction({
                    digest,
                    options: { showObjectChanges: true },
                });

                const created = txResult.objectChanges?.find(
                    (change): change is typeof change & { objectId: string } =>
                        change.type === "created" &&
                        "objectType" in change &&
                        (change.objectType as string).includes("SaleOrder"),
                );

                setOrderObjectId(created?.objectId ?? digest);
            } catch (err) {
                setError(err instanceof Error ? err.message : "建立訂單失敗");
            } finally {
                setIsPending(false);
            }
        },
        [client, signAndExecute],
    );

    return { createSaleOrder, isPending, error, orderObjectId };
}
