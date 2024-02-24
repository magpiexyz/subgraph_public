import { Address, BigInt } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent, AddLiquidity as AddLiquidityEvent, RemoveLiquidity as RemoveLiquidityEvent, TokenExchange as TokenExchangeEvent, CurveLP } from "../generated/CurveLP-msw-swETH/CurveLP"
import { mlrtLiquidityStatus } from "../generated/schema"
import { BIGINT_ZERO, ETHER_ONE } from "./constants"

function updateLiquidity(contractAddress: Address, blockTimestamp: BigInt): void {
    let curveLp = CurveLP.bind(contractAddress)
    let status = mlrtLiquidityStatus.load("CurveLP-".concat(contractAddress.toHexString()))

    if (!status) {
        status = new mlrtLiquidityStatus("CurveLP-".concat(contractAddress.toHexString()))
    }

    let storedBalabce = curveLp.get_balances()
    status.token0Balance = storedBalabce[0]
    status.token1Balance = storedBalabce[1]
    status.totalSupply = curveLp.totalSupply()
    status.mlrtPerShare = status.token0Balance.times(ETHER_ONE).div(status.totalSupply)
    status.updateTimestamp = blockTimestamp
    status.save()
}

export function handleTransfer(event: TransferEvent): void {
    // WIP
}

export function handleAddLiquidity(event: AddLiquidityEvent): void {
    updateLiquidity(event.address, event.block.timestamp)
}

export function handleRemoveLiquidity(event: RemoveLiquidityEvent): void {
    updateLiquidity(event.address, event.block.timestamp)
}

export function handleTokenExchange(event: TokenExchangeEvent): void {
    updateLiquidity(event.address, event.block.timestamp)
}