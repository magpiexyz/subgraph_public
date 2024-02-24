import { BigInt } from "@graphprotocol/graph-ts"
import { DENOMINATOR, ETHER_ONE } from "./constants"

export function calcGroupBoost(tvl: BigInt): BigInt {
    let groupBoost = DENOMINATOR

    const tvlThresholds: BigInt[] = [
        BigInt.fromI32(100).times(ETHER_ONE),
        BigInt.fromI32(500).times(ETHER_ONE),
        BigInt.fromI32(1000).times(ETHER_ONE),
        BigInt.fromI32(2000).times(ETHER_ONE),
        BigInt.fromI32(5000).times(ETHER_ONE)
    ]

    const boostValues = [12000, 14000, 16000, 18000, 20000]

    for (let i = tvlThresholds.length - 1; i >= 0; i--) {
        if (tvl.ge(tvlThresholds[i])) {
            groupBoost = BigInt.fromI32(boostValues[i])
            break
        }
    }

    return groupBoost
}

export function extraBoost(timestamp: BigInt): BigInt {
    let boost = DENOMINATOR
    if (timestamp.le(BigInt.fromI32(1707782400)))
        boost = DENOMINATOR.times(BigInt.fromI32(2))
    return boost
}