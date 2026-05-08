// src/hooks/useRegisterRetailer.ts
import { useCallback, useState } from "react";
import { useSignAndExecuteTransaction, useIotaClient, useCurrentAccount } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PinataSDK } from "pinata";

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID as string;
const REGISTRY_ID = import.meta.env.VITE_REGISTRY_ID as string;
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string;
const CLOCK_ID = "0x6";

export type RegistrableRole = "retailer" | "manufacturer";

export function useRegisterRetailer() {
    const client = useIotaClient();
    const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
    const account = useCurrentAccount();

    const [txDigest, setTxDigest] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    const register = useCallback(
        async (role: RegistrableRole, name: string, phone: string, location: string, address: string) => {
            setIsPending(true);
            setError(null);
            setTxDigest(null);

            try {
                // 查詢 AdminCap
                const res = await client.getOwnedObjects({
                    owner: account!.address,
                    filter: { StructType: `${PACKAGE_ID}::registry::AdminCap` },
                    options: { showType: true },
                });
                const adminCapId = res.data[0]?.data?.objectId;
                if (!adminCapId) throw new Error("當前錢包無管理員權限");

                const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });
                const uploadResult = await pinata.upload.public
                    .json({
                        name: name.trim(),
                        phone: phone.trim(),
                        location: location.trim(),
                    })
                    .name(`identity-${Date.now()}`)
                    .keyvalues({ type: "identity" });

                // 建構並送出交易
                const tx = new Transaction();
                tx.moveCall({
                    target: `${PACKAGE_ID}::registry::register_${role}`,
                    arguments: [
                        tx.object(REGISTRY_ID),
                        tx.pure.address(address),
                        tx.pure.string(uploadResult.cid),
                        tx.object(CLOCK_ID),
                        tx.object(adminCapId),
                    ],
                });

                const { digest } = await signAndExecute({ transaction: tx });
                await client.waitForTransaction({ digest });
                setTxDigest(digest);
            } catch (err) {
                setError(err instanceof Error ? err.message : "交易失敗");
            } finally {
                setIsPending(false);
            }
        },
        [client, signAndExecute, account],
    );

    return { register, isPending, txDigest, error };
}
