import { createNetworkConfig, IotaClientProvider, WalletProvider } from "@iota/dapp-kit";
import { getFullnodeUrl } from "@iota/iota-sdk/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const { networkConfig } = createNetworkConfig({
    testnet: { url: getFullnodeUrl("testnet") },
});
const queryClient = new QueryClient();

createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <IotaClientProvider networks={networkConfig} defaultNetwork="testnet">
                <WalletProvider>
                    <App />
                </WalletProvider>
            </IotaClientProvider>
        </QueryClientProvider>
    </StrictMode>,
);
