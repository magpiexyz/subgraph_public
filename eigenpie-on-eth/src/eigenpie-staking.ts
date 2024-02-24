import { Address, BigInt, Bytes, store, crypto } from "@graphprotocol/graph-ts"
import { AssetDeposit as AssetDepositEvent, EigenpieStaking } from "../generated/EigenpieStaking/EigenpieStaking"
import { EigenpieConfig } from "../generated/EigenpieConfig/EigenpieConfig"
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { AssetDeposit, ReferralData, ReferralGroup, ReferralLog } from "../generated/schema"
import { POINT_PER_SEC, DENOMINATOR, ADDRESS_ZERO, ETHER_ONE, BIGINT_ZERO, EIGEN_POINT_LAUNCH_TIME } from "./constants"
import { createOrUpdateAssetHoldingData, loadAndUpdateEigenPointStatus, loadOrCreateReferralData, loadOrCreateReferralGroup, loadReferralStatus } from "./entity-operations"
import { calcGroupBoost, extraBoost } from "./boost-module"

export function handleAssetDeposit(event: AssetDepositEvent): void {
  let user: ReferralData
  let userGroup: ReferralGroup
  let referrer: ReferralData | null
  let referrerGroup: ReferralGroup | null

  let eigenpieStaking = EigenpieStaking.bind(event.address)
  let eigenpieConfig = EigenpieConfig.bind(eigenpieStaking.eigenpieConfig())
  let mLRTReceipt = MLRT.bind(eigenpieConfig.mLRTReceiptByAsset(event.params.asset))
  let try_exchangeRateToNative = mLRTReceipt.try_exchangeRateToNative()
  let exchangeRate = (!try_exchangeRateToNative.reverted) ? try_exchangeRateToNative.value : ETHER_ONE
  let eigenPointStatus = loadAndUpdateEigenPointStatus(event.block.timestamp, event.transaction.index)
  

  user = loadOrCreateReferralData(event.params.depositor, event.params.referral)
  userGroup = loadOrCreateReferralGroup(user.referralGroup)
  referrer = (user.referrer.notEqual(ADDRESS_ZERO)) ? loadOrCreateReferralData(user.referrer) : null
  referrerGroup = (referrer && referrer.referralGroup.notEqual(ADDRESS_ZERO)) ? loadOrCreateReferralGroup(referrer.referralGroup) : null
  let groupBoost = userGroup.boost

  user.lastEigenPointPerTVL = eigenPointStatus.pointPerTVL // do we need it anymore?

  if (event.block.timestamp.ge(EIGEN_POINT_LAUNCH_TIME)) {
    let baseTime = (user.lastUpdateTimestamp.lt(EIGEN_POINT_LAUNCH_TIME)) ? EIGEN_POINT_LAUNCH_TIME : user.lastUpdateTimestamp
    let timeDiff = event.block.timestamp.minus(baseTime)
    let eigenPointsEarned = user.tvl.times(POINT_PER_SEC).times(timeDiff).div(ETHER_ONE)
    user.eigenPoint = user.eigenPoint.plus(eigenPointsEarned)
  }

  let timeDiff = event.block.timestamp.minus(user.lastUpdateTimestamp)
  let tvlPointEarned = user.tvl.times(POINT_PER_SEC).times(timeDiff).div(ETHER_ONE)
  let tvlPointBoosted = tvlPointEarned.times(groupBoost).times(extraBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
  user.tvlPoints = user.tvlPoints.plus(tvlPointBoosted)
  let userPrevTvl = user.tvl

  createOrUpdateAssetHoldingData(user.id, mLRTReceipt)

  let assetHoldingData = user.assets.load()
  let newTVL = BIGINT_ZERO
  for (let i = 0; i < assetHoldingData.length; i++) {
    newTVL = newTVL.plus(
      assetHoldingData[i].amount.times(assetHoldingData[i].exchangeRate).div(ETHER_ONE)
    )
  }
  user.tvl = newTVL

  // update referrer's referral points
  let groupBeMerged = false
  if (referrer) {
    let referralPointEarned = tvlPointBoosted.times(BigInt.fromI32(10)).div(BigInt.fromI32(100))
    referrer.referralPoints = referrer.referralPoints.plus(referralPointEarned)
    referrerGroup = loadOrCreateReferralGroup(referrer.referralGroup)
    referrer.save()

    let referralLog = new ReferralLog(
      Bytes.fromByteArray(
        crypto.keccak256(
          event.transaction.hash.concatI32(event.logIndex.toI32()).concat(user.id)
        )
      )
    )
    referralLog.referrer = user.id
    referralLog.referee = referrer.id
    referralLog.referralPointEarned = referralPointEarned
    referralLog.referralPointsAccumulated = referrer.referralPoints
    referralLog.timestamp = event.block.timestamp
    referralLog.save()
  } else if (
    user.referrer.equals(ADDRESS_ZERO) &&
    event.params.referral.notEqual(ADDRESS_ZERO) &&
    event.params.referral.notEqual(user.id)
  ) {
    referrer = loadOrCreateReferralData(event.params.referral)
    referrerGroup = loadOrCreateReferralGroup(referrer.referralGroup)
    user.referrer = referrer.id
    referrer.referralCount++
    referrer.save()
    // if user and referrer are in the different group, merge them
    if (userGroup.id.notEqual(referrerGroup.id)) {
      let groupMembers = userGroup.members.load()
      // let referrerGroupMembers = referrerGroup.members.load()
      referrerGroup.groupTVL = userGroup.groupTVL.plus(referrerGroup.groupTVL)
      // merge the group into the referrer side
      for (let i = 0; i < groupMembers.length; i++) {
        if (groupMembers[i].id.equals(user.id)) {
          user.referralGroup = referrerGroup.id
        } else {
          let member = ReferralData.load(groupMembers[i].id)
          if (member) {
            member.referralGroup = referrerGroup.id
            member.save()
          }
        }
      }
      store.remove("ReferralGroup", userGroup.id.toHexString()) // remove empty group from store
      userGroup = referrerGroup // re-assign referrer's group as user's group
      groupBeMerged = true
    }
  }

  userGroup.groupTVL = userGroup.groupTVL.minus(userPrevTvl).plus(user.tvl)
  userGroup.boost = calcGroupBoost(userGroup.groupTVL)
  userGroup.save()

  user.lastUpdateTimestamp = event.block.timestamp
  user.save()

  let referralStatus = loadReferralStatus()
  referralStatus.totalTvlPoints = (referralStatus.totalTvlPoints).plus(tvlPointBoosted)
  referralStatus.totalTvl = (referralStatus.totalTvl).minus(userPrevTvl).plus(user.tvl)
  if (groupBeMerged) referralStatus.totalGroups--
  referralStatus.save()

  let assetDeposit = new AssetDeposit(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  assetDeposit.depositor = event.params.depositor
  assetDeposit.asset = event.params.asset
  assetDeposit.depositAmount = event.params.depositAmount
  assetDeposit.referral = event.params.referral

  assetDeposit.blockNumber = event.block.number
  assetDeposit.blockTimestamp = event.block.timestamp
  assetDeposit.transactionHash = event.transaction.hash
  assetDeposit.exchangeRateRevert = try_exchangeRateToNative.reverted.toString()
  assetDeposit.exchangeRate = exchangeRate
  assetDeposit.instantBalance = mLRTReceipt.balanceOf(Address.fromBytes(user.id))
  assetDeposit.instantTvl = user.tvl
  assetDeposit.instantTvlPoint = tvlPointBoosted

  assetDeposit.save()
}