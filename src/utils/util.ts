export type BikeObjectData = {
    objectId: string;
    version: string;
    digest: string;
    content?: unknown;
    owner?: unknown;
    previousTransaction?: unknown;
};

export const shouldShowSellButton = (data: BikeObjectData, walletAddress: string | undefined) => {
    const content = data?.content;
    const owner = data?.owner;

    const state = Number((content as { fields: { state: unknown } }).fields.state);

    const ownerAddress = owner && typeof owner === "object" && "AddressOwner" in owner ? String((owner as { AddressOwner?: unknown }).AddressOwner) : "";

    if (!walletAddress) return false;
    return state === 1 && ownerAddress.toLowerCase() === walletAddress.toLowerCase();
};
