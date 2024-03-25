import { AddedNewSupportedAsset as AddedNewSupportedAssetEvent, ReceiptTokenUpdated as ReceiptTokenUpdatedEvent, AssetStrategyUpdate as AssetStrategyUpdateEvent, EigenpieConfig } from "../generated/EigenpieConfig/EigenpieConfig"
import { MLRT } from "../generated/templates"
import { TrackedMLRT } from "../generated/schema"
import { ADDRESS_ZERO } from "./constants"

export function handleAddedNewSupportedAsset(event: AddedNewSupportedAssetEvent): void {
  MLRT.create(event.params.receipt);
}

export function handleReceiptTokenUpdated(event: ReceiptTokenUpdatedEvent): void {
  MLRT.create(event.params.receipt);

  let trackedMLRT = new TrackedMLRT(event.params.receipt)
  trackedMLRT.underlying = event.params.asset
  trackedMLRT.strategy = ADDRESS_ZERO
  trackedMLRT.addedTimestamp = event.block.timestamp
  trackedMLRT.save()
}