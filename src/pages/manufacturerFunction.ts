import { useCallback, useState } from "react";
import { useCurrentAccount, useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PinataSDK } from "pinata";

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID as string;
const REGISTRY_ID = import.meta.env.VITE_REGISTRY_ID as string;
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string;
const CLOCK_ID = "0x6";

export type BikePart = {
    category: string;
    name: string;
};

export function useMintBikeNft() {
    const client = useIotaClient();
    const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
    const account = useCurrentAccount();

    const [bikeObjectId, setBikeObjectId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    const mintBike = useCallback(
        async (input: {
            name: string;
            frameNo: string;
            brand: string;
            model: string;
            frameMaterial: string;
            manufacturedYear: number;
            retailerAddress: string;
            imageFile: File;
            parts: {
                category: string;
                name: string;
            }[];
        }) => {
            setIsPending(true);
            setError(null);
            setBikeObjectId(null);

            try {
                console.log(input);
                const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });
                const imageUpload = await pinata.upload.public.file(input.imageFile);
                const metadataUpload = await pinata.upload.public.json(input.parts);

                const tx = new Transaction();
                tx.moveCall({
                    target: `${PACKAGE_ID}::bike::mint_bike_nft`,
                    arguments: [
                        tx.object(REGISTRY_ID),
                        tx.pure.string(input.name),
                        tx.pure.string(input.frameNo),
                        tx.pure.string(input.brand),
                        tx.pure.string(input.model),
                        tx.pure.string(input.frameMaterial),
                        tx.pure.u64(input.manufacturedYear),
                        tx.pure.string(imageUpload.cid),
                        tx.pure.address(input.retailerAddress),
                        tx.pure.string(metadataUpload.cid),
                        tx.object(CLOCK_ID),
                    ],
                });

                const { digest } = await signAndExecute({
                    transaction: tx,
                    options: { showEvents: true, showObjectChanges: true },
                });

                const txResult = await client.waitForTransaction({
                    digest,
                    options: { showEvents: true, showObjectChanges: true },
                });

                const createdObject = txResult.objectChanges?.find(
                    (change): change is typeof change & { objectId: string } =>
                        change.type === "created" &&
                        "objectType" in change &&
                        (change.objectType as string).includes("BikeNFT"),
                );

                setBikeObjectId(createdObject?.objectId ?? null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "鑄造失敗");
            } finally {
                setIsPending(false);
            }
        },
        [account, client, signAndExecute],
    );

    return { mintBike, isPending, bikeObjectId, error };
}
