import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent, MLRT } from "../generated/templates/MLRT/MLRT"
import { AssetTransfer, ReferralLog } from "../generated/schema"
import { ADDRESS_ZERO, BIGINT_ZERO, DENOMINATOR, EIGEN_POINT_LAUNCH_TIME, ETHER_ONE, POINT_PER_SEC } from "./constants"
import { createOrUpdateAssetHoldingData, loadAndUpdateEigenPointStatus, loadOrCreateReferralData, loadOrCreateReferralGroup, loadReferralStatus } from "./entity-operations"
import { calcGroupBoost, extraBoost } from "./boost-module"

export function handleTransfer(event: TransferEvent): void {
    let transferEvent = new AssetTransfer(event.transaction.hash.concatI32(event.logIndex.toI32()))
    transferEvent.from = event.params.from
    transferEvent.to = event.params.to
    transferEvent.amount = event.params.value
    transferEvent.timestamp = event.block.timestamp
    transferEvent.save()

    const liquidityContracts = [
        Bytes.fromHexString("0xf0d4c12a5768d806021f80a262b4d39d26c58b8d"), // CurveRouter
        Bytes.fromHexString("0x2022d9af896ecf0f1f5b48cddab9e74b5aabcf00"), // msw-swETH
        Bytes.fromHexString("0xc040041088b008eac1bf5fb886eac8c1e244b60f"), // mst-wstETH
        Bytes.fromHexString("0x6177811663a60ac211566be5873c5ed441d9e948"), // PancakeV3Pool swETH/mswETH
        Bytes.fromHexString("0xe4b7ac5a573056cff9c361bc68ad779f7da9d342"), // swETH/mswETH
        Bytes.fromHexString("0x350d6d813be7b64681f91f16a98ef360bd42b66b"), // PancakeV3Pool wstETH/mstETH
        Bytes.fromHexString("0x3e0c9e83f2718c2a05b2dd42e672b335cdf13824") // wstETH/mstETH
    ]

    // skip deposit/withdraw event or curve/range liquidity pair
    if (
        transferEvent.from != ADDRESS_ZERO && transferEvent.to != ADDRESS_ZERO &&
        liquidityContracts.includes(transferEvent.from) && liquidityContracts.includes(transferEvent.to)
    ) {
        // update eigen point first
        let eigenPointStatus = loadAndUpdateEigenPointStatus(event.block.timestamp, event.transaction.index)

        // bind asset's contract
        let mLRTReceipt = MLRT.bind(event.address)
        let try_exchangeRateToNative = mLRTReceipt.try_exchangeRateToNative()
        let exchangeRate = (!try_exchangeRateToNative.reverted) ? try_exchangeRateToNative.value : ETHER_ONE

        // load user's referral data
        let transferFrom = loadOrCreateReferralData(event.params.from)
        let transferReferrerFrom = (transferFrom.referrer.notEqual(ADDRESS_ZERO)) ? loadOrCreateReferralData(transferFrom.referrer) : null
        let transferFromGroup = loadOrCreateReferralGroup(transferFrom.referralGroup)
        let transferTo = loadOrCreateReferralData(event.params.to)
        let transferReferrerTo = (transferTo.referrer.notEqual(ADDRESS_ZERO)) ? loadOrCreateReferralData(transferTo.referrer) : null
        let transferToGroup = loadOrCreateReferralGroup(transferTo.referralGroup)
        let transferAmount = event.params.value
        let transferTvl = transferAmount.times(exchangeRate).div(ETHER_ONE)

        // update users TVL points
        let eigenPointsEarnedFrom = (eigenPointStatus.pointPerTVL.minus(transferFrom.lastEigenPointPerTVL)).times(transferFrom.tvl).div(ETHER_ONE)
        transferFrom.lastEigenPointPerTVL = eigenPointStatus.pointPerTVL
        transferFrom.eigenPoint = transferFrom.eigenPoint.plus(eigenPointsEarnedFrom)
        if (event.block.timestamp.ge(EIGEN_POINT_LAUNCH_TIME)) {
            let baseTime = (transferFrom.lastUpdateTimestamp.lt(EIGEN_POINT_LAUNCH_TIME)) ? EIGEN_POINT_LAUNCH_TIME : transferFrom.lastUpdateTimestamp
            let timeDiff = event.block.timestamp.minus(baseTime)
            let eigenPointsEarned2 = transferFrom.tvl2.times(POINT_PER_SEC).times(timeDiff).div(ETHER_ONE)
            transferFrom.eigenPoint2 = transferFrom.eigenPoint2.plus(eigenPointsEarned2)
        }
        let timeDiffFrom = (transferFrom.lastUpdateTimestamp.gt(BIGINT_ZERO)) ? event.block.timestamp.minus(transferFrom.lastUpdateTimestamp) : BIGINT_ZERO
        let tvlPointEarnedFrom = transferFrom.tvl.times(POINT_PER_SEC).times(timeDiffFrom).div(ETHER_ONE)
        let tvlPointBoostedFrom = tvlPointEarnedFrom.times(transferFromGroup.boost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        transferFrom.tvlPoints = transferFrom.tvlPoints.plus(tvlPointBoostedFrom)
        // let pervTvlFrom = transferFrom.tvl
        transferFrom.tvl = (transferFrom.tvl.gt(transferTvl)) ? transferFrom.tvl.minus(transferTvl) : BIGINT_ZERO
        let tvlPointEarnedFrom2 = transferFrom.tvl2.times(POINT_PER_SEC).times(timeDiffFrom).div(ETHER_ONE)
        let tvlPointBoostedFrom2 = tvlPointEarnedFrom2.times(transferFromGroup.boost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        transferFrom.tvlPoints2 = transferFrom.tvlPoints2.plus(tvlPointBoostedFrom2)

        createOrUpdateAssetHoldingData(transferFrom.id, mLRTReceipt)
        let assetHoldingData = transferFrom.assets.load()
        let newTVL = BIGINT_ZERO
        for (let i = 0; i < assetHoldingData.length; i++) {
            newTVL = newTVL.plus(
                assetHoldingData[i].amount.times(assetHoldingData[i].exchangeRate).div(ETHER_ONE)
            )
        }
        transferFrom.tvl2 = newTVL
        transferFrom.save()

        let eigenPointsEarnedTo = (eigenPointStatus.pointPerTVL.minus(transferTo.lastEigenPointPerTVL)).times(transferTo.tvl).div(ETHER_ONE)
        transferTo.lastEigenPointPerTVL = eigenPointStatus.pointPerTVL
        transferTo.eigenPoint = transferTo.eigenPoint.plus(eigenPointsEarnedTo)
        if (event.block.timestamp.ge(EIGEN_POINT_LAUNCH_TIME)) {
            let baseTime = (transferTo.lastUpdateTimestamp.lt(EIGEN_POINT_LAUNCH_TIME)) ? EIGEN_POINT_LAUNCH_TIME : transferTo.lastUpdateTimestamp
            let timeDiff = event.block.timestamp.minus(baseTime)
            let eigenPointsEarned2 = transferTo.tvl2.times(POINT_PER_SEC).times(timeDiff).div(ETHER_ONE)
            transferTo.eigenPoint2 = transferTo.eigenPoint2.plus(eigenPointsEarned2)
        }
        let timeDiffTo = (transferTo.lastUpdateTimestamp.gt(BIGINT_ZERO)) ? event.block.timestamp.minus(transferTo.lastUpdateTimestamp) : BIGINT_ZERO
        let tvlPointEarnedTo = transferTo.tvl.times(POINT_PER_SEC).times(timeDiffTo).div(ETHER_ONE)
        let tvlPointBoostedTo = tvlPointEarnedTo.times(transferToGroup.boost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        transferTo.tvlPoints = transferTo.tvlPoints.plus(tvlPointBoostedTo)
        // let pervTvlTo = transferTo.tvl
        transferTo.tvl = transferTo.tvl.plus(transferTvl)
        let tvlPointEarnedTo2 = transferTo.tvl2.times(POINT_PER_SEC).times(timeDiffTo).div(ETHER_ONE)
        let tvlPointBoostedTo2 = tvlPointEarnedTo2.times(transferToGroup.boost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        transferTo.tvlPoints2 = transferTo.tvlPoints2.plus(tvlPointBoostedTo2)

        createOrUpdateAssetHoldingData(transferTo.id, mLRTReceipt)
        assetHoldingData = transferTo.assets.load()
        newTVL = BIGINT_ZERO
        for (let i = 0; i < assetHoldingData.length; i++) {
            newTVL = newTVL.plus(
                assetHoldingData[i].amount.times(assetHoldingData[i].exchangeRate).div(ETHER_ONE)
            )
        }
        transferTo.tvl2 = newTVL
        transferTo.save()

        // update referrers of users TVL points
        if (transferReferrerFrom) {
            let referralPointEarned = tvlPointEarnedFrom.times(BigInt.fromI32(10)).div(BigInt.fromI32(100))
            transferReferrerFrom.referralPoints = transferReferrerFrom.referralPoints.plus(referralPointEarned)
            let referralPointEarned2 = tvlPointEarnedFrom2.times(BigInt.fromI32(10)).div(BigInt.fromI32(100))
            transferReferrerFrom.referralPoints2 = transferReferrerFrom.referralPoints2.plus(referralPointEarned2)
            loadOrCreateReferralGroup(transferReferrerFrom.referralGroup) // just create if the group not exist
            transferReferrerFrom.save()

            let referralLog = new ReferralLog(
                Bytes.fromByteArray(
                    crypto.keccak256(
                        event.transaction.hash.concatI32(event.logIndex.toI32()).concat(transferFrom.id)
                    )
                )
            )
            referralLog.referrer = transferFrom.id
            referralLog.referee = transferReferrerFrom.id
            referralLog.referralPointEarned = referralPointEarned
            referralLog.referralPointEarned2 = referralPointEarned2
            referralLog.referralPointsAccumulated = transferReferrerFrom.referralPoints
            referralLog.referralPointsAccumulated2 = transferReferrerFrom.referralPoints2
            referralLog.timestamp = event.block.timestamp
            referralLog.save()
        }

        if (transferReferrerTo) {
            let referralPointEarned = tvlPointEarnedTo.times(BigInt.fromI32(10)).div(BigInt.fromI32(100))
            transferReferrerTo.referralPoints = transferReferrerTo.referralPoints.plus(referralPointEarned)
            let referralPointEarned2 = tvlPointEarnedTo2.times(BigInt.fromI32(10)).div(BigInt.fromI32(100))
            transferReferrerTo.referralPoints2 = transferReferrerTo.referralPoints2.plus(referralPointEarned2)
            loadOrCreateReferralGroup(transferReferrerTo.referralGroup) // just create if the group not exist
            transferReferrerTo.save()

            let referralLog = new ReferralLog(
                Bytes.fromByteArray(
                    crypto.keccak256(
                        event.transaction.hash.concatI32(event.logIndex.toI32()).concat(transferTo.id)
                    )
                )
            )
            referralLog.referrer = transferTo.id
            referralLog.referee = transferReferrerTo.id
            referralLog.referralPointEarned = referralPointEarned
            referralLog.referralPointEarned2 = referralPointEarned2
            referralLog.referralPointsAccumulated = transferReferrerTo.referralPoints
            referralLog.referralPointsAccumulated2 = transferReferrerTo.referralPoints2
            referralLog.timestamp = event.block.timestamp
            referralLog.save()
        }

        // check sender and receiver is in the same group or not
        if (transferFromGroup.id.notEqual(transferToGroup.id)) {
            transferFromGroup.groupTVL = (transferFromGroup.groupTVL.gt(transferTvl)) ? transferFromGroup.groupTVL.minus(transferTvl) : BIGINT_ZERO
            transferFromGroup.groupTVL2 = (transferFromGroup.groupTVL2.gt(transferTvl)) ? transferFromGroup.groupTVL2.minus(transferTvl) : BIGINT_ZERO
            transferFromGroup.boost = calcGroupBoost(transferFromGroup.groupTVL)
            transferFromGroup.boost2 = calcGroupBoost(transferFromGroup.groupTVL2)
            transferFromGroup.save()
            transferToGroup.groupTVL = transferToGroup.groupTVL.plus(transferTvl)
            transferToGroup.groupTVL2 = transferToGroup.groupTVL2.plus(transferTvl)
            transferToGroup.boost = calcGroupBoost(transferToGroup.groupTVL)
            transferToGroup.boost2 = calcGroupBoost(transferToGroup.groupTVL2)
            transferToGroup.save()
        }

    }
}