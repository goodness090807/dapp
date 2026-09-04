import { useCurrentAccount, useDisconnectWallet, useConnectWallet, useWallets } from "@iota/dapp-kit";

export function WalletButton() {
    const account = useCurrentAccount();
    const wallets = useWallets();
    const { mutate: connect } = useConnectWallet();
    const { mutate: disconnect } = useDisconnectWallet();

    if (account) {
        const shortAddress = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
        return (
            <button className="wb-btn wb-connected" onClick={() => disconnect()}>
                <span className="wb-dot" />
                {shortAddress}
            </button>
        );
    }

    return (
        <button className="wb-btn wb-idle" onClick={() => wallets[0] && connect({ wallet: wallets[0] })} disabled={wallets.length === 0}>
            連接錢包
        </button>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .wb-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 8px; border: none;
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: opacity .15s;
    font-family: inherit;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    justify-content: center;
  }
  .wb-btn:hover:not(:disabled) { opacity: .85; }
  .wb-btn:disabled { opacity: .4; cursor: not-allowed; }
  .wb-idle  { background: #2563eb; color: #fff; }
  .wb-connected { background: #f3f4f6; color: #111827; border: 1px solid #e5e7eb; }
  .wb-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .wb-btn {
      width: 100%;
    }
  }
`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
