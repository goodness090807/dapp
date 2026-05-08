import { useCallback, useState } from "react";
import { useCurrentAccount, useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";

type LookupRole = "retailer" | "manufacturer";

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID as string;
const CLOCK_ID = "0x6";
const RECEIVE_ORDER_FUNCTION =
    (import.meta.env.VITE_CONSUMER_RECEIVE_ORDER_FUNCTION as string | undefined)?.trim() || "receive_sale_order";

type LookupResult = {
    ownerAddress: string;
    identityCid: string;
    profile: {
        name?: string;
        phone?: string;
        location?: string;
    };
};

type MemberEntry = {
    addr: string;
    identity_hash: string;
};

type RegistryMemberWrapper = {
    fields?: Partial<MemberEntry>;
};

type RegistryFields = {
    retailers?: RegistryMemberWrapper[];
    manufacturers?: RegistryMemberWrapper[];
};

type ObjectResponse = {
    data?: {
        objectId?: string;
        type?: string;
        owner?: unknown;
        content?: {
            fields?: RegistryFields | Record<string, unknown>;
        };
    };
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

type TxObjectChange = {
    type?: string;
    objectId?: string;
    objectType?: string;
};

type TxBlockResult = {
    objectChanges?: TxObjectChange[];
};

type TxQueryPage = {
    data?: Array<TxBlockResult & { digest?: string; timestampMs?: string | number | null }>;
    nextCursor?: string | null;
    hasNextPage?: boolean;
};

export type ConsumerBike = {
    objectId: string;
    name: string;
    frameNo: string;
    brand: string;
    model: string;
    frameMaterial: string;
    manufacturedYear: number;
    imageCid: string;
    state: number;
};

export type ConsumerOrder = {
    objectId: string;
    bikeObjectId: string;
    recipient: string;
    certificateCid: string;
    status: number;
};

export type BikeLookupResult = ConsumerBike & {
    type: string;
    ownerSummary: string;
};

export type BikeTxHistoryItem = {
    digest: string;
    timestampMs: number | null;
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

function getFieldString(fields: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = fields[key];
        if (typeof value === "string" && value.trim()) return value;
    }
    return "";
}

function parseBikeObject(raw: ObjectResponse): ConsumerBike | null {
    const fields = raw.data?.content?.fields as Record<string, unknown> | undefined;
    if (!fields) return null;

    return {
        objectId: raw.data?.objectId ?? "",
        name: String(fields["name"] ?? ""),
        frameNo: String(fields["frame_no"] ?? ""),
        brand: String(fields["brand"] ?? ""),
        model: String(fields["model"] ?? ""),
        frameMaterial: String(fields["frame_material"] ?? ""),
        manufacturedYear: normalizeMoveNumber(fields["manufactured_year"], 0),
        imageCid: String(fields["image_cid"] ?? ""),
        state: normalizeMoveNumber(fields["state"], -1),
    };
}

function summarizeOwner(owner: unknown): string {
    if (!owner || typeof owner !== "object") return "-";
    const ownerObj = owner as Record<string, unknown>;
    const ownerType = Object.keys(ownerObj)[0] ?? "";
    const ownerValue = ownerType ? ownerObj[ownerType] : undefined;

    if (typeof ownerValue === "string") {
        return `${ownerType}: ${ownerValue}`;
    }

    if (ownerType === "Shared") return "Shared";
    return ownerType || "-";
}

function normalizeAddress(value: string): string {
    return value.trim().toLowerCase();
}

export function useConsumerInfoLookup() {
    const client = useIotaClient();
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<LookupResult | null>(null);

    const queryByAddress = useCallback(
        async (role: LookupRole, address: string) => {
            setIsPending(true);
            setError(null);
            setResult(null);

            try {
                const registryObj = (await client.getObject({
                    id: import.meta.env.VITE_REGISTRY_ID,
                    options: { showType: true, showContent: true },
                })) as ObjectResponse;

                const fields = registryObj.data?.content?.fields as RegistryFields | undefined;

                const all: RegistryMemberWrapper[] =
                    role === "manufacturer" ? (fields?.manufacturers ?? []) : (fields?.retailers ?? []);
                const found =
                    all
                        .map((m) => m.fields)
                        .find((m) => normalizeAddress(m?.addr ?? "") === normalizeAddress(address)) ?? null;

                const identityCid = (found?.identity_hash ?? "").trim();

                const profileResp = await fetch(`https://gateway.pinata.cloud/ipfs/${identityCid}`);
                const profileJson = (await profileResp.json()) as Record<string, unknown>;

                setResult({
                    ownerAddress: address,
                    identityCid,
                    profile: {
                        name: typeof profileJson.name === "string" ? profileJson.name : undefined,
                        phone: typeof profileJson.phone === "string" ? profileJson.phone : undefined,
                        location: typeof profileJson.location === "string" ? profileJson.location : undefined,
                    },
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : "查詢失敗");
            } finally {
                setIsPending(false);
            }
        },
        [client],
    );

    return { queryByAddress, isPending, error, result };
}

/** 查詢目前消費者擁有的 BikeNFT 清單 */
export function useConsumerOwnedBikes() {
    const client = useIotaClient();
    const account = useCurrentAccount();

    const [bikes, setBikes] = useState<ConsumerBike[]>([]);
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

            const parsed: ConsumerBike[] = [];

            for (const item of result.data as OwnedObjectItem[]) {
                const fields = item.data?.content?.fields as Record<string, unknown> | undefined;
                if (!fields) continue;

                parsed.push({
                    objectId: item.data?.objectId ?? "",
                    name: String(fields["name"] ?? ""),
                    frameNo: String(fields["frame_no"] ?? ""),
                    brand: String(fields["brand"] ?? ""),
                    model: String(fields["model"] ?? ""),
                    frameMaterial: String(fields["frame_material"] ?? ""),
                    manufacturedYear: normalizeMoveNumber(fields["manufactured_year"], 0),
                    imageCid: String(fields["image_cid"] ?? ""),
                    state: normalizeMoveNumber(fields["state"], -1),
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

/** 依 Object ID 查詢單一 BikeNFT 詳細資訊 */
export function useConsumerBikeLookup() {
    const client = useIotaClient();

    const [result, setResult] = useState<BikeLookupResult | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const lookupBike = useCallback(
        async (objectId: string) => {
            const id = objectId.trim();
            if (!id) {
                setError("請輸入 Object ID");
                return;
            }

            setIsPending(true);
            setError(null);
            setResult(null);

            try {
                const obj = (await client.getObject({
                    id,
                    options: { showType: true, showContent: true, showOwner: true },
                })) as ObjectResponse;

                const type = obj.data?.type ?? "";
                if (!type.includes("::bike::BikeNFT")) {
                    throw new Error("該 Object 不是 BikeNFT");
                }

                const parsed = parseBikeObject(obj);
                if (!parsed) {
                    throw new Error("無法解析 BikeNFT 欄位");
                }

                setResult({
                    ...parsed,
                    type,
                    ownerSummary: summarizeOwner(obj.data?.owner),
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : "查詢失敗");
            } finally {
                setIsPending(false);
            }
        },
        [client],
    );

    return { lookupBike, result, isPending, error };
}

/** 查詢指向目前消費者地址的待接收 SaleOrder */
export function useConsumerPendingOrders() {
    const client = useIotaClient();
    const account = useCurrentAccount();

    const [orders, setOrders] = useState<ConsumerOrder[]>([]);
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPendingOrders = useCallback(async () => {
        if (!account?.address) {
            setError("請先連接錢包");
            return;
        }

        setIsPending(true);
        setError(null);
        setOrders([]);

        try {
            const clientWithTxQuery = client as unknown as {
                queryTransactionBlocks: (input: Record<string, unknown>) => Promise<TxQueryPage>;
            };

            if (typeof clientWithTxQuery.queryTransactionBlocks !== "function") {
                throw new Error("目前 IOTA client 版本不支援 queryTransactionBlocks");
            }

            const saleOrderIds = new Set<string>();
            let cursor: string | null | undefined = null;
            let page = 0;

            while (page < 5) {
                const txPage = await clientWithTxQuery.queryTransactionBlocks({
                    filter: {
                        MoveFunction: {
                            package: PACKAGE_ID,
                            module: "bike",
                            function: "create_sale_order",
                        },
                    },
                    options: { showObjectChanges: true },
                    cursor,
                    limit: 50,
                    order: "descending",
                });

                for (const tx of txPage.data ?? []) {
                    for (const change of tx.objectChanges ?? []) {
                        if (
                            change.type === "created" &&
                            typeof change.objectId === "string" &&
                            typeof change.objectType === "string" &&
                            change.objectType.includes("SaleOrder")
                        ) {
                            saleOrderIds.add(change.objectId);
                        }
                    }
                }

                page += 1;
                cursor = txPage.nextCursor;
                if (!txPage.hasNextPage || !cursor) break;
            }

            const targetAddress = normalizeAddress(account.address);
            const result: ConsumerOrder[] = [];

            for (const orderId of saleOrderIds) {
                const obj = (await client.getObject({
                    id: orderId,
                    options: { showContent: true, showType: true },
                })) as ObjectResponse;

                const fields = obj.data?.content?.fields as Record<string, unknown> | undefined;
                if (!fields) continue;

                const recipient = getFieldString(fields, ["recipient", "consumer_address", "to", "to_address"]);
                if (normalizeAddress(recipient) !== targetAddress) continue;

                const receivedAt = normalizeMoveNumber(fields["received_at"], 0);
                if (receivedAt > 0) continue;

                result.push({
                    objectId: orderId,
                    bikeObjectId: getFieldString(fields, ["bike_id", "bike", "bike_object_id"]),
                    recipient,
                    certificateCid: getFieldString(fields, ["certificate_cid", "certificate"]),
                    status: normalizeMoveNumber(fields["state"] ?? fields["status"], -1),
                });
            }

            setOrders(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "查詢待接收訂單失敗");
        } finally {
            setIsPending(false);
        }
    }, [account, client]);

    return { fetchPendingOrders, orders, isPending, error };
}

/** 消費者接收訂單 */
export function useConsumerReceiveOrder() {
    const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
    const client = useIotaClient();

    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [digest, setDigest] = useState<string | null>(null);

    const receiveOrder = useCallback(
        async (saleOrderObjectId: string) => {
            const id = saleOrderObjectId.trim();
            if (!id) {
                setError("請提供 SaleOrder Object ID");
                return;
            }

            setIsPending(true);
            setError(null);
            setDigest(null);

            try {
                const tx = new Transaction();
                tx.moveCall({
                    target: `${PACKAGE_ID}::bike::${RECEIVE_ORDER_FUNCTION}`,
                    arguments: [tx.object(id), tx.object(CLOCK_ID)],
                });

                const { digest: txDigest } = await signAndExecute({
                    transaction: tx,
                    options: { showEvents: true, showObjectChanges: true },
                });

                await client.waitForTransaction({ digest: txDigest });
                setDigest(txDigest);
            } catch (err) {
                setError(err instanceof Error ? err.message : "接收訂單失敗，請確認 Move entry 名稱與參數是否一致");
            } finally {
                setIsPending(false);
            }
        },
        [client, signAndExecute],
    );

    return { receiveOrder, isPending, error, digest };
}

/** 依 Bike Object ID 查詢交易紀錄 */
export function useBikeTransactionHistory() {
    const client = useIotaClient();

    const [items, setItems] = useState<BikeTxHistoryItem[]>([]);
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const queryHistory = useCallback(
        async (bikeObjectId: string) => {
            const id = bikeObjectId.trim();
            if (!id) {
                setError("請輸入 Bike Object ID");
                return;
            }

            setIsPending(true);
            setError(null);
            setItems([]);

            try {
                const clientWithTxQuery = client as unknown as {
                    queryTransactionBlocks: (input: Record<string, unknown>) => Promise<TxQueryPage>;
                };

                if (typeof clientWithTxQuery.queryTransactionBlocks !== "function") {
                    throw new Error("目前 IOTA client 版本不支援 queryTransactionBlocks");
                }

                const digestMap = new Map<string, BikeTxHistoryItem>();

                const collectByFilter = async (filter: Record<string, unknown>) => {
                    let cursor: string | null | undefined = null;
                    let page = 0;

                    while (page < 10) {
                        const res = await clientWithTxQuery.queryTransactionBlocks({
                            filter,
                            options: { showEffects: true },
                            cursor,
                            limit: 50,
                            order: "descending",
                        });

                        for (const tx of res.data ?? []) {
                            if (!tx.digest) continue;
                            const ts = normalizeMoveNumber(tx.timestampMs, -1);
                            digestMap.set(tx.digest, {
                                digest: tx.digest,
                                timestampMs: ts >= 0 ? ts : null,
                            });
                        }

                        page += 1;
                        cursor = res.nextCursor;
                        if (!res.hasNextPage || !cursor) break;
                    }
                };

                // 同時抓「被當作輸入物件」與「被變更物件」的交易，避免漏掉紀錄
                await collectByFilter({ InputObject: id });
                await collectByFilter({ ChangedObject: id });

                const merged = Array.from(digestMap.values()).sort(
                    (a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0),
                );

                setItems(merged);
            } catch (err) {
                setError(err instanceof Error ? err.message : "查詢交易紀錄失敗");
            } finally {
                setIsPending(false);
            }
        },
        [client],
    );

    return { queryHistory, items, isPending, error };
}
