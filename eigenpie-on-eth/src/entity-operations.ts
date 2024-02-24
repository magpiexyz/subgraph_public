import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts"
import { AssetHoldingData, EigenPointStatus, EigenPointUpdateLog, ReferralData, ReferralGroup, ReferralStatus } from "../generated/schema"
import { DENOMINATOR, ADDRESS_ZERO, BIGINT_ZERO, ETHER_ONE, POINT_PER_SEC, EIGEN_POINT_LAUNCH_TIME } from "./constants"
import { MLRT } from "../generated/templates/MLRT/MLRT"

export function loadOrCreateReferralData(userAddress: Bytes, referrerAddr: Bytes = ADDRESS_ZERO): ReferralData {
  let user = ReferralData.load(userAddress)
  if (!user) {
    let referrer: ReferralData | null = null
    let referralGroup: ReferralGroup
    if (referrerAddr.notEqual(ADDRESS_ZERO) && referrerAddr.notEqual(userAddress)) {
      referrer = loadOrCreateReferralData(referrerAddr)
      referralGroup = loadOrCreateReferralGroup(referrer.referralGroup)
      referrer.referralCount++
      referrer.save()
    } else {
      referralGroup = loadOrCreateReferralGroup(userAddress)
    }
    user = new ReferralData(userAddress)
    user.tvl = BIGINT_ZERO
    user.tvl2 = BIGINT_ZERO
    user.tvlPoints = BIGINT_ZERO
    user.tvlPoints2 = BIGINT_ZERO
    user.referralPoints = BIGINT_ZERO
    user.referralPoints2 = BIGINT_ZERO
    user.referrer = (referrer) ? referrer.id : ADDRESS_ZERO
    user.referralGroup = referralGroup.id
    user.referralCount = 0
    user.lastUpdateTimestamp = BIGINT_ZERO
    user.lastEigenPointPerTVL = BIGINT_ZERO
    user.eigenPoint = BIGINT_ZERO
    user.eigenPoint2 = BIGINT_ZERO
    user.save()

    let referralStatus = loadReferralStatus()
    referralStatus.totalUsers++
    referralStatus.save()
  }
  return user
}

export function loadOrCreateReferralGroup(groupID: Bytes): ReferralGroup {
  let group = ReferralGroup.load(groupID)
  if (!group) {
    group = new ReferralGroup(groupID)
    group.groupTVL = BIGINT_ZERO
    group.groupTVL2 = BIGINT_ZERO
    group.boost = DENOMINATOR
    group.boost2 = DENOMINATOR
    group.save()

    let referralStatus = loadReferralStatus()
    referralStatus.totalGroups++
    referralStatus.save()
  }
  return group
}

export function loadReferralStatus(): ReferralStatus {
  let referralStatus = ReferralStatus.load(Bytes.fromI32(0))

  if (!referralStatus) {
    referralStatus = new ReferralStatus(Bytes.fromI32(0))
    referralStatus.totalTvl = BIGINT_ZERO
    referralStatus.totalTvl2 = BIGINT_ZERO
    referralStatus.totalTvlPoints = BIGINT_ZERO
    referralStatus.totalTvlPoints2 = BIGINT_ZERO
    referralStatus.totalUsers = 0
    referralStatus.totalGroups = 0
    referralStatus.save()
  }

  return referralStatus
}

export function loadAndUpdateEigenPointStatus(blockTimestamp: BigInt, eventIdx: BigInt): EigenPointStatus {
  let referralStatus = loadReferralStatus()
  let eigenPointStatus = EigenPointStatus.load(Bytes.fromI32(0))

  if (!eigenPointStatus) {
    eigenPointStatus = new EigenPointStatus(Bytes.fromI32(0))
    eigenPointStatus.accumulatedPoints = BIGINT_ZERO
    eigenPointStatus.pointPerTVL = BIGINT_ZERO
    eigenPointStatus.lastUpdateTimestamp = BIGINT_ZERO
  }

  if (blockTimestamp.ge(EIGEN_POINT_LAUNCH_TIME)) {
    let timeDiff = (eigenPointStatus.lastUpdateTimestamp.gt(BIGINT_ZERO)) ? blockTimestamp.minus(eigenPointStatus.lastUpdateTimestamp) : BIGINT_ZERO
    let incomePoints = timeDiff.times(referralStatus.totalTvl2).times(POINT_PER_SEC).div(ETHER_ONE)
    eigenPointStatus.accumulatedPoints = eigenPointStatus.accumulatedPoints.plus(incomePoints)
    eigenPointStatus.pointPerTVL = (referralStatus.totalTvl2.gt(BIGINT_ZERO)) ? eigenPointStatus.accumulatedPoints.times(ETHER_ONE).div(referralStatus.totalTvl2) : BIGINT_ZERO

    let eigenPointUpdateLog = new EigenPointUpdateLog(
      Bytes.fromByteArray(
        crypto.keccak256(
          Bytes.fromBigInt(eigenPointStatus.lastUpdateTimestamp.plus(blockTimestamp)).concat(Bytes.fromBigInt(eventIdx))
        )
      )
    )
    eigenPointUpdateLog.incomePoints = incomePoints
    eigenPointUpdateLog.accumulatedPoints = eigenPointStatus.accumulatedPoints
    eigenPointUpdateLog.instantTvl = referralStatus.totalTvl2
    eigenPointUpdateLog.instantPointPerTVL = eigenPointStatus.pointPerTVL
    eigenPointUpdateLog.timeDiff = timeDiff
    eigenPointUpdateLog.timestamp = blockTimestamp
    eigenPointUpdateLog.save()

    eigenPointStatus.lastUpdateTimestamp = blockTimestamp
  }

  eigenPointStatus.save()

  return eigenPointStatus
}

export function createOrUpdateAssetHoldingData(userAddress: Bytes, mLRTReceipt: MLRT): AssetHoldingData {
  let assetAddress = mLRTReceipt.underlyingAsset()
  let hashedID = Bytes.fromByteArray(crypto.keccak256(userAddress.concat(assetAddress)))
  let assetHoldingData = AssetHoldingData.load(hashedID)

  if (!assetHoldingData) {
    assetHoldingData = new AssetHoldingData(hashedID)
    assetHoldingData.holder = userAddress
    assetHoldingData.asset = mLRTReceipt._address
    assetHoldingData.assetAddr = mLRTReceipt._address
  }

  assetHoldingData.amount = mLRTReceipt.balanceOf(Address.fromBytes(userAddress))
  let try_exchangeRateToNative = mLRTReceipt.try_exchangeRateToNative()
  assetHoldingData.exchangeRate = (!try_exchangeRateToNative.reverted) ? try_exchangeRateToNative.value : ETHER_ONE
  assetHoldingData.save()

  return assetHoldingData
}