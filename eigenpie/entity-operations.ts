import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts"
import { AssetHoldingData, EigenPointStatus, EigenPointUpdateLog, ReferralData, ReferralGroup, ReferralStatus, CurveAssetHoldingData, RangeAssetHoldingData } from "../generated/schema"
import { DENOMINATOR, ADDRESS_ZERO, BIGINT_ZERO, ETHER_ONE, POINT_PER_SEC, EIGEN_POINT_LAUNCH_TIME } from "./constants"
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { CurveLPTransfer } from "../generated/CurveLPTransfer1/CurveLPTransfer";
import { RangeLPTransfer } from "../generated/RangeLPTransfer1/RangeLPTransfer";
import { calcGroupBoost } from "./boost-module"

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
    user.tvlPoints = BIGINT_ZERO
    user.referralPoints = BIGINT_ZERO
    user.referrer = (referrer) ? referrer.id : ADDRESS_ZERO
    user.referralGroup = referralGroup.id
    user.referralCount = 0
    user.lastUpdateTimestamp = BIGINT_ZERO
    user.lastEigenPointPerTVL = BIGINT_ZERO
    user.eigenPoint = BIGINT_ZERO
    user.curveTVL = BIGINT_ZERO
    user.curvePoints = BIGINT_ZERO
    user.rangeTVL = BIGINT_ZERO
    user.rangePoints = BIGINT_ZERO
    user.mLRTTVL = BIGINT_ZERO
    user.mLRTPoints = BIGINT_ZERO


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
    group.boost = DENOMINATOR
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
    referralStatus.totalTvlPoints = BIGINT_ZERO
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
    let incomePoints = timeDiff.times(referralStatus.totalTvl).times(POINT_PER_SEC).div(ETHER_ONE)
    eigenPointStatus.accumulatedPoints = eigenPointStatus.accumulatedPoints.plus(incomePoints)
    eigenPointStatus.pointPerTVL = (referralStatus.totalTvl.gt(BIGINT_ZERO)) ? eigenPointStatus.accumulatedPoints.times(ETHER_ONE).div(referralStatus.totalTvl) : BIGINT_ZERO

    let eigenPointUpdateLog = new EigenPointUpdateLog(
      Bytes.fromByteArray(
        crypto.keccak256(
          Bytes.fromBigInt(eigenPointStatus.lastUpdateTimestamp.plus(blockTimestamp)).concat(Bytes.fromBigInt(eventIdx))
        )
      )
    )
    eigenPointUpdateLog.incomePoints = incomePoints
    eigenPointUpdateLog.accumulatedPoints = eigenPointStatus.accumulatedPoints
    eigenPointUpdateLog.instantTvl = referralStatus.totalTvl
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

export function createOrUpdateCurveAssetHoldingData(userAddress: Bytes, curveLPReceipt: CurveLPTransfer): CurveAssetHoldingData {
  let assetAddress = curveLPReceipt.coins(BigInt.fromI32(1));
  let hashedID = Bytes.fromByteArray(crypto.keccak256(userAddress.concat(assetAddress)))
  let curveAssetHoldingData = CurveAssetHoldingData.load(hashedID)

  if (!curveAssetHoldingData) {
    curveAssetHoldingData = new CurveAssetHoldingData(hashedID)
    curveAssetHoldingData.holder = userAddress
    curveAssetHoldingData.assetAddr = curveLPReceipt._address 
  }

  curveAssetHoldingData.amount = curveLPReceipt.balanceOf(Address.fromBytes(userAddress));
  curveAssetHoldingData.firstTokenExchangeRate = curveLPReceipt.get_balances()[0].times(ETHER_ONE).div(curveLPReceipt.totalSupply());
  curveAssetHoldingData.secondTokenExchangeRate = curveLPReceipt.get_balances()[1].times(ETHER_ONE).div(curveLPReceipt.totalSupply());

  curveAssetHoldingData.save();

  return curveAssetHoldingData;
}

export function createOrUpdateRangeAssetHoldingData(userAddress: Bytes, rangeLPReceipt: RangeLPTransfer): RangeAssetHoldingData {
  let assetAddress = rangeLPReceipt.token1();
  let hashedID = Bytes.fromByteArray(crypto.keccak256(userAddress.concat(assetAddress)))
  let rangeAssetHoldingData = RangeAssetHoldingData.load(hashedID)

  if (!rangeAssetHoldingData) {
    rangeAssetHoldingData = new RangeAssetHoldingData(hashedID)
    rangeAssetHoldingData.holder = userAddress
    rangeAssetHoldingData.assetAddr = rangeLPReceipt._address 
  }
  
  rangeAssetHoldingData.amount = rangeLPReceipt.balanceOf(Address.fromBytes(userAddress));
  rangeAssetHoldingData.firstTokenExchangeRate = rangeLPReceipt.getUnderlyingBalances().getAmount0Current().times(ETHER_ONE).div(rangeLPReceipt.totalSupply());
  rangeAssetHoldingData.secondTokenExchangeRate = rangeLPReceipt.getUnderlyingBalances().getAmount1Current().times(ETHER_ONE).div(rangeLPReceipt.totalSupply());

  rangeAssetHoldingData.save();

  return rangeAssetHoldingData;
}

export function updateReferralGroups( transferFrom: ReferralData, transferTo: ReferralData, transferTVL: BigInt ): void {
  let transferFromGroup = loadOrCreateReferralGroup(transferFrom.referralGroup)
  let transferToGroup = loadOrCreateReferralGroup(transferTo.referralGroup)

  transferFromGroup.groupTVL = transferFromGroup.groupTVL.gt(transferTVL)
    ? transferFromGroup.groupTVL.minus(transferTVL)
    : BIGINT_ZERO
  transferFromGroup.boost = calcGroupBoost(transferFromGroup.groupTVL)
  transferFromGroup.save()

  transferToGroup.groupTVL = transferToGroup.groupTVL.plus(transferTVL)
  transferToGroup.boost = calcGroupBoost(transferToGroup.groupTVL)
  transferToGroup.save()
}
