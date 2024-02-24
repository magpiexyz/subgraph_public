import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts"
import {
  RangeLPTransfer,
  Transfer as TransferEvent,
} from "../generated/RangeLPTransfer1/RangeLPTransfer"
import {
  AssetTransferLP,
  ReferralData,
  ReferralLog,
} from "../generated/schema"
import {
  ADDRESS_ZERO,
  BIGINT_ZERO,
  DENOMINATOR,
  EIGEN_POINT_LAUNCH_TIME,
  ETHER_ONE,
  RANGE_POINT_PER_SEC,
  POINT_PER_SEC,
} from "./constants"
import {
  createOrUpdateRangeAssetHoldingData,
  loadOrCreateReferralData,
  loadOrCreateReferralGroup,
  loadAndUpdateEigenPointStatus,
  updateReferralGroups,
} from "./entity-operations"
import { calcGroupBoost, extraBoost } from "./boost-module"

export function handleTransfer(event: TransferEvent): void {
  let transferEvent = new AssetTransferLP(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  transferEvent.from = event.params.from
  transferEvent.to = event.params.to
  transferEvent.amount = event.params.value
  transferEvent.lp = event.address
  transferEvent.timestamp = event.block.timestamp
  transferEvent.save()

  let senderAddress = Address.fromBytes(transferEvent.from)
  let receiverAddress = Address.fromBytes(transferEvent.to)

  // Bind asset's contract
  let rangeLPReceipt = RangeLPTransfer.bind(event.address)

  let transferRangeTVL = calculateTransferRangeTVL(
    rangeLPReceipt,
    transferEvent.amount
  )

  let transferFrom: ReferralData | null = null
  let transferTo: ReferralData | null = null

  if (senderAddress != ADDRESS_ZERO) {
    transferFrom = getUserTransfer(event, senderAddress, rangeLPReceipt)
  }

  if (receiverAddress != ADDRESS_ZERO) {
    transferTo = getUserTransfer(event, receiverAddress, rangeLPReceipt)
  }

  if (transferFrom && transferTo) {
    updateReferralGroups(transferFrom, transferTo, transferRangeTVL)
  }
}

function calculateTransferRangeTVL(
  rangeLPReceipt: RangeLPTransfer,
  amount: BigInt
): BigInt {
  return rangeLPReceipt
    .getUnderlyingBalancesByShare(amount)
    .getAmount0()
    .plus(rangeLPReceipt.getUnderlyingBalancesByShare(amount).getAmount1())
}

function getUserTransfer(
  event: TransferEvent,
  userAddress: Address,
  rangeLPReceipt: RangeLPTransfer
): ReferralData {
  let userData = loadOrCreateReferralData(userAddress)
  updateEigenPoints(event, userData)
  updateRangeTVL(userData, rangeLPReceipt)
  updateRangePoints(event, userData)
  return userData
}

function updateEigenPoints(event: TransferEvent, userData: ReferralData): void {
  loadAndUpdateEigenPointStatus(event.block.timestamp, event.transaction.index)

  let assetHoldingData = userData.rangeAssets.load()
  if (event.block.timestamp.ge(EIGEN_POINT_LAUNCH_TIME)) {
    for (let i = 0; i < assetHoldingData.length; i++) {
      if (Address.fromBytes(assetHoldingData[i].assetAddr) == event.address) {
        let baseTime = userData.lastUpdateTimestamp.lt(EIGEN_POINT_LAUNCH_TIME)
          ? EIGEN_POINT_LAUNCH_TIME
          : userData.lastUpdateTimestamp
        let timeDiff = event.block.timestamp.minus(baseTime)
        let eigenPointsEarned = assetHoldingData[i].amount
          .times(assetHoldingData[i].firstTokenExchangeRate)
          .times(POINT_PER_SEC)
          .times(timeDiff)
          .div(ETHER_ONE)
        userData.eigenPoint = userData.eigenPoint.plus(eigenPointsEarned)
        userData.save()
        break
      }
    }
  }
}
function updateRangePoints(event: TransferEvent, userData: ReferralData): void {
  let timeDiff = userData.lastUpdateTimestamp.lt(event.block.timestamp)
    ? event.block.timestamp.minus(userData.lastUpdateTimestamp)
    : BIGINT_ZERO
  let userDataGroup = loadOrCreateReferralGroup(userData.referralGroup)
  let rangePointEarned = userData.rangeTVL
    .times(RANGE_POINT_PER_SEC)
    .times(timeDiff)
    .div(ETHER_ONE)
  let rangePointBoosted = rangePointEarned
    .times(userDataGroup.boost)
    .times(extraBoost(event.block.timestamp))
    .div(DENOMINATOR.pow(2))
  userData.rangePoints = userData.rangePoints.plus(rangePointBoosted)
  userData.lastUpdateTimestamp = event.block.timestamp
  userData.save()

  updateReferralPoints(event, userData, rangePointBoosted)
}

function updateReferralPoints(
  event: TransferEvent,
  userData: ReferralData,
  rangePointBoosted: BigInt
): void {
  if (userData.referrer != ADDRESS_ZERO) {
    let referralPointEarned = rangePointBoosted
      .times(BigInt.fromI32(10))
      .div(BigInt.fromI32(100))
    let referrerData = loadOrCreateReferralData(userData.referrer)
    referrerData.referralPoints =
      referrerData.referralPoints.plus(referralPointEarned)
    referrerData.save()

    let referralLog = new ReferralLog(
      Bytes.fromByteArray(
        crypto.keccak256(
          event.transaction.hash
            .concatI32(event.logIndex.toI32())
            .concat(userData.id)
        )
      )
    )
    referralLog.referrer = referrerData.id
    referralLog.referee = userData.id
    referralLog.referralPointEarned = referralPointEarned
    referralLog.referralPointsAccumulated = referrerData.referralPoints
    referralLog.timestamp = event.block.timestamp

    referralLog.save()
  }
}

function updateRangeTVL(
  userData: ReferralData,
  rangeLPReceipt: RangeLPTransfer
): void {
  createOrUpdateRangeAssetHoldingData(userData.id, rangeLPReceipt)

  let assetHoldingData = userData.rangeAssets.load()
  let newRangeTVL = BIGINT_ZERO
  for (let i = 0; i < assetHoldingData.length; i++) {
    newRangeTVL = newRangeTVL
      .plus(
        assetHoldingData[i].amount.times(
          assetHoldingData[i].firstTokenExchangeRate
        )
      )
      .plus(
        assetHoldingData[i].amount.times(
          assetHoldingData[i].secondTokenExchangeRate
        )
      )
  }
  userData.rangeTVL = newRangeTVL.div(ETHER_ONE)
  userData.save()
}
