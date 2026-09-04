import { useEffect, useState } from "react";
import type { FormattedBikeData, BikeNFTContent } from "../utils/cidHelper";
import { formatBikeData, getCIDUrl, shortenAddress } from "../utils/cidHelper";
import BikeEventsModal from "./BikeEventsModal";

interface BikeDataDisplayProps {
    content: BikeNFTContent | null;
    objectId?: string;
}

interface BikePartMetadata {
    category?: string;
    name?: string;
}

export const BikeDataDisplay = ({ content, objectId }: BikeDataDisplayProps) => {
    const [formattedData, setFormattedData] = useState<FormattedBikeData | null>(null);
    const [metadata, setMetadata] = useState<BikePartMetadata[] | null>(null);
    const gateway = import.meta.env.VITE_PINATA_GATEWAY;
    const explorerUrl = objectId ? `https://explorer.iota.org/object/${objectId}?network=testnet` : "";

    useEffect(() => {
        if (content) {
            setFormattedData(formatBikeData(content));
        }
    }, [content]);

    useEffect(() => {
        const fetchMetadata = async () => {
            if (!content?.metadata_cid || !gateway) return;
            try {
                const url = getCIDUrl(content.metadata_cid, gateway);
                const response = await fetch(url);
                const data = await response.json();
                setMetadata(Array.isArray(data) ? (data as BikePartMetadata[]) : null);
            } catch (error) {
                console.error("Failed to fetch metadata:", error);
            }
        };
        fetchMetadata();
    }, [content?.metadata_cid, gateway]);

    if (!formattedData) return null;

    const imageUrl = formattedData.cids.image ? getCIDUrl(formattedData.cids.image, gateway) : "";
    const warrantyUrl = formattedData.cids.manufacturerWarranty ? getCIDUrl(formattedData.cids.manufacturerWarranty, gateway) : "";
    const certificateUrl = formattedData.cids.certificate ? getCIDUrl(formattedData.cids.certificate, gateway) : "";

    return (
        <div className="bike-data-display-compact">
            <div className="bike-compact-layout">
                {/* 右上角圖片 */}
                {imageUrl && (
                    <div className="bike-image-corner">
                        <img
                            src={imageUrl}
                            alt={formattedData.basicInfo.name}
                            className="bike-image-compact"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                    </div>
                )}

                {/* 右下角原廠保固與保固證書圖片 */}
                {(warrantyUrl || certificateUrl) && (
                    <div className="bike-certificate-corner">
                        {warrantyUrl && (
                            <img
                                src={warrantyUrl}
                                alt={`${formattedData.basicInfo.name} 原廠保固`}
                                className="bike-warranty-compact"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                }}
                            />
                        )}
                        {certificateUrl && (
                            <img
                                src={certificateUrl}
                                alt={`${formattedData.basicInfo.name} 保固證書`}
                                className="bike-certificate-compact"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                }}
                            />
                        )}
                    </div>
                )}

                {/* 左側內容區域 */}
                <div className="bike-compact-content">
                    {/* 標題和區塊鏈連結 */}
                    <div className="bike-compact-header">
                        <h4 className="bike-compact-title">{formattedData.basicInfo.name}</h4>
                        {objectId && <BikeEventsModal objectId={objectId} />}
                        {explorerUrl && (
                            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="bike-chain-link">
                                查看鏈上
                            </a>
                        )}
                    </div>

                    {/* 精簡的二行三列佈局 */}
                    <div className="bike-compact-grid">
                        <div className="bike-compact-item">
                            <span className="bike-compact-label">車架號</span>
                            <span className="bike-compact-value">{formattedData.basicInfo.frameNo}</span>
                        </div>
                        <div className="bike-compact-item">
                            <span className="bike-compact-label">品牌</span>
                            <span className="bike-compact-value">{formattedData.basicInfo.brand}</span>
                        </div>
                        <div className="bike-compact-item">
                            <span className="bike-compact-label">型號</span>
                            <span className="bike-compact-value">{formattedData.basicInfo.model}</span>
                        </div>

                        <div className="bike-compact-item">
                            <span className="bike-compact-label">材料</span>
                            <span className="bike-compact-value">{formattedData.technicalInfo.frameMaterial}</span>
                        </div>
                        <div className="bike-compact-item">
                            <span className="bike-compact-label">年份</span>
                            <span className="bike-compact-value">{formattedData.technicalInfo.manufacturedYear}</span>
                        </div>
                        <div className="bike-compact-item">
                            <span className="bike-compact-label">出廠時間</span>
                            <span className="bike-compact-value">{formattedData.timestamps.minted}</span>
                        </div>
                        <div className="bike-compact-item">
                            <span className="bike-compact-label">品牌方</span>
                            <span className="bike-compact-value bike-address" title={formattedData.addresses.brandOwner}>
                                {shortenAddress(formattedData.addresses.brandOwner, 6)}
                            </span>
                        </div>
                        <div className="bike-compact-item">
                            <span className="bike-compact-label">經銷商</span>
                            <span className="bike-compact-value bike-address" title={formattedData.addresses.dealer}>
                                {shortenAddress(formattedData.addresses.dealer, 6)}
                            </span>
                        </div>
                    </div>

                    {/* 部件信息 */}
                    {metadata && Array.isArray(metadata) && metadata.length > 0 && (
                        <div className="bike-compact-section">
                            <div className="bike-compact-label-section">零件</div>
                            <div className="bike-parts-compact">
                                {metadata.slice(0, 3).map((part, idx: number) => (
                                    <div key={idx} className="bike-part-row">
                                        <span className="bike-part-category">{part.category || "-"}</span>
                                        <span className="bike-part-name">{part.name || "-"}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Compact styles
const styles = `
    .bike-data-display-compact {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #fff;
    }

    .bike-compact-layout {
        position: relative;
        padding: 16px;
        display: grid;
        grid-template-columns: 1fr 160px;
        gap: 16px;
        min-height: 280px;
    }

    .bike-image-corner {
        grid-column: 2;
        grid-row: 1;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
    }

    .bike-image-compact {
        max-width: 160px;
        max-height: 160px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid #d1d5db;
    }

    .bike-certificate-corner {
        position: absolute;
        right: 16px;
        bottom: 16px;
        display: flex;
        gap: 8px;
        align-items: flex-end;
        justify-content: flex-end;
        pointer-events: none;
    }

    .bike-warranty-compact {
        max-width: 168px;
        max-height: 168px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid #d1d5db;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    }

    .bike-certificate-compact {
        max-width: 168px;
        max-height: 168px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid #d1d5db;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    }

    .bike-compact-content {
        grid-column: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-right: 8px;
    }

    .bike-compact-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
    }

    .bike-compact-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #111827;
        flex: 1;
    }

    .bike-chain-link {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        background: #dbeafe;
        color: #1e40af;
        text-decoration: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        border: 1px solid #93c5fd;
    }

    .bike-chain-link:hover {
        background: #bfdbfe;
        border-color: #60a5fa;
    }

    .bike-compact-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
    }

    .bike-compact-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        background: #f9fafb;
        border-radius: 6px;
        border: 1px solid #f3f4f6;
    }

    .bike-compact-label {
        font-size: 11px;
        color: #6b7280;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .bike-compact-value {
        font-size: 12px;
        color: #111827;
        font-weight: 500;
        word-break: break-word;
    }

    .bike-address {
        font-family: monospace;
        color: #059669;
        font-weight: 600;
    }

    .bike-compact-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .bike-compact-label-section {
        font-size: 11px;
        color: #6b7280;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .bike-parts-compact {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
    }

    .bike-part-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 5px 7px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        min-width: 0;
    }

    .bike-part-category {
        font-size: 10px;
        color: #1d4ed8;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .bike-part-name {
        font-size: 11px;
        color: #166534;
        font-weight: 500;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .bike-compact-links {
        display: flex;
        gap: 8px;
        margin-top: 4px;
    }

    .bike-cid-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: #fef3c7;
        border: 1px solid #fde68a;
        border-radius: 6px;
        text-decoration: none;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .bike-cid-tag:hover {
        background: #fcd34d;
        border-color: #fbbf24;
        transform: scale(1.1);
    }

    .bike-compact-tabs {
        display: flex;
        gap: 0;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
    }

    .bike-compact-tab {
        flex: 1;
        padding: 10px;
        border: none;
        background: transparent;
        color: #6b7280;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
    }

    .bike-compact-tab:hover {
        color: #374151;
    }

    .bike-compact-tab.active {
        color: #2563eb;
        border-bottom-color: #2563eb;
    }

    .bike-compact-raw {
        padding: 16px;
        max-height: 340px;
        overflow-y: auto;
    }

    .trace-json {
        margin: 0;
        background: #0f172a;
        color: #d1fae5;
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
        line-height: 1.4;
        overflow-x: auto;
    }

    @media (max-width: 768px) {
        .bike-compact-layout {
            grid-template-columns: 1fr;
            gap: 12px;
        }

        .bike-image-corner {
            grid-column: 1;
            justify-content: flex-start;
        }

        .bike-certificate-corner {
            right: 12px;
            bottom: 12px;
        }

        .bike-certificate-compact {
            max-width: 144px;
            max-height: 144px;
        }

        .bike-compact-grid {
            grid-template-columns: 1fr 1fr;
        }

        .bike-parts-compact {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 480px) {
        .bike-parts-compact {
            grid-template-columns: 1fr;
        }
    }
`;
export default BikeDataDisplay;

// Export styles for injection
export const BikeDataDisplayStyles = new CSSStyleSheet();
BikeDataDisplayStyles.replaceSync(styles);
