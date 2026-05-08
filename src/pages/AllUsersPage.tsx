import { useMemo, useState } from "react";
import { useCurrentAccount } from "@iota/dapp-kit";
import {
    type BikeTxHistoryItem,
    type BikeLookupResult,
    type AllUsersBike,
    type AllUsersOrder,
    useAllUsersBikeLookup,
    useAllUsersInfoLookup,
    useAllUsersOwnedBikes,
    useAllUsersPendingOrders,
    useAllUsersReceiveOrder,
    useBikeTransactionHistory,
} from "./allUsersFunction";

type AllUsersFeatureKey = "lookupBusiness" | "myBikes" | "lookupBikeByObjectId" | "bikeTxHistory" | "pendingOrders";

const IOTA_NETWORK = (import.meta.env.VITE_IOTA_NETWORK as string | undefined)?.trim() || "testnet";

type AllUsersFeatureItem = {
    key: AllUsersFeatureKey;
    title: string;
    description: string;
};

const FEATURE_ITEMS: AllUsersFeatureItem[] = [
    {
        key: "lookupBusiness",
        title: "查詢製造商/零售商資訊",
        description: "依錢包地址查詢鏈上角色身份與 IPFS 身分檔。",
    },
    {
        key: "myBikes",
        title: "我擁有的自行車清單",
        description: "集中顯示目前消費者地址底下持有的所有 BikeNFT。",
    },
    {
        key: "lookupBikeByObjectId",
        title: "查看單一自行車",
        description: "輸入 Bike Object ID 查詢詳細資料，並可前往 IOTA Explorer。",
    },
    {
        key: "bikeTxHistory",
        title: "BikeNFT 交易紀錄",
        description: "輸入 Bike Object ID，查詢該 BikeNFT 的所有交易紀錄。",
    },
    {
        key: "pendingOrders",
        title: "待接收訂單",
        description: "查看指向目前地址的待接收訂單，並執行接收訂單。",
    },
];

function toExplorerObjectUrl(objectId: string): string {
    return `https://explorer.iota.org/object/${objectId}?network=${IOTA_NETWORK}`;
}

function toExplorerTxUrl(digest: string): string {
    return `https://explorer.iota.org/txblock/${digest}?network=${IOTA_NETWORK}`;
}

