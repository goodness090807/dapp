/**
 * Helper functions for handling CID (Content Identifier) and Pinata gateway access
 */

export const getCIDUrl = (cid: string, gateway: string): string => {
    if (!cid || !gateway) return "";
    return `https://${gateway}/ipfs/${cid}`;
};

export interface BikeNFTContent {
    brand_owner_address: string;
    brand: string;
    certificate_cid: string;
    dealer_address: string;
    frame_material: string;
    frame_no: string;
    id: {
        id: string;
    };
    image_cid: string;
    manufactured_year: string;
    manufacturer_warranty_cid: string;
    metadata_cid: string;
    minted_at: string;
    model: string;
    name: string;
    state: number;
    updated_at: string;
}

export interface FormattedBikeData {
    basicInfo: {
        name: string;
        frameNo: string;
        brand: string;
        model: string;
    };
    technicalInfo: {
        frameMaterial: string;
        manufacturedYear: string;
    };
    addresses: {
        brandOwner: string;
        dealer: string;
    };
    cids: {
        image: string;
        manufacturerWarranty: string;
        metadata: string;
        certificate: string;
    };
    timestamps: {
        minted: string;
        updated: string;
    };
    state: number;
}

const formatOnchainTimestamp = (value: string): string => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return "-";
    const normalized = num < 1e11 ? num * 1000 : num;
    return new Date(normalized).toLocaleString("zh-TW", { hour12: false });
};

export const formatBikeData = (content: BikeNFTContent): FormattedBikeData => {
    return {
        basicInfo: {
            name: content.name,
            frameNo: content.frame_no,
            brand: content.brand,
            model: content.model,
        },
        technicalInfo: {
            frameMaterial: content.frame_material,
            manufacturedYear: content.manufactured_year,
        },
        addresses: {
            brandOwner: content.brand_owner_address,
            dealer: content.dealer_address,
        },
        cids: {
            image: content.image_cid,
            manufacturerWarranty: content.manufacturer_warranty_cid,
            metadata: content.metadata_cid,
            certificate: content.certificate_cid,
        },
        timestamps: {
            minted: formatOnchainTimestamp(content.minted_at),
            updated: formatOnchainTimestamp(content.updated_at),
        },
        state: content.state,
    };
};

export const formatTimestamp = (timestamp: string): string => {
    const num = Number(timestamp);
    if (isNaN(num)) return timestamp;
    return new Date(num).toLocaleString("zh-TW");
};

export const shortenAddress = (address: string, chars: number = 6): string => {
    if (!address || address.length < chars * 2) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};
