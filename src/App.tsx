import { useEffect, useState } from "react";
import { WalletButton } from "./utils/WalletButton";
import { RegisterPage } from "./pages/RegisterPage";
import { MintBikeNFTPage } from "./pages/MintBikeNFTPage";
import BikeTracePage from "./pages/BikeTracePage";
import SaleOrderPage from "./pages/SaleOrderPage";
import QueryMaintenancePage from "./pages/QueryMaintenancePage";
import QueryRetailerPage from "./pages/QueryRetailerPage";

type Pages = "register" | "retailerquery" | "mintbikenft" | "biketrace" | "saleorder" | "maintenance";

const PAGE_ITEMS: Array<{ key: Pages; label: string; path: string }> = [
    { key: "register", label: "經銷商授權", path: "/register" },
    { key: "retailerquery", label: "經銷商資料查詢", path: "/retailerquery" },
    { key: "mintbikenft", label: "鑄造自行車", path: "/mintbikenft" },
    { key: "biketrace", label: "自行車履歷查詢", path: "/biketrace" },
    { key: "saleorder", label: "銷售單查詢", path: "/saleorder" },
    { key: "maintenance", label: "維修單查詢", path: "/maintenance" },
];

function getPageFromPath(): Pages {
    if (typeof window === "undefined") {
        return "register";
    }

    const pathname = window.location.pathname.toLowerCase();
    const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "register";

    switch (firstSegment) {
        case "mintbikenft":
        case "biketrace":
        case "saleorder":
        case "maintenance":
        case "retailerquery":
        case "register":
            return firstSegment;
        default:
            return "register";
    }
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    .app-shell {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }

    .app-navbar-wrap {
        width: min(100%, 1120px);
        margin: 0 auto;
        padding: 12px;
        box-sizing: border-box;
    }

    .app-navbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }

    .app-nav-list {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .app-nav-btn {
        border: 1px solid #d1d5db;
        background: #f8fafc;
        color: #0f172a;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .app-nav-btn:hover {
        border-color: #93c5fd;
        background: #eff6ff;
    }

    .app-nav-btn.is-active {
        background: #2563eb;
        border-color: #2563eb;
        color: #ffffff;
    }

    .app-wallet-slot {
        width: 220px;
        min-width: 180px;
    }

    .app-page-content {
        padding-top: 0;
    }

    .app-page-register { --app-form-width: 460px; }
    .app-page-mintbikenft { --app-form-width: 1120px; }
    .app-page-biketrace { --app-form-width: 920px; }
    .app-page-saleorder { --app-form-width: 920px; }
    .app-page-maintenance { --app-form-width: 920px; }
    .app-page-retailerquery { --app-form-width: 920px; }

    @media (max-width: 640px) {
        .app-navbar-wrap {
            padding: 8px 12px;
        }

        .app-navbar {
            flex-direction: column;
            align-items: stretch;
        }

        .app-nav-list {
            justify-content: center;
        }

        .app-wallet-slot {
            width: 100%;
            min-width: 0;
        }

        .app-page-content {
            padding-top: 10px;
        }
    }
`);

if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

export default function App() {
    const [page, setPage] = useState<Pages>(getPageFromPath());

    useEffect(() => {
        const onPopState = () => setPage(getPageFromPath());
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    const switchPage = (nextPage: Pages) => {
        if (nextPage === page) return;
        const nextPath = PAGE_ITEMS.find((item) => item.key === nextPage)?.path ?? "/register";
        window.history.pushState({}, "", nextPath);
        setPage(nextPage);
    };

    return (
        <>
            <div className={`app-shell app-page-${page}`}>
                <div className="app-navbar-wrap">
                    <nav className="app-navbar" aria-label="Page Switcher Navbar">
                        <div className="app-nav-list">
                            {PAGE_ITEMS.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={`app-nav-btn ${item.key === page ? "is-active" : ""}`}
                                    onClick={() => switchPage(item.key)}>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <div className="app-wallet-slot">
                            <WalletButton />
                        </div>
                    </nav>
                </div>
                <div className="app-page-content">
                    {page === "register" && <RegisterPage />}
                    {page === "retailerquery" && <QueryRetailerPage />}
                    {page === "mintbikenft" && <MintBikeNFTPage />}
                    {page === "biketrace" && <BikeTracePage />}
                    {page === "saleorder" && <SaleOrderPage />}
                    {page === "maintenance" && <QueryMaintenancePage />}
                </div>
            </div>
        </>
    );
}
