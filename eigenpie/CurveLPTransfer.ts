import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts"
import {
  CurveLPTransfer,
  Transfer as TransferEvent,
} from "../generated/CurveLPTransfer1/CurveLPTransfer"
import {
  AssetTransferLP,
  ReferralData,
  ReferralLog,
} from "../generated/schema"
import {
  ADDRESS_ZERO,
  BIGINT_ZERO,
  CURVE_POINT_PER_SEC,
  DENOMINATOR,
  EIGEN_POINT_LAUNCH_TIME,
  ETHER_ONE,
  POINT_PER_SEC,
} from "./constants"
import {
  createOrUpdateCurveAssetHoldingData,
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
  transferEvent.from = event.params.sender
  transferEvent.to = event.params.receiver
  transferEvent.amount = event.params.value
  transferEvent.lp = event.address
  transferEvent.timestamp = event.block.timestamp
  transferEvent.save()

  let senderAddress = Address.fromBytes(transferEvent.from)
  let receiverAddress = Address.fromBytes(transferEvent.to)

  // bind asset's contract
  let curveLPReceipt = CurveLPTransfer.bind(event.address)

  let transferCurveTVL = calculateTransferCurveTVL(
    curveLPReceipt,
    transferEvent.amount
  )

  let transferFrom: ReferralData | null = null
  let transferTo: ReferralData | null = null

  if (senderAddress != ADDRESS_ZERO) {
    transferFrom = getUserTransfer(event, senderAddress, curveLPReceipt)
  }
  if (receiverAddress != ADDRESS_ZERO) {
    transferTo = getUserTransfer(event, receiverAddress, curveLPReceipt)
  }

  if (transferFrom && transferTo) {
    updateReferralGroups(transferFrom, transferTo, transferCurveTVL)
  }
}

function calculateTransferCurveTVL(
  curveLPReceipt: CurveLPTransfer,
  amount: BigInt
): BigInt {
  return amount
    .times(curveLPReceipt.get_balances()[0])
    .times(ETHER_ONE)
    .div(curveLPReceipt.totalSupply())
    .div(ETHER_ONE)
    .plus(
      amount
        .times(curveLPReceipt.get_balances()[1])
        .times(ETHER_ONE)
        .div(curveLPReceipt.totalSupply())
        .div(ETHER_ONE)
    )
}

function getUserTransfer(
  event: TransferEvent,
  userAddress: Address,
  curveLPReceipt: CurveLPTransfer
): ReferralData {
  let userData = loadOrCreateReferralData(userAddress)
  updateEigenPoints(event, userData)
  updateCurvePoints(event, userData)
  updateCurveTVL(userData, curveLPReceipt)
  return userData
}

function updateEigenPoints(event: TransferEvent, userData: ReferralData): void {
  loadAndUpdateEigenPointStatus(event.block.timestamp, event.transaction.index)

  let assetHoldingData = userData.curveAssets.load()
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

function updateCurvePoints(event: TransferEvent, userData: ReferralData): void {
  let timeDiff = userData.lastUpdateTimestamp.lt(event.block.timestamp)
    ? event.block.timestamp.minus(userData.lastUpdateTimestamp)
    : BIGINT_ZERO
  let userDataGroup = loadOrCreateReferralGroup(userData.referralGroup)
  let curvePointEarned = userData.curveTVL
    .times(CURVE_POINT_PER_SEC)
    .times(timeDiff)
    .div(ETHER_ONE)
  let curvePointBoosted = curvePointEarned
    .times(userDataGroup.boost)
    .times(extraBoost(event.block.timestamp))
    .div(DENOMINATOR.pow(2))
  userData.curvePoints = userData.curvePoints.plus(curvePointBoosted)
  userData.lastUpdateTimestamp = event.block.timestamp
  userData.save()

  updateReferralPoints(event, userData, curvePointBoosted)
}

function updateReferralPoints(
  event: TransferEvent,
  userData: ReferralData,
  curvePointBoosted: BigInt
): void {
  if (userData.referrer != ADDRESS_ZERO) {
    let referralPointEarned = curvePointBoosted
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

function updateCurveTVL(
  userData: ReferralData,
  curveLPReceipt: CurveLPTransfer
): void {
  createOrUpdateCurveAssetHoldingData(userData.id, curveLPReceipt)

  let assetHoldingData = userData.curveAssets.load()
  let newCurveTVL = BIGINT_ZERO
  for (let i = 0; i < assetHoldingData.length; i++) {
    newCurveTVL = newCurveTVL
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
  userData.curveTVL = newCurveTVL.div(ETHER_ONE)
  userData.save()
}
