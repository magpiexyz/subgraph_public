import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent, MLRT } from "../generated/templates/MLRT/MLRT"
import { AssetTransfer, ReferralLog } from "../generated/schema"
import { ADDRESS_ZERO, BIGINT_ZERO, DENOMINATOR, EIGEN_POINT_LAUNCH_TIME, ETHER_ONE, MLRT_POINT_PER_SEC, POINT_PER_SEC } from "./constants"
import { createOrUpdateAssetHoldingData, loadAndUpdateEigenPointStatus, loadOrCreateReferralData, loadOrCreateReferralGroup, loadReferralStatus } from "./entity-operations"
import { calcGroupBoost, extraBoost } from "./boost-module"

export function handleTransfer(event: TransferEvent): void {   

    let transferEvent = new AssetTransfer(event.transaction.hash.concatI32(event.logIndex.toI32()))
    transferEvent.from = event.params.from
    transferEvent.to = event.params.to
    transferEvent.amount = event.params.value
    transferEvent.timestamp = event.block.timestamp
    transferEvent.save()

    // skip deposit and withdraw event
    if (transferEvent.from != ADDRESS_ZERO && transferEvent.to != ADDRESS_ZERO) {
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
        transferFrom.lastEigenPointPerTVL = eigenPointStatus.pointPerTVL // do we need it anymore?
        if (event.block.timestamp.ge(EIGEN_POINT_LAUNCH_TIME)) {
            let baseTime = (transferFrom.lastUpdateTimestamp.lt(EIGEN_POINT_LAUNCH_TIME)) ? EIGEN_POINT_LAUNCH_TIME : transferFrom.lastUpdateTimestamp
            let timeDiff = event.block.timestamp.minus(baseTime)
            let eigenPointsEarned = transferFrom.tvl.times(POINT_PER_SEC).times(timeDiff).div(ETHER_ONE)
            transferFrom.eigenPoint = transferFrom.eigenPoint.plus(eigenPointsEarned)
        }
        let timeDiffFrom = (transferFrom.lastUpdateTimestamp.gt(BIGINT_ZERO)) ? event.block.timestamp.minus(transferFrom.lastUpdateTimestamp) : BIGINT_ZERO
        let mLRTPointEarnedFrom = transferFrom.mLRTTVL.times(MLRT_POINT_PER_SEC).times(timeDiffFrom).div(ETHER_ONE)
        let mLRTPointBoostedFrom = mLRTPointEarnedFrom.times(transferFromGroup.boost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        transferFrom.mLRTPoints = transferFrom.mLRTPoints.plus(mLRTPointBoostedFrom)

        let tvlPointEarnedFrom = transferFrom.tvl.times(POINT_PER_SEC).times(timeDiffFrom).div(ETHER_ONE)
        let tvlPointBoostedFrom = tvlPointEarnedFrom.times(transferFromGroup.boost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        transferFrom.tvlPoints = transferFrom.tvlPoints.plus(tvlPointBoostedFrom)
        createOrUpdateAssetHoldingData(transferFrom.id, mLRTReceipt)
        let assetHoldingData = transferFrom.assets.load()
        let newTVL = BIGINT_ZERO, newmLRTTVL = BIGINT_ZERO
        for (let i = 0; i < assetHoldingData.length; i++) {
            newTVL = newTVL.plus(
                assetHoldingData[i].amount.times(assetHoldingData[i].exchangeRate).div(ETHER_ONE)
            )
            let mLRTContract = MLRT.bind(Address.fromBytes(assetHoldingData[i].assetAddr))
            newmLRTTVL = newmLRTTVL.plus(mLRTContract.balanceOf(Address.fromBytes(transferFrom.id)))
        }
        transferFrom.tvl = newTVL
        transferFrom.mLRTTVL = newmLRTTVL
        transferFrom.save()

        transferTo.lastEigenPointPerTVL = eigenPointStatus.pointPerTVL // do we need it anymore?
        if (event.block.timestamp.ge(EIGEN_POINT_LAUNCH_TIME)) {
            let baseTime = (transferTo.lastUpdateTimestamp.lt(EIGEN_POINT_LAUNCH_TIME)) ? EIGEN_POINT_LAUNCH_TIME : transferTo.lastUpdateTimestamp
            let timeDiff = event.block.timestamp.minus(baseTime)
            let eigenPointsEarned = transferTo.tvl.times(POINT_PER_SEC).times(timeDiff).div(ETHER_ONE)
            transferTo.eigenPoint = transferTo.eigenPoint.plus(eigenPointsEarned)
        }
        let timeDiffTo = (transferTo.lastUpdateTimestamp.gt(BIGINT_ZERO)) ? event.block.timestamp.minus(transferTo.lastUpdateTimestamp) : BIGINT_ZERO
        let tvlPointEarnedTo = transferTo.tvl.times(POINT_PER_SEC).times(timeDiffTo).div(ETHER_ONE)
        let tvlPointBoostedTo = tvlPointEarnedTo.times(transferToGroup.boost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        let mLRTPointEarnedTo = transferTo.mLRTTVL.times(MLRT_POINT_PER_SEC).times(timeDiffFrom).div(ETHER_ONE)
        let mLRTPointBoostedTo = mLRTPointEarnedTo.times(transferToGroup.boost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        transferTo.mLRTPoints = transferTo.mLRTPoints.plus(mLRTPointBoostedTo)
        transferTo.tvlPoints = transferTo.tvlPoints.plus(tvlPointBoostedTo)

        createOrUpdateAssetHoldingData(transferTo.id, mLRTReceipt)
        assetHoldingData = transferTo.assets.load()
        newTVL = BIGINT_ZERO, newmLRTTVL = BIGINT_ZERO
        for (let i = 0; i < assetHoldingData.length; i++) {
            newTVL = newTVL.plus(
                assetHoldingData[i].amount.times(assetHoldingData[i].exchangeRate).div(ETHER_ONE)
            )
            let mLRTContract = MLRT.bind(Address.fromBytes(assetHoldingData[i].assetAddr))
            newmLRTTVL = newmLRTTVL.plus(mLRTContract.balanceOf(Address.fromBytes(transferTo.id)))
        }
        transferTo.tvl = newTVL
        transferTo.mLRTTVL = newmLRTTVL
        transferTo.save()

        // update referrers of users TVL points
        if (transferReferrerFrom) {
            let referralPointEarned = mLRTPointBoostedFrom.times(BigInt.fromI32(10)).div(BigInt.fromI32(100))
            transferReferrerFrom.referralPoints = transferReferrerFrom.referralPoints.plus(referralPointEarned)
            loadOrCreateReferralGroup(transferReferrerFrom.referralGroup) // just create if the group not exist
            transferReferrerFrom.save()

            let referralLog = new ReferralLog(
                Bytes.fromByteArray(
                    crypto.keccak256(
                        event.transaction.hash.concatI32(event.logIndex.toI32()).concat(transferFrom.id)
                    )
                )
            )
            referralLog.referrer = transferReferrerFrom.id
            referralLog.referee = transferFrom.id
            referralLog.referralPointEarned = referralPointEarned
            referralLog.referralPointsAccumulated = transferReferrerFrom.referralPoints
            referralLog.timestamp = event.block.timestamp
            referralLog.save()
        }

        if (transferReferrerTo) {
            let referralPointEarned = mLRTPointBoostedTo.times(BigInt.fromI32(10)).div(BigInt.fromI32(100))
            transferReferrerTo.referralPoints = transferReferrerTo.referralPoints.plus(referralPointEarned)
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
            referralLog.referralPointsAccumulated = transferReferrerTo.referralPoints
            referralLog.timestamp = event.block.timestamp
            referralLog.save()
        }

        // check sender and receiver is in the same group or not
        if (transferFromGroup.id.notEqual(transferToGroup.id)) {
            transferFromGroup.groupTVL = (transferFromGroup.groupTVL.gt(transferTvl)) ? transferFromGroup.groupTVL.minus(transferTvl) : BIGINT_ZERO
            transferFromGroup.boost = calcGroupBoost(transferFromGroup.groupTVL)
            transferFromGroup.save()

            transferToGroup.groupTVL = transferToGroup.groupTVL.plus(transferTvl)
            transferToGroup.boost = calcGroupBoost(transferToGroup.groupTVL)
            transferToGroup.save()
        }

    }
}