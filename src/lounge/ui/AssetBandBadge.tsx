import {assetBandLabel, type AssetBand} from '../domain/assetBand';

export function AssetBandBadge({band, id}: {band?: AssetBand | null; id?: string}) {
  return band ? <span id={id} className="lounge-asset-badge">자산 규모 · {assetBandLabel(band)}</span> : null;
}
