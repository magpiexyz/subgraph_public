import { Address, BigInt } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent, LiquidityAdded as LiquidityAddedEvent, LiquidityRemoved as LiquidityRemovedEvent, RangeLP } from "../generated/RangeLp-swETH-mswETH/RangeLP"
import { mlrtLiquidityStatus } from "../generated/schema"
import { BIGINT_ZERO, ETHER_ONE } from "./constants"

function updateLiquidity(contractAddress: Address, blockTimestamp: BigInt): void {
    let RangeLp = RangeLP.bind(contractAddress)
    let status = mlrtLiquidityStatus.load("RangeLP-".concat(contractAddress.toHexString()))

    if (!status) {
        status = new mlrtLiquidityStatus("RangeLP-".concat(contractAddress.toHexString()))
    }

    let storedBalabce = RangeLp.getUnderlyingBalances()
    status.token0Balance = storedBalabce.getAmount0Current()
    status.token1Balance = storedBalabce.getAmount1Current()
    status.totalSupply = RangeLp.totalSupply()
    status.mlrtPerShare = status.token0Balance.times(ETHER_ONE).div(status.totalSupply)
    status.updateTimestamp = blockTimestamp
    status.save()
}

export function handleTransfer(event: TransferEvent): void {
    // swap transacrtion
    if ( // wstETH/mstETH
        event.params.from == Address.fromHexString("0x350d6d813be7b64681f91f16a98ef360bd42b66b") ||
        event.params.to == Address.fromHexString("0x350d6d813be7b64681f91f16a98ef360bd42b66b")
    ) {
        updateLiquidity(event.address, event.block.timestamp)
    } else if ( // swETH/mswETH
        event.params.from == Address.fromHexString("0x6177811663a60ac211566be5873c5ed441d9e948") ||
        event.params.to == Address.fromHexString("0x6177811663a60ac211566be5873c5ed441d9e948")
    ) {
        updateLiquidity(event.address, event.block.timestamp)
    }
}

export function handleLiquidityAdded(event: LiquidityAddedEvent): void {
    updateLiquidity(event.address, event.block.timestamp)
}

export function handleLiquidityRemoved(event: LiquidityRemovedEvent): void {
    updateLiquidity(event.address, event.block.timestamp)
}