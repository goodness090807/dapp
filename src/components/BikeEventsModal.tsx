import { useState } from "react";
import { useIotaClient } from "@iota/dapp-kit";

const EVENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    BikeMinted: { label: "自行車鑄造", color: "#15803d", bg: "#dcfce7" },
    Sale: { label: "銷售", color: "#1d4ed8", bg: "#dbeafe" },
    Maintenance: { label: "維修紀錄", color: "#b45309", bg: "#fef3c7" },
    Transferred: { label: "移轉", color: "#6d28d9", bg: "#ede9fe" },
};

type BikeEvent = {
    eventShortType: string;
    label: string;
    color: string;
    bg: string;
    timestamp: number;
    transactionDigest: string;
    parsedJson: Record<string, unknown>;
};

type BikeEventsModalProps = {
    objectId: string;
};

const shortenDigest = (digest: string) => (digest.length > 12 ? `${digest.slice(0, 6)}...${digest.slice(-6)}` : digest);

const formatTimestamp = (ms: number) => {
    if (!ms) return "—";
    const d = new Date(ms);
    return d.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

const strField = (json: Record<string, unknown>, key: string): string => {
    const v = json[key];
    if (v == null) return "";
    if (typeof v === "object" && "id" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).id);
    return String(v);
};

const shorten = (addr: string) => (addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr);

const describeEvent = (shortType: string, json: Record<string, unknown>): string => {
    const s = (k: string) => strField(json, k);
    switch (shortType) {
        case "BikeMinted": {
            const parts: string[] = [];
            if (s("name")) parts.push(`「${s("name")}」`);
            return `自行車${parts.join("、")}完成鑄造。`;
        }
        case "Sale": {
            const parts: string[] = [];
            if (s("from_address")) parts.push(`買方 ${shorten(s("from_address"))}`);
            if (s("to_address")) parts.push(`賣方 ${shorten(s("to_address"))}`);
            return `完成銷售${parts.length ? `（${parts.join("，")}）` : ""}。`;
        }
        case "Maintenance": {
            const desc = s("description") || s("note") || s("repair_type");
            return `完成維修紀錄${desc ? `：${desc}` : ""}。`;
        }
        case "Transferred": {
            const from = s("from_address");
            const to = s("to_address");
            if (from && to) return `自行車從 ${shorten(from)} 移轉至 ${shorten(to)}。`;
            if (to) return `自行車移轉至 ${shorten(to)}。`;
            return "自行車完成移轉。";
        }
        default:
            return "";
    }
};

const BikeEventsModal = ({ objectId }: BikeEventsModalProps) => {
    const client = useIotaClient();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [events, setEvents] = useState<BikeEvent[]>([]);
    const [error, setError] = useState<string | null>(null);

    const loadEvents = async () => {
        setIsLoading(true);
        setError(null);
        setEvents([]);

        try {
            const packageId = import.meta.env.VITE_PACKAGE_ID;

            // 對每種事件類型建立完整的 MoveEventType 路徑
            const eventTypes = Object.keys(EVENT_CONFIG).map((k) => `${packageId}::bike::${k}`);
            console.log("Fetching events for types:", eventTypes);
            // 每種事件類型分別查詢，並自動處理分頁
            const fetchAllForType = async (eventType: string) => {
                const collected: any[] = [];
                let cursor: any = undefined;
                let hasMore = true;
                while (hasMore) {
                    const result = await client.queryEvents({
                        query: { MoveEventType: eventType },
                        cursor,
                        limit: 50,
                        order: "ascending",
                    });
                    console.log(`Fetched ${result.data.length} events for type ${eventType}, hasNextPage: ${result.hasNextPage}`);
                    collected.push(...result.data);
                    hasMore = result.hasNextPage;
                    cursor = result.nextCursor ?? undefined;
                }
                return collected;
            };

            // 所有事件類型同時並行查詢
            const results = await Promise.all(eventTypes.map(fetchAllForType));
            const allRaw = results.flat();

            // 前端依 bike_id 過濾，只保留屬於此物件的事件
            const filtered = allRaw.filter((e) => {
                const parsed = e.parsedJson as any;
                return parsed?.bike_id === objectId;
            });

            // 轉換成 BikeEvent 格式
            const allEvents: BikeEvent[] = filtered.flatMap((e) => {
                const evType: string = e.type ?? "";
                const shortType = Object.keys(EVENT_CONFIG).find((k) => evType.includes(`${packageId}::bike::${k}`) || evType.endsWith(`::${k}`));
                if (!shortType) return [];
                const cfg = EVENT_CONFIG[shortType];
                return [
                    {
                        eventShortType: shortType,
                        label: cfg.label,
                        color: cfg.color,
                        bg: cfg.bg,
                        timestamp: Number(e.timestampMs ?? 0),
                        transactionDigest: (e.id as any)?.txDigest ?? "",
                        parsedJson: (e.parsedJson as Record<string, unknown>) ?? {},
                    },
                ];
            });

            allEvents.sort((a, b) => a.timestamp - b.timestamp);
            setEvents(allEvents);
        } catch (err) {
            setError(err instanceof Error ? err.message : "查詢事件時發生錯誤");
        } finally {
            setIsLoading(false);
        }
    };

    const open = () => {
        setIsOpen(true);
        void loadEvents();
    };

    const close = () => setIsOpen(false);

    return (
        <>
            <button className="bike-events-btn" type="button" onClick={open}>
                事件紀錄
            </button>

            {isOpen && (
                <div className="bike-events-overlay" onClick={close}>
                    <div className="bike-events-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="自行車事件紀錄">
                        <div className="bike-events-header">
                            <h3 className="bike-events-title">事件紀錄</h3>
                            <button className="bike-events-close" type="button" onClick={close} aria-label="關閉">
                                ✕
                            </button>
                        </div>

                        <div className="bike-events-body">
                            {isLoading && (
                                <div className="bike-events-loading">
                                    <span className="bike-events-spinner" />
                                    查詢事件中...
                                </div>
                            )}

                            {error && <div className="bike-events-error">{error}</div>}

                            {!isLoading && !error && events.length === 0 && <div className="bike-events-empty">目前沒有找到相關事件紀錄。</div>}

                            {!isLoading && events.length > 0 && (
                                <div className="bike-events-timeline">
                                    {events.map((ev, idx) => (
                                        <div className="bike-event-item" key={`${ev.transactionDigest}-${ev.eventShortType}-${idx}`}>
                                            <div className="bike-event-dot-col">
                                                <span className="bike-event-dot" style={{ background: ev.color }} />
                                                {idx < events.length - 1 && <span className="bike-event-line" />}
                                            </div>
                                            <div className="bike-event-content">
                                                <div className="bike-event-top">
                                                    <span
                                                        className="bike-event-badge"
                                                        style={{ color: ev.color, background: ev.bg, border: `1px solid ${ev.color}40` }}>
                                                        {ev.label}
                                                    </span>
                                                    <span className="bike-event-time">{formatTimestamp(ev.timestamp)}</span>
                                                </div>
                                                {describeEvent(ev.eventShortType, ev.parsedJson) && (
                                                    <p className="bike-event-desc">{describeEvent(ev.eventShortType, ev.parsedJson)}</p>
                                                )}
                                                <a
                                                    className="bike-event-tx"
                                                    href={`https://explorer.iota.org/txblock/${ev.transactionDigest}?network=testnet`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={ev.transactionDigest}>
                                                    交易 {shortenDigest(ev.transactionDigest)} ↗
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style>{styles}</style>
        </>
    );
};

const styles = `
    .bike-events-btn {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        background: #f3e8ff;
        color: #6d28d9;
        border: 1px solid #c4b5fd;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;
    }
    .bike-events-btn:hover {
        background: #ede9fe;
        border-color: #a78bfa;
    }

    .bike-events-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
    }
    .bike-events-modal {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.18);
        width: min(100%, 560px);
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .bike-events-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        flex-shrink: 0;
    }
    .bike-events-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #111827;
    }
    .bike-events-close {
        background: none;
        border: none;
        font-size: 16px;
        color: #6b7280;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        line-height: 1;
    }
    .bike-events-close:hover {
        background: #f3f4f6;
        color: #111827;
    }
    .bike-events-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
    }
    .bike-events-loading {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #6b7280;
        font-size: 14px;
        padding: 24px 0;
        justify-content: center;
    }
    .bike-events-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid #e5e7eb;
        border-top-color: #6d28d9;
        border-radius: 50%;
        animation: bike-spin 0.7s linear infinite;
        display: inline-block;
    }
    @keyframes bike-spin { to { transform: rotate(360deg); } }
    .bike-events-error {
        color: #dc2626;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 14px;
    }
    .bike-events-empty {
        color: #6b7280;
        font-size: 14px;
        text-align: center;
        padding: 32px 0;
    }

    .bike-events-timeline {
        display: flex;
        flex-direction: column;
        gap: 0;
    }
    .bike-event-item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }
    .bike-event-dot-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex-shrink: 0;
        padding-top: 4px;
    }
    .bike-event-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 2px solid #fff;
        box-shadow: 0 0 0 2px currentColor;
    }
    .bike-event-line {
        width: 2px;
        flex: 1;
        min-height: 16px;
        background: #e5e7eb;
        margin: 4px 0;
    }
    .bike-event-content {
        flex: 1;
        padding-bottom: 20px;
    }
    .bike-event-top {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        flex-wrap: wrap;
    }
    .bike-event-badge {
        font-size: 12px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 999px;
    }
    .bike-event-time {
        font-size: 12px;
        color: #6b7280;
    }
    .bike-event-desc {
        margin: 0 0 6px 0;
        font-size: 13px;
        color: #374151;
        line-height: 1.6;
    }
    .bike-event-tx {
        font-size: 11px;
        color: #2563eb;
        text-decoration: none;
        font-family: monospace;
    }
    .bike-event-tx:hover {
        text-decoration: underline;
    }
`;

export default BikeEventsModal;
