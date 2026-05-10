import { useCallback, useState } from "react";
import { useIotaClient } from "@iota/dapp-kit";

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID as string;

// ── 事件類型對應中文標籤 ──────────────────────────────────────

const EVENT_LABEL_MAP: Record<string, string> = {
    BikeMinted:                "自行車 NFT 鑄造",
    SaleOrderCreated:          "銷售訂單建立",
    SaleOrderCancelled:        "銷售訂單取消",
    BikeDeliveredWithWarranty: "交車（含保固）",
    DeliveryOrderCreated:      "交車訂單建立",
    BikeDelivered:             "交車完成",
    DeliveryOrderCancelled:    "交車訂單取消",
    MaintenanceFilled:         "維修單填寫",
    MaintenanceRecorded:       "維修記錄確認",
    MaintenanceRejected:       "維修單拒絕",
    MaintenanceCancelled:      "維修單取消",
};

// ── 型別定義 ──────────────────────────────────────────────────

export type BikeEventItem = {
    /** 事件在鏈上的唯一識別（txDigest + eventSeq） */
    eventId:    string;
    /** 交易 digest */
    txDigest:   string;
    /** 事件完整型別，如 0x...::bike::BikeMinted */
    eventType:  string;
    /** 事件簡短名稱，如 BikeMinted */
    eventName:  string;
    /** 中文標籤 */
    label:      string;
    /** 事件時間戳（毫秒），null 表示鏈上未記錄 */
    timestampMs: number | null;
    /** 事件具體欄位（parsedJson） */
    data:       Record<string, unknown>;
};

type QueryEventsPage = {
    data: Array<{
        id:          { txDigest: string; eventSeq: string };
        packageId:   string;
        transactionModule: string;
        sender:      string;
        type:        string;
        parsedJson?: Record<string, unknown>;
        bcs?:        string;
        timestampMs?: string | null;
    }>;
    nextCursor: { txDigest: string; eventSeq: string } | null;
    hasNextPage: boolean;
};

// ── 工具函式 ──────────────────────────────────────────────────

/** 從完整事件型別字串取出最後的結構名稱，如 "BikeMinted" */
function extractEventName(fullType: string): string {
    const parts = fullType.split("::");
    return parts[parts.length - 1] ?? fullType;
}

/**
 * 查詢指定 BikeNFT（bikeObjectId）的所有鏈上事件，並依時間排序。
 *
 * @param client   - useIotaClient() 取得的 IotaClient
 * @param bikeObjectId - BikeNFT 的 objectId（即 Move ID，不含 0x 亦可）
 * @returns 按時間升冪排列的事件陣列
 */
export async function fetchBikeEvents(
    client: ReturnType<typeof useIotaClient>,
    bikeObjectId: string
): Promise<BikeEventItem[]> {
    // 統一格式：確保帶有 0x 前綴並小寫
    const normalizedId = bikeObjectId.toLowerCase().startsWith("0x")
        ? bikeObjectId.toLowerCase()
        : `0x${bikeObjectId.toLowerCase()}`;

    const collected: BikeEventItem[] = [];
    let cursor: { txDigest: string; eventSeq: string } | null = null;
    let hasNextPage = true;

    // 分頁抓取 Package 下的所有事件
    while (hasNextPage) {
        const page = (await client.queryEvents({
            query:  { Package: PACKAGE_ID },
            cursor: cursor ?? undefined,
            limit:  50,
            order:  "ascending",
        })) as unknown as QueryEventsPage;

        for (const ev of page.data) {
            const json = ev.parsedJson ?? {};

            // bike_id 在事件 parsedJson 中為 ID 物件，取其 id 欄位
            const rawBikeId =
                typeof json["bike_id"] === "string"
                    ? json["bike_id"]
                    : (json["bike_id"] as Record<string, unknown> | undefined)?.["id"] ?? "";

            const evBikeId = String(rawBikeId).toLowerCase().startsWith("0x")
                ? String(rawBikeId).toLowerCase()
                : `0x${String(rawBikeId).toLowerCase()}`;

            if (evBikeId !== normalizedId) continue;

            const eventName = extractEventName(ev.type);
            const tsRaw     = ev.timestampMs;
            const tsNum     = tsRaw != null && tsRaw !== "" ? Number(tsRaw) : null;

            collected.push({
                eventId:     `${ev.id.txDigest}:${ev.id.eventSeq}`,
                txDigest:    ev.id.txDigest,
                eventType:   ev.type,
                eventName,
                label:       EVENT_LABEL_MAP[eventName] ?? eventName,
                timestampMs: tsNum,
                data:        json,
            });
        }

        hasNextPage = page.hasNextPage;
        cursor      = page.nextCursor;
    }

    // 依 timestampMs 升冪排列（null 排最後）
    collected.sort((a, b) => {
        if (a.timestampMs === null && b.timestampMs === null) return 0;
        if (a.timestampMs === null) return 1;
        if (b.timestampMs === null) return -1;
        return a.timestampMs - b.timestampMs;
    });

    return collected;
}

// ── React Hook ────────────────────────────────────────────────

export function useBikeEvents() {
    const client = useIotaClient();
    const [isPending, setIsPending] = useState(false);
    const [error,     setError]     = useState<string | null>(null);
    const [events,    setEvents]    = useState<BikeEventItem[]>([]);

    const query = useCallback(
        async (bikeObjectId: string) => {
            if (!bikeObjectId.trim()) return;
            setIsPending(true);
            setError(null);
            setEvents([]);
            try {
                const result = await fetchBikeEvents(client, bikeObjectId);
                setEvents(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setIsPending(false);
            }
        },
        [client]
    );

    return { query, events, isPending, error };
}
