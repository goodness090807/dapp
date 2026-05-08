// src/contexts/RoleContext.tsx
import { createContext, useContext, useState } from "react";

export type Role = "admin" | "manufacturer" | "retailer" | "consumer";

const ROLES: { value: Role; label: string }[] = [
    { value: "admin", label: "管理員" },
    { value: "manufacturer", label: "製造商" },
    { value: "retailer", label: "零售商" },
    { value: "consumer", label: "所有使用者" },
];

const RoleContext = createContext<{
    role: Role;
    setRole: (r: Role) => void;
}>({ role: "manufacturer", setRole: () => {} });

export function RoleProvider({ children }: { children: React.ReactNode }) {
    const [role, setRole] = useState<Role>(() => (localStorage.getItem("poc_role") as Role) ?? "manufacturer");

    const handleSet = (r: Role) => {
        localStorage.setItem("poc_role", r);
        setRole(r);
    };

    return <RoleContext.Provider value={{ role, setRole: handleSet }}>{children}</RoleContext.Provider>;
}

export const useRole = () => useContext(RoleContext);
export { ROLES };