function shortId(value: string, head = 10, tail = 8): string {
    if (value.length <= head + tail + 1) return value;
    return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function AllUsersPage() {
    const account = useCurrentAccount();
    const [activeFeature, setActiveFeature] = useState<AllUsersFeatureKey>("lookupBusiness");

    const activeItem = useMemo(
        () => FEATURE_ITEMS.find((item) => item.key === activeFeature) ?? FEATURE_ITEMS[0],
        [activeFeature],
    );

    return (
        <div className="all-users-shell">
            <div className="all-users-layout">
                <aside className="all-users-sidebar">
                    <h2>所有使用者功能</h2>

                    <div className="all-users-menu">
                        {FEATURE_ITEMS.map((item) => {
                            const active = item.key === activeFeature;
                            return (
                                <button
                                    key={item.key}
                                    className={`all-users-menu-item ${active ? "all-users-menu-item-active" : ""}`}
                                    onClick={() => setActiveFeature(item.key)}>
                                    <div className="all-users-menu-title-row">
                                        <span>{item.title}</span>
                                    </div>
                                    <small>{item.description}</small>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <section className="all-users-content">
                    <header className="all-users-content-head">
                        <h3>{activeItem.title}</h3>
                    </header>

                    {activeFeature === "lookupBusiness" && (
                        <BusinessLookupPanel defaultAddress={account?.address ?? ""} />
                    )}
                    {activeFeature === "myBikes" && <MyBikesPanel />}
                    {activeFeature === "lookupBikeByObjectId" && <BikeLookupPanel />}
                    {activeFeature === "bikeTxHistory" && <BikeTxHistoryPanel />}
                    {activeFeature === "pendingOrders" && <PendingOrdersPanel />}
                </section>
            </div>
        </div>
    );
}

function BusinessLookupPanel({ defaultAddress }: { readonly defaultAddress: string }) {
    const [role, setRole] = useState<"retailer" | "manufacturer">("retailer");
    const [address, setAddress] = useState(defaultAddress);
    const { queryByAddress, isPending, error, result } = useAllUsersInfoLookup();

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!address.trim()) return;
        await queryByAddress(role, address.trim());
    };

    return (
        <div className="all-users-card">
            <form className="all-users-form" onSubmit={submit}>
                <label>
                    查詢角色
                    <select value={role} onChange={(e) => setRole(e.target.value as "retailer" | "manufacturer")}>
                        <option value="retailer">零售商</option>
                        <option value="manufacturer">製造商</option>
                    </select>
                </label>

                <label>
                    錢包地址
                    <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="輸入欲查詢的錢包地址"
                        disabled={isPending}
                    />
                </label>

                <button type="submit" disabled={isPending || !address.trim()}>
                    {isPending ? "查詢中..." : "查詢資訊"}
                </button>
            </form>

            {error && <p className="all-users-status all-users-status-error">{error}</p>}

            {result && (
                <div className="all-users-result">
                    <h4>查詢結果</h4>
                    <dl>
                        <dt>錢包地址</dt>
                        <dd>{result.ownerAddress}</dd>

                        <dt>Identity CID</dt>
                        <dd>{result.identityCid}</dd>

                        <dt>名稱</dt>
                        <dd>{result.profile.name ?? "-"}</dd>

                        <dt>電話</dt>
                        <dd>{result.profile.phone ?? "-"}</dd>

                        <dt>聯絡地址</dt>
                        <dd>{result.profile.location ?? "-"}</dd>
                    </dl>
                </div>
            )}
        </div>
    );
}

function MyBikesPanel() {
    const { fetchBikes, bikes, isPending, error } = useAllUsersOwnedBikes();

    return (
        <div className="all-users-stack">
            <div className="all-users-toolbar">
                <button className="all-users-primary-btn" onClick={fetchBikes} disabled={isPending}>
                    {isPending ? "查詢中..." : "重新整理清單"}
                </button>
                {bikes.length > 0 && <span className="all-users-count">共 {bikes.length} 輛</span>}
            </div>

            {error && <p className="all-users-status all-users-status-error">{error}</p>}

            {!isPending && bikes.length === 0 && !error && (
                <div className="all-users-empty">目前沒有可顯示的自行車，請按「重新整理清單」。</div>
            )}

            <div className="all-users-bike-grid">
                {bikes.map((bike) => (
                    <BikeCard key={bike.objectId} bike={bike} />
                ))}
            </div>
        </div>
    );
}

function BikeLookupPanel() {
    const [objectId, setObjectId] = useState("");
    const { lookupBike, result, isPending, error } = useAllUsersBikeLookup();

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!objectId.trim()) return;
        await lookupBike(objectId.trim());
    };

    return (
        <div className="all-users-card">
            <form className="all-users-form" onSubmit={submit}>
                <label>
                    Bike Object ID
                    <input
                        value={objectId}
                        onChange={(e) => setObjectId(e.target.value)}
                        placeholder="輸入 Bike Object ID，例如 0x..."
                        disabled={isPending}
                    />
                </label>

                <button type="submit" disabled={isPending || !objectId.trim()}>
                    {isPending ? "查詢中..." : "查詢自行車"}
                </button>
            </form>

            {error && <p className="all-users-status all-users-status-error">{error}</p>}

            {result && <BikeLookupResultCard result={result} />}
        </div>
    );
}

function BikeTxHistoryPanel() {
    const [objectId, setObjectId] = useState("");
    const { queryHistory, items, isPending, error } = useBikeTransactionHistory();

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!objectId.trim()) return;
        await queryHistory(objectId.trim());
    };

    return (
        <div className="all-users-stack">
            <div className="all-users-card">
                <form className="all-users-form" onSubmit={submit}>
                    <label>
                        Bike Object ID
                        <input
                            value={objectId}
                            onChange={(e) => setObjectId(e.target.value)}
                            placeholder="輸入 Bike Object ID，例如 0x..."
                            disabled={isPending}
                        />
                    </label>

                    <button type="submit" disabled={isPending || !objectId.trim()}>
                        {isPending ? "查詢中..." : "查詢交易紀錄"}
                    </button>
                </form>
            </div>

            {error && <p className="all-users-status all-users-status-error">{error}</p>}

            {!isPending && items.length === 0 && !error && (
                <div className="all-users-empty">請輸入 Bike Object ID 後查詢交易紀錄。</div>
            )}

            {items.length > 0 && (
                <div className="all-users-tx-card">
                    <h4 className="all-users-bike-title">交易紀錄（共 {items.length} 筆）</h4>
                    <div className="all-users-tx-list">
                        {items.map((item) => (
                            <TxHistoryRow key={item.digest} item={item} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function PendingOrdersPanel() {
    const { fetchPendingOrders, orders, isPending, error } = useAllUsersPendingOrders();
    const { receiveOrder, isPending: isReceivePending, error: receiveError, digest } = useAllUsersReceiveOrder();

    const handleReceive = async (orderId: string) => {
        await receiveOrder(orderId);
        await fetchPendingOrders();
    };

    return (
        <div className="all-users-stack">
            <div className="all-users-toolbar">
                <button
                    className="all-users-primary-btn"
                    onClick={fetchPendingOrders}
                    disabled={isPending || isReceivePending}>
                    {isPending ? "查詢中..." : "重新整理訂單"}
                </button>
                {orders.length > 0 && <span className="all-users-count">共 {orders.length} 筆待接收訂單</span>}
            </div>

            {error && <p className="all-users-status all-users-status-error">{error}</p>}
            {receiveError && <p className="all-users-status all-users-status-error">{receiveError}</p>}
            {digest && <p className="all-users-status all-users-status-success">接收成功，交易 Digest: {digest}</p>}

            {!isPending && orders.length === 0 && !error && (
                <div className="all-users-empty">目前沒有待接收訂單，請按「重新整理訂單」。</div>
            )}

            <div className="all-users-order-grid">
                {orders.map((order) => (
                    <OrderCard
                        key={order.objectId}
                        order={order}
                        isReceiving={isReceivePending}
                        onReceive={handleReceive}
                    />
                ))}
            </div>
        </div>
    );
}

function BikeCard({ bike }: { readonly bike: AllUsersBike }) {
    return (
        <article className="all-users-bike-card">
            <h4 className="all-users-bike-title">{bike.name || "未命名自行車"}</h4>

            <dl className="all-users-bike-dl">
                <dt>品牌 / 型號</dt>
                <dd>
                    {bike.brand} {bike.model}
                </dd>

                <dt>車架號碼</dt>
                <dd>{bike.frameNo || "-"}</dd>

                <dt>車架材質</dt>
                <dd>{bike.frameMaterial || "-"}</dd>

                <dt>製造年份</dt>
                <dd>{bike.manufacturedYear || "-"}</dd>

                <dt>狀態</dt>
                <dd>{bike.state}</dd>

                <dt>Object ID</dt>
                <dd className="all-users-mono">{shortId(bike.objectId)}</dd>
            </dl>
        </article>
    );
}

function BikeLookupResultCard({ result }: { readonly result: BikeLookupResult }) {
    const explorerUrl = toExplorerObjectUrl(result.objectId);

    return (
        <div className="all-users-result">
            <h4>自行車查詢結果</h4>

            <dl>
                <dt>Object ID</dt>
                <dd className="all-users-mono">{result.objectId}</dd>

                <dt>名稱</dt>
                <dd>{result.name || "-"}</dd>

                <dt>品牌 / 型號</dt>
                <dd>
                    {result.brand} {result.model}
                </dd>

                <dt>車架號碼</dt>
                <dd>{result.frameNo || "-"}</dd>

                <dt>車架材質</dt>
                <dd>{result.frameMaterial || "-"}</dd>

                <dt>製造年份</dt>
                <dd>{result.manufacturedYear || "-"}</dd>

                <dt>狀態</dt>
                <dd>{result.state}</dd>

                <dt>物件類型</dt>
                <dd className="all-users-mono">{result.type}</dd>

                <dt>擁有者</dt>
                <dd>{result.ownerSummary}</dd>
            </dl>

            <a className="all-users-link-btn" href={explorerUrl} target="_blank" rel="noreferrer">
                前往 IOTA Explorer
            </a>
        </div>
    );
}

function OrderCard({
    order,
    isReceiving,
    onReceive,
}: {
    readonly order: AllUsersOrder;
    readonly isReceiving: boolean;
    readonly onReceive: (orderId: string) => Promise<void>;
}) {
    const orderUrl = toExplorerObjectUrl(order.objectId);
    const bikeUrl = order.bikeObjectId ? toExplorerObjectUrl(order.bikeObjectId) : "";

    return (
        <article className="all-users-order-card">
            <h4 className="all-users-bike-title">SaleOrder</h4>

            <dl className="all-users-bike-dl">
                <dt>訂單 Object ID</dt>
                <dd className="all-users-mono">{shortId(order.objectId)}</dd>

                <dt>待接收自行車</dt>
                <dd className="all-users-mono">{order.bikeObjectId ? shortId(order.bikeObjectId) : "-"}</dd>

                <dt>收件人</dt>
                <dd>{order.recipient || "-"}</dd>

                <dt>保固書 CID</dt>
                <dd className="all-users-mono">{order.certificateCid || "-"}</dd>

                <dt>狀態碼</dt>
                <dd>{order.status}</dd>
            </dl>

            <div className="all-users-order-links">
                <a href={orderUrl} target="_blank" rel="noreferrer">
                    訂單 Explorer
                </a>
                {bikeUrl && (
                    <a href={bikeUrl} target="_blank" rel="noreferrer">
                        自行車 Explorer
                    </a>
                )}
            </div>

            <button className="all-users-primary-btn" onClick={() => onReceive(order.objectId)} disabled={isReceiving}>
                {isReceiving ? "接收中..." : "接收訂單"}
            </button>
        </article>
    );
}

function TxHistoryRow({ item }: { readonly item: BikeTxHistoryItem }) {
    const txUrl = toExplorerTxUrl(item.digest);
    const time = item.timestampMs ? new Date(item.timestampMs).toLocaleString() : "-";

    return (
        <article className="all-users-tx-row">
            <dl className="all-users-bike-dl">
                <dt>Digest</dt>
                <dd className="all-users-mono">{item.digest}</dd>

                <dt>時間</dt>
                <dd>{time}</dd>
            </dl>

            <a href={txUrl} target="_blank" rel="noreferrer">
                交易 Explorer
            </a>
        </article>
    );
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .all-users-shell {
    padding: 24px 16px 40px;
    box-sizing: border-box;
  }

  .all-users-layout {
    width: min(1120px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(260px, 320px) 1fr;
    gap: 16px;
    align-items: start;
  }

  .all-users-sidebar,
  .all-users-content {
    border-radius: 16px;
    border: 1px solid #dbe2ea;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.06);
    padding: 18px;
  }

  .all-users-sidebar h2 {
    margin: 0;
    font-size: 20px;
  }

  .all-users-menu {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .all-users-menu-item {
    width: 100%;
    text-align: left;
    border: 1px solid #d1d8e0;
    border-radius: 12px;
    background: #ffffff;
    padding: 12px;
    cursor: pointer;
    transition: transform .15s, box-shadow .15s, border-color .15s;
  }

  .all-users-menu-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
  }

  .all-users-menu-item-active {
    border-color: #1d4ed8;
    box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12);
  }

  .all-users-menu-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    color: #111827;
    font-size: 14px;
    font-weight: 700;
  }

  .all-users-menu-title-row em {
    font-style: normal;
    font-size: 11px;
    font-weight: 700;
    background: #e5edff;
    color: #1d4ed8;
    border-radius: 999px;
    padding: 3px 8px;
    flex-shrink: 0;
  }

  .all-users-menu-item small {
    display: block;
    margin-top: 7px;
    color: #4b5563;
    font-size: 12px;
    line-height: 1.5;
  }

  .all-users-content-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }

  .all-users-content-head h3 {
    margin: 0;
    font-size: 20px;
  }

  .all-users-content-head span {
    font-size: 12px;
    font-weight: 700;
    color: #1d4ed8;
    background: #e5edff;
    border-radius: 999px;
    padding: 4px 9px;
  }

  .all-users-stack {
    display: grid;
    gap: 12px;
  }

  .all-users-card,
  .all-users-bike-card,
  .all-users-order-card,
  .all-users-tx-card {
    border: 1px solid #dbe2ea;
    border-radius: 14px;
    background: #ffffff;
    padding: 14px;
  }

  .all-users-tx-list {
    display: grid;
    gap: 10px;
  }

  .all-users-tx-row {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px;
    background: #f8fbff;
  }

  .all-users-tx-row a {
    margin-top: 8px;
    display: inline-block;
    color: #1d4ed8;
    text-decoration: none;
    font-size: 13px;
    font-weight: 700;
  }

  .all-users-tx-row a:hover {
    text-decoration: underline;
  }

  .all-users-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .all-users-count {
    color: #334155;
    font-size: 13px;
    font-weight: 600;
  }

  .all-users-primary-btn,
  .all-users-form button {
    border: none;
    border-radius: 10px;
    background: #1d4ed8;
    color: #ffffff;
    min-height: 42px;
    padding: 8px 14px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: transform .15s, opacity .15s;
  }

  .all-users-primary-btn:hover:not(:disabled),
  .all-users-form button:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: .92;
  }

  .all-users-primary-btn:disabled,
  .all-users-form button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .all-users-form {
    display: grid;
    gap: 12px;
  }

  .all-users-form label {
    display: grid;
    gap: 7px;
    color: #111827;
    font-size: 13px;
    font-weight: 600;
  }

  .all-users-form input,
  .all-users-form select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 10px 12px;
    background: #fff;
    font-size: 14px;
    outline: none;
    transition: border-color .15s, box-shadow .15s;
  }

  .all-users-form input:focus,
  .all-users-form select:focus {
    border-color: #1d4ed8;
    box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12);
  }

  .all-users-status {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
  }

  .all-users-status-error {
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #b91c1c;
  }

  .all-users-status-success {
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .all-users-empty {
    border: 1px dashed #bfdbfe;
    border-radius: 12px;
    background: #f8fbff;
    padding: 16px;
    color: #475569;
    font-size: 14px;
  }

  .all-users-bike-grid,
  .all-users-order-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  .all-users-bike-title {
    margin: 0 0 10px;
    font-size: 17px;
    color: #0f172a;
  }

  .all-users-bike-dl,
  .all-users-result dl {
    margin: 0;
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 7px 10px;
    font-size: 13px;
  }

  .all-users-bike-dl dt,
  .all-users-result dt {
    color: #4b5563;
    font-weight: 600;
  }

  .all-users-bike-dl dd,
  .all-users-result dd {
    margin: 0;
    color: #111827;
    word-break: break-all;
  }

  .all-users-result {
    margin-top: 12px;
    border: 1px solid #dbe2ea;
    border-radius: 10px;
    background: #f8fbff;
    padding: 12px;
  }

  .all-users-result h4 {
    margin: 0 0 10px;
  }

  .all-users-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    word-break: break-all;
  }

  .all-users-link-btn {
    margin-top: 12px;
    display: inline-block;
    text-decoration: none;
    border: 1px solid #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
    padding: 8px 10px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
  }

  .all-users-link-btn:hover {
    filter: brightness(0.98);
  }

  .all-users-order-links {
    margin-top: 10px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .all-users-order-links a {
    color: #1d4ed8;
    text-decoration: none;
    font-size: 13px;
    font-weight: 700;
  }

  .all-users-order-links a:hover {
    text-decoration: underline;
  }

  .all-users-order-card .all-users-primary-btn {
    margin-top: 12px;
  }

  @media (max-width: 900px) {
    .all-users-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .all-users-shell {
      padding: 18px 12px 32px;
    }

    .all-users-sidebar,
    .all-users-content {
      padding: 14px;
      border-radius: 14px;
    }

    .all-users-content-head {
      align-items: flex-start;
      flex-direction: column;
    }

    .all-users-bike-dl,
    .all-users-result dl {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .all-users-bike-dl dt,
    .all-users-result dt {
      margin-top: 8px;
    }
  }
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
