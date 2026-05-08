import { AdminPage } from "./pages/AdminPage";
import { AllUsersPage } from "./pages/AllUsersPage";
import { ManufacturerPage } from "./pages/ManufacturerPage";
import { RetailerPage } from "./pages/RetailerPage";
import { RoleProvider, useRole } from "./utils/RoleContext";
import { RoleSwitcher } from "./utils/RoleSwitcher";
import { WalletButton } from "./utils/WalletButton";

function PageRouter() {
    const { role } = useRole();

    return (
        <div style={{ paddingTop: 60 }}>
            {role === "admin" && <AdminPage />}
            {role === "manufacturer" && <ManufacturerPage />}
            {role === "retailer" && <RetailerPage />}
            {role === "consumer" && <AllUsersPage />}
        </div>
    );
}

export default function App() {
    return (
        <RoleProvider>
            {/* 開發用切換列 */}
            <RoleSwitcher />

            {/* 右上角錢包按鈕 */}
            <div style={{ position: "fixed", top: 12, right: 16, zIndex: 9999 }}>
                <WalletButton />
            </div>

            <PageRouter />
        </RoleProvider>
    );
}
