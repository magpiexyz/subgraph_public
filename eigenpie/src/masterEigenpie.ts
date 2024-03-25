import { Address, BigInt, Bytes, log, store } from "@graphprotocol/graph-ts";
import { Transfer as CurveLpTransferEvent, TokenExchange as CurveLpTokenExchangeEvent, AddLiquidity as CurveLpAddLiquidityEvent, RemoveLiquidity as CurveLpRemoveLiquidityEvent, RemoveLiquidityOne as CurveLpRemoveLiquidityOneEvent, RemoveLiquidityImbalance as CurveLpRemoveLiquidityImbalanceEvent, CurveLP } from "../generated/CurveLP-mst-wstETH/CurveLP"
import { Transfer as MlrtTransferEvent } from "../generated/templates/MLRT/MLRT"
import { AssetDeposit as EigenpieStakingAssetDepositEventV1, AssetDeposit1 as EigenpieStakingAssetDepositEventV2 } from "../generated/EigenpieStaking/EigenpieStaking"
import { AddedNewSupportedAsset as AddedNewSupportedAssetEvent, ReceiptTokenUpdated as ReceiptTokenUpdatedEvent } from "../generated/EigenpieConfig/EigenpieConfig"

import { Deposit as ZircuitDepositEvent, Withdraw as ZircuitWithdrawEvent } from "../generated/ZtakingPool/ZtakingPool"
import { ExchangeRateUpdate as PriceProviderExchangeRateUpdateEvent } from "../generated/PriceProvider/PriceProvider"
import { GlobalInfo, GroupInfo, LpInfo, PoolInfo, UserBalanceInfo, UserInfo } from "../generated/schema";
import { ADDRESS_ZERO, BIGINT_ONE, BIGINT_TWO, BIGINT_ZERO, DENOMINATOR, EIGENPIE_PREDEPLOST_HELPER, EIGEN_LAYER_LAUNCH_TIME, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE, ETHER_TEN, ETHER_THREE, ETHER_TWO, LPTOKEN_LIST, LST_PRICE_MAP, LST_TO_MLRT_MAP, MSTETH, MSTETH_WSTETH_CURVE_LP, MSTETH_WSTETH_PCS_LP, MSTETH_WSTETH_RANGE_LP, MSTETH_ZIRCUIT_STAKING_LP, MSWETH, MSWETH_SWETH_CURVE_LP, MSWETH_SWETH_PCS_LP, MSWETH_SWETH_RANGE_LP, MSWETH_ZIRCUIT_STAKING_LP, MWBETH, MWBETH_ZIRCUIT_STAKING_LP, ZIRCUIT_STAKING } from "./constants";
import { MLRT } from "../generated/templates";

// ################################# Eigenpie Config ######################################## //
export function handleAddedNewSupportedAsset(event: AddedNewSupportedAssetEvent): void {
    MLRT.create(event.params.receipt);
}
  
export function handleReceiptTokenUpdated(event: ReceiptTokenUpdatedEvent): void {
    MLRT.create(event.params.receipt);
}

// ################################# Zircuit ######################################## //
export function handleZircuitDeposit(event: ZircuitDepositEvent): void {
    const mlrtAddress = toLowerCase(event.params.token);
    if (isZircuitSupportedMlrt(mlrtAddress)) {
        const zircuitDepositContractAddress = toLowerCase(event.address);
        const depositorAddress = toLowerCase(event.params.depositor);
        const lpToken = zircuitDepositContractAddress.concat(mlrtAddress);
        const depositorGroupAddress = loadOrCreateUserInfo(depositorAddress).group;
        const shares = event.params.amount;
        deposit(depositorGroupAddress, lpToken, depositorAddress, shares, event.block.timestamp, false);
    }
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

export function handleZircuitWithdraw(event: ZircuitWithdrawEvent): void {
    const mlrtAddress = toLowerCase(event.params.token);
    if (isZircuitSupportedMlrt(mlrtAddress)) {
        const zircuitDepositContractAddress = toLowerCase(event.address);
        const withdrawerAddress = toLowerCase(event.params.withdrawer);
        const lpToken = zircuitDepositContractAddress.concat(mlrtAddress);
        const withdrawerGroupAddress = loadOrCreateUserInfo(withdrawerAddress).group;
        const shares = event.params.amount;
        withdraw(withdrawerGroupAddress, lpToken, withdrawerAddress, shares, event.block.timestamp, false);
    }
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

// ################################# Curve LP ######################################## //
export function handleCurveLpTransfer(event: CurveLpTransferEvent): void {
    const lpToken = toLowerCase(event.address);
    const transferShares = event.params.value;
    const senderAddress = toLowerCase(event.params.sender);
    const receiverAddress = toLowerCase(event.params.receiver);

    // process for sender
    if (senderAddress.notEqual(ADDRESS_ZERO)) {
        const senderInfo = loadOrCreateUserInfo(senderAddress);
        withdraw(senderInfo.group, lpToken, senderAddress, transferShares, event.block.timestamp, false);
    }
    
    // process for receiver
    if (receiverAddress.notEqual(ADDRESS_ZERO)) {
        const receiverInfo = loadOrCreateUserInfo(receiverAddress);
        deposit(receiverInfo.group, lpToken, receiverAddress, transferShares, event.block.timestamp, false);
    }
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveTrading(event: CurveLpTokenExchangeEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateCurveLpPriceToEthAndMlrtRatio(lpToken);
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveAddLiquidity(event: CurveLpAddLiquidityEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateCurveLpPriceToEthAndMlrtRatio(lpToken);
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidity(event: CurveLpRemoveLiquidityEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateCurveLpPriceToEthAndMlrtRatio(lpToken);
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidityOne(event: CurveLpRemoveLiquidityOneEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateCurveLpPriceToEthAndMlrtRatio(lpToken);
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidityImbalance(event: CurveLpRemoveLiquidityImbalanceEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateCurveLpPriceToEthAndMlrtRatio(lpToken);
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

// ################################# mLRT ######################################## //
export function handleMlrtTransfer(event: MlrtTransferEvent): void {
    const lpToken = toLowerCase(event.address);
    const transferShares = event.params.value;
    const senderAddress = toLowerCase(event.params.from);
    const receiverAddresss = toLowerCase(event.params.to);

    // process for sender
    if (senderAddress.notEqual(ADDRESS_ZERO) && 
    !isStringEqualIgnoreCase(senderAddress.toHexString(), EIGENPIE_PREDEPLOST_HELPER) && 
    !isDeFiIntegrationContract(senderAddress)) {
        const senderInfo = loadOrCreateUserInfo(senderAddress);
        withdraw(senderInfo.group, lpToken, senderAddress, transferShares, event.block.timestamp, false);
    }

    // process for receiver
    if (receiverAddresss.notEqual(ADDRESS_ZERO) && 
    !isStringEqualIgnoreCase(receiverAddresss.toHexString(), EIGENPIE_PREDEPLOST_HELPER) && 
    !isDeFiIntegrationContract(receiverAddresss)) {
        const receiverInfo = loadOrCreateUserInfo(receiverAddresss);
        deposit(receiverInfo.group, lpToken, receiverAddresss, transferShares, event.block.timestamp, false);
    }
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

// ################################# EigenpieStaking ######################################## //
export function handleEigenpieStakingAssetDepositV1(event: EigenpieStakingAssetDepositEventV1): void {
    const referrerAddress = toLowerCase(event.params.referral);
    const depositorAddress = toLowerCase(event.params.depositor);
    const referrerGroupAddress = loadOrCreateUserInfo(referrerAddress).group;
    const depositorGroupAddress = loadOrCreateUserInfo(depositorAddress).group;  
    if (isNewReferral(depositorAddress, referrerAddress)) {
        if (!isStringEqualIgnoreCase(depositorGroupAddress.toHexString(), referrerGroupAddress.toHexString())) {
            mergeGroups(depositorGroupAddress, referrerGroupAddress, event.block.timestamp);
        }
        const referrer = loadOrCreateUserInfo(referrerAddress);
        const depositor = loadOrCreateUserInfo(depositorAddress);
        depositor.referrer = referrerAddress;
        referrer.referralCount = referrer.referralCount.plus(ETHER_ONE);
        depositor.save();
        referrer.save();
    }
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

export function handleEigenpieStakingAssetDepositV2(event: EigenpieStakingAssetDepositEventV2): void {
    const referrerAddress = toLowerCase(event.params.referral);
    const depositorAddress = toLowerCase(event.params.depositor);
    const referrerGroupAddress = loadOrCreateUserInfo(referrerAddress).group;
    const depositorGroupAddress = loadOrCreateUserInfo(depositorAddress).group;
    const isPreDepsoit = event.params.isPreDepsoit;
    const lpToken = Bytes.fromHexString(LST_TO_MLRT_MAP.get(event.params.asset.toHexString().toLowerCase()));
    const shares = event.params.mintedAmount;
    if (isPreDepsoit) {
        deposit(depositorGroupAddress, lpToken, depositorAddress, shares, event.block.timestamp, true);
    } else {
        deposit(depositorGroupAddress, lpToken, depositorAddress, shares, event.block.timestamp, false);
    }
    if (isNewReferral(depositorAddress, referrerAddress)) {
        if (!isStringEqualIgnoreCase(depositorGroupAddress.toHexString(), referrerGroupAddress.toHexString())) {
            mergeGroups(depositorGroupAddress, referrerGroupAddress, event.block.timestamp);
        }
        const referrer = loadOrCreateUserInfo(referrerAddress);
        const depositor = loadOrCreateUserInfo(depositorAddress);
        depositor.referrer = referrerAddress;
        referrer.referralCount = referrer.referralCount.plus(ETHER_ONE);
        depositor.save();
        referrer.save();
    }
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

// ################################# PriceProvider ######################################## //
export function handlePriceProviderExchangeRateUpdateEvent(event: PriceProviderExchangeRateUpdateEvent): void {
    let lpToken = toLowerCase(event.params.receipt);
    updatePools(lpToken, event.block.timestamp);
    let lstToken = toLowerCase(event.params.asset);
    let lpTokenPriceToLstToken = event.params.newExchangeRate;
    let lpTokenPriceToEth = mul(lpTokenPriceToLstToken, LST_PRICE_MAP.get(lstToken.toHexString().toLowerCase()));
    let lpInfo = loadOrCreateLpInfo(lpToken);
    lpInfo.priceToETH = lpTokenPriceToEth;
    lpInfo.save();
    if (isZircuitSupportedMlrt(lpToken)) {
        let zircuitLpToken = Bytes.fromHexString(ZIRCUIT_STAKING.concat(lpToken.toHexString()));
        let zircuitLpInfo = loadOrCreateLpInfo(zircuitLpToken);
        zircuitLpInfo.priceToETH = lpTokenPriceToEth;
        zircuitLpInfo.save();
    }
    dailyUpdateAllPools(event.block.timestamp);
    updateGlobalBoost(event.block.timestamp);
}

// ################################# Helper Functions ######################################## //

function updateCurveLpPriceToEthAndMlrtRatio(lpToken: Bytes): void {
    const CurveLpContract = CurveLP.bind(Address.fromBytes(lpToken));
    const mLrtToken = toLowerCase(CurveLpContract.coins(BIGINT_ZERO));
    const lstToken = toLowerCase(CurveLpContract.coins(BIGINT_ONE));
    const totalShares = CurveLpContract.totalSupply();
    let balances = CurveLpContract.get_balances();
    let mLRTTvl = mul(balances[0], loadOrCreateLpInfo(mLrtToken).priceToETH)
    let lstTvl = mul(balances[1], LST_PRICE_MAP.get(lstToken.toHexString()));
    const lpInfo = loadOrCreateLpInfo(lpToken);
    lpInfo.mLrtRatio = div(mLRTTvl, mLRTTvl.plus(lstTvl));
    lpInfo.priceToETH = div(mLRTTvl.plus(lstTvl), totalShares);
    lpInfo.save();
}

function mergeGroups(depositorGroupAddress: Bytes, referrerGroupAddress: Bytes, blockTimestamp: BigInt): void {
    const depositorGroup = loadOrCreateGroupInfo(depositorGroupAddress);
    const members = depositorGroup.members.load();
    for (let i = 0; i < members.length; i++) {
        let member = members[i];
        let userBalances = member.userBalances.load();
        for (let j = 0; j < userBalances.length; j++) {
            let userBalance = userBalances[j];
            withdraw(depositorGroupAddress, userBalance.lpToken, userBalance.user, userBalance.shares, blockTimestamp, false);
            deposit(referrerGroupAddress, userBalance.lpToken, userBalance.user, userBalance.shares, blockTimestamp, false);
            withdraw(depositorGroupAddress, userBalance.lpToken, userBalance.user, userBalance.unclaimedShares, blockTimestamp, true);
            deposit(referrerGroupAddress, userBalance.lpToken, userBalance.user, userBalance.unclaimedShares, blockTimestamp, true);
            store.remove("UserBalanceInfo", userBalance.id.toHexString());
        }
        member = loadOrCreateUserInfo(member.user);
        member.group = referrerGroupAddress;
        member.save();
    }
    store.remove("GroupInfo", depositorGroup.id.toHexString());
}

function isNewReferral(user: Bytes, referrer: Bytes): boolean {
    const userInfo = loadOrCreateUserInfo(user);
    return userInfo.referrer.equals(ADDRESS_ZERO) && referrer.notEqual(ADDRESS_ZERO) && referrer.notEqual(userInfo.id);
}

function updatePool(group: Bytes, lpToken: Bytes, blockTimestamp: BigInt): void {
    let pool = loadOrCreatePoolInfo(group, lpToken);
    if (blockTimestamp.le(pool.lastRewardTimestamp) || pool.totalShares.plus(pool.totalUnclaimedShares).equals(BIGINT_ZERO)) {
        pool.lastRewardTimestamp = blockTimestamp;
        pool.save();
        return;
    }
    let lpInfo = loadOrCreateLpInfo(pool.lpToken);
    // update eigenlayer points for pool
    if (blockTimestamp.gt(EIGEN_LAYER_LAUNCH_TIME) && !pool.totalShares.equals(BIGINT_ZERO)) {
        let timeSinceLastRewardUpdate = blockTimestamp.minus(pool.lastRewardTimestamp.le(EIGEN_LAYER_LAUNCH_TIME) ? EIGEN_LAYER_LAUNCH_TIME : pool.lastRewardTimestamp);
        // eigenLayerPointsReward = timeSinceLastRewardUpdate * lpInfo.eigenLayerPointsPerSec * lpInfo.priceToETH * lpInfo.totalShares * lpInfo.mLrtRatio
        let eigenLayerPointsReward = mul(mul(mul(timeSinceLastRewardUpdate.times(lpInfo.eigenLayerPointsPerSec), lpInfo.priceToETH), pool.totalShares), lpInfo.mLrtRatio); 
        pool.accEigenLayerPointPerShare = pool.accEigenLayerPointPerShare.plus(div(eigenLayerPointsReward, pool.totalShares));
    }

    // update eigenpie points for pool
    let groupInfo = loadOrCreateGroupInfo(group);
    let globalInfo = loadOrCreateGlobalInfo();
    let timeSinceLastRewardUpdate = blockTimestamp.minus(pool.lastRewardTimestamp);
    // eigenpiePointsReward = timeSinceLastRewardUpdate * lpInfo.eigenpiePointsPerSec * lpInfo.priceToETH * (lpInfo.totalShares + lpInfo.totalUnclaimedShares) * groupInfo.groupBoost * globalInfo.globalBoost
    let eigenpiePointsReward = mul(mul(mul(mul(timeSinceLastRewardUpdate.times(lpInfo.eigenpiePointsPerSec), lpInfo.priceToETH), pool.totalShares.plus(pool.totalUnclaimedShares)), groupInfo.groupBoost), globalInfo.globalBoost)
    pool.accEigenpiePointPerShare = pool.accEigenpiePointPerShare.plus(div(eigenpiePointsReward, pool.totalShares.plus(pool.totalUnclaimedShares)));
    pool.lastRewardTimestamp = blockTimestamp;
    pool.save();
}    

function deposit(groupAddress: Bytes, lpToken: Bytes, user: Bytes, shares: BigInt, blockTimestamp: BigInt, isPreDepsoit: bool): void {
    updatePool(groupAddress, lpToken, blockTimestamp);

    let pool = loadOrCreatePoolInfo(groupAddress, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(groupAddress, lpToken, user);

    // harvest points for user
    if (userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares).gt(BIGINT_ZERO)) {
        harvestPoints(groupAddress, lpToken, user);
    }

    userBalanceInfo = loadOrCreateUserBalanceInfo(groupAddress, lpToken, user);
    pool = loadOrCreatePoolInfo(groupAddress, lpToken);

    // update user balance and pool balance
    if (isPreDepsoit) {
        userBalanceInfo.unclaimedShares = userBalanceInfo.unclaimedShares.plus(shares);
        pool.totalUnclaimedShares = pool.totalUnclaimedShares.plus(shares);
    } else {
        userBalanceInfo.shares = userBalanceInfo.shares.plus(shares);
        pool.totalShares = pool.totalShares.plus(shares);
    }

    // update user point debt
    userBalanceInfo.eigenLayerPointsDebt = mul(userBalanceInfo.shares, pool.accEigenLayerPointPerShare);
    userBalanceInfo.eigenpiePointsDebt = mul(userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares), pool.accEigenpiePointPerShare);

    // update group boost
    let group = loadOrCreateGroupInfo(groupAddress);
    let depositTvl = mul(shares, loadOrCreateLpInfo(lpToken).priceToETH);
    group.totalTvl = group.totalTvl.plus(depositTvl);
    group.groupBoost = calEigenpiePointGroupBoost(group.totalTvl);
    let globalInfo = loadOrCreateGlobalInfo();
    globalInfo.totalTvl = globalInfo.totalTvl.plus(depositTvl);
    globalInfo.save();
    userBalanceInfo.save()
    pool.save();
    group.save()
}

function withdraw(groupAddress: Bytes, lpToken: Bytes, user: Bytes, shares: BigInt, blockTimestamp: BigInt, isPreDepsoit: bool): void {
    updatePool(groupAddress, lpToken, blockTimestamp);

    let pool = loadOrCreatePoolInfo(groupAddress, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(groupAddress, lpToken, user);

    harvestPoints(groupAddress, lpToken, user);

    pool = loadOrCreatePoolInfo(groupAddress, lpToken);
    userBalanceInfo = loadOrCreateUserBalanceInfo(groupAddress, lpToken, user);

    // update user balance and pool balance
    if (isPreDepsoit) {
        userBalanceInfo.unclaimedShares = userBalanceInfo.unclaimedShares.minus(shares);
        pool.totalUnclaimedShares = pool.totalUnclaimedShares.minus(shares);
    } else {
        userBalanceInfo.shares = userBalanceInfo.shares.minus(shares);
        pool.totalShares = pool.totalShares.minus(shares);
    }

    userBalanceInfo.eigenLayerPointsDebt = mul(userBalanceInfo.shares, pool.accEigenLayerPointPerShare);
    userBalanceInfo.eigenpiePointsDebt = mul(userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares), pool.accEigenpiePointPerShare);

    // update group boost
    let group = loadOrCreateGroupInfo(groupAddress);
    let withdrawTvl = mul(shares, loadOrCreateLpInfo(lpToken).priceToETH);
    group.totalTvl = group.totalTvl.minus(withdrawTvl);
    group.groupBoost = calEigenpiePointGroupBoost(group.totalTvl);
    let globalInfo = loadOrCreateGlobalInfo();
    globalInfo.totalTvl = globalInfo.totalTvl.minus(withdrawTvl);
    globalInfo.save();
    userBalanceInfo.save()
    pool.save();
    group.save()
}

function harvestPoints(group: Bytes, lpToken: Bytes, user: Bytes): void {
    let userInfo = loadOrCreateUserInfo(user);
    let referrerInfo = loadOrCreateUserInfo(userInfo.referrer);
    // Harvest EigenLayer Points
    let pendingEigenLayerPoints = calNewEigenLayerPoints(group, lpToken, user);
    userInfo.eigenLayerPoints = userInfo.eigenLayerPoints.plus(pendingEigenLayerPoints);
    
    // Harvest Eigenpie Points
    let pendingEigenpiePoints = calNewEigenpiePoints(group, lpToken, user);

    userInfo.eigenpiePoints = userInfo.eigenpiePoints.plus(pendingEigenpiePoints);
    referrerInfo.eigenpieReferralPoints = referrerInfo.eigenpieReferralPoints.plus(pendingEigenpiePoints.times(ETHER_ONE).div(ETHER_TEN));

    // Update total EigenLayer & Eigenpie Points
    let globalInfo = loadOrCreateGlobalInfo();
    globalInfo.totalEigenLayerPoints = globalInfo.totalEigenLayerPoints.plus(pendingEigenLayerPoints);
    globalInfo.totalEigenpiePoints = globalInfo.totalEigenpiePoints.plus(pendingEigenpiePoints);
    globalInfo.totalEigenpiePoints = globalInfo.totalEigenpiePoints.plus(pendingEigenpiePoints.times(ETHER_ONE).div(ETHER_TEN));

    userInfo.save();
    referrerInfo.save();
    globalInfo.save();
}

function calNewEigenLayerPoints(group: Bytes, lpToken: Bytes, user: Bytes): BigInt {
    let pool = loadOrCreatePoolInfo(group, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(group, lpToken, user);
    let pendingEigenLayerPoints = mul(userBalanceInfo.shares, pool.accEigenLayerPointPerShare).minus(userBalanceInfo.eigenLayerPointsDebt);
    return pendingEigenLayerPoints;
}

function calNewEigenpiePoints(group: Bytes, lpToken: Bytes, user: Bytes): BigInt {
    let pool = loadOrCreatePoolInfo(group, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(group, lpToken, user);
    let pendingEigenpiePoints = mul(userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares), pool.accEigenpiePointPerShare).minus(userBalanceInfo.eigenpiePointsDebt);

    return pendingEigenpiePoints;
}

function loadOrCreatePoolInfo(group: Bytes, lpToken: Bytes): PoolInfo {
    group = toLowerCase(group);
    lpToken = toLowerCase(lpToken);
    let poolInfo = PoolInfo.load(group.concat(lpToken));

    if (!poolInfo) {
        poolInfo = new PoolInfo(group.concat(lpToken));
        poolInfo.group = group;
        poolInfo.lpToken = lpToken;
        poolInfo.totalShares = BIGINT_ZERO;
        poolInfo.totalUnclaimedShares = BIGINT_ZERO;
        poolInfo.accEigenLayerPointPerShare = BIGINT_ZERO;
        poolInfo.accEigenpiePointPerShare = BIGINT_ZERO;
        poolInfo.lastRewardTimestamp = BIGINT_ZERO;
        poolInfo.save();
    }

    return poolInfo;
}

function loadOrCreateLpInfo(lpToken: Bytes): LpInfo {
    lpToken = toLowerCase(lpToken);
    let lpInfo = LpInfo.load(lpToken);

    if (!lpInfo) {
        lpInfo = new LpInfo(lpToken);
        lpInfo.lpToken = lpToken;
        lpInfo.priceToETH = ETHER_ONE;
        lpInfo.mLrtRatio = ETHER_ONE;
        lpInfo.eigenLayerPointsPerSec = EIGEN_LAYER_POINT_PER_SEC;
        lpInfo.eigenpiePointsPerSec = getEigenpiePointsPerSec(lpToken);
        lpInfo.save();
    }

    return lpInfo;
}

function loadOrCreateUserBalanceInfo(group: Bytes, lpToken: Bytes, user: Bytes): UserBalanceInfo {
    group = toLowerCase(group);
    lpToken = toLowerCase(lpToken);
    user = toLowerCase(user);
    let userBalanceInfo = UserBalanceInfo.load(group.concat(lpToken).concat(user));

    if (!userBalanceInfo) {
        userBalanceInfo = new UserBalanceInfo(group.concat(lpToken).concat(user));
        userBalanceInfo.group = group;
        userBalanceInfo.lpToken = lpToken;
        userBalanceInfo.poolInfo = group.concat(lpToken);
        userBalanceInfo.user = user;
        userBalanceInfo.shares = BIGINT_ZERO;
        userBalanceInfo.unclaimedShares = BIGINT_ZERO;
        userBalanceInfo.eigenLayerPointsDebt = BIGINT_ZERO;
        userBalanceInfo.eigenpiePointsDebt = BIGINT_ZERO;
        userBalanceInfo.save();
    }

    return userBalanceInfo;
}

function loadOrCreateUserInfo(user: Bytes): UserInfo {
    user = toLowerCase(user);
    let userInfo = UserInfo.load(user);

    if (!userInfo) {
        userInfo = new UserInfo(user);
        userInfo.user = user;
        userInfo.referrer = ADDRESS_ZERO;
        userInfo.referralCount = BIGINT_ZERO;
        userInfo.group = user;
        userInfo.eigenLayerPoints = BIGINT_ZERO;
        userInfo.eigenpiePoints = BIGINT_ZERO;
        userInfo.eigenpieReferralPoints = BIGINT_ZERO;
        userInfo.save();
    }

    return userInfo;
}

function loadOrCreateGroupInfo(group: Bytes): GroupInfo {
    group = toLowerCase(group);
    let groupInfo = GroupInfo.load(group);

    if (!groupInfo) {
        groupInfo = new GroupInfo(group);
        groupInfo.group = group;
        groupInfo.totalTvl = BIGINT_ZERO;
        groupInfo.groupBoost = BIGINT_ONE.times(ETHER_ONE);
        groupInfo.save();
    }

    return groupInfo;
}

function loadOrCreateGlobalInfo(): GlobalInfo {
    let globalInfo = GlobalInfo.load(ADDRESS_ZERO);

    if (!globalInfo) {
        globalInfo = new GlobalInfo(ADDRESS_ZERO);
        globalInfo.globalBoost = BIGINT_ONE.times(ETHER_ONE);
        globalInfo.lastDailyUpdateAllPoolsTimestamp = BIGINT_ZERO;
        globalInfo.totalTvl = BIGINT_ZERO;
        globalInfo.totalEigenpiePoints = BIGINT_ZERO;
        globalInfo.totalEigenLayerPoints = BIGINT_ZERO;
        globalInfo.save();
    }

    return globalInfo;
}

function getEigenpiePointsPerSec(lpToken: Bytes): BigInt {
    if (is3xBoost(lpToken)) {
        return ETHER_THREE.div(BigInt.fromI32(3600));
    }
    if (is2xBoost(lpToken)) {
        return ETHER_TWO.div(BigInt.fromI32(3600))
    } 
    return ETHER_ONE.div(BigInt.fromI32(3600))
}

function isDeFiIntegrationContract(address: Bytes): bool {
    if (isStringEqualIgnoreCase(address.toHexString(), MSTETH_WSTETH_RANGE_LP) ||
    isStringEqualIgnoreCase(address.toHexString(), MSTETH_WSTETH_CURVE_LP) ||
    isStringEqualIgnoreCase(address.toHexString(), MSTETH_WSTETH_PCS_LP) ||
    isStringEqualIgnoreCase(address.toHexString(), MSWETH_SWETH_CURVE_LP) ||
    isStringEqualIgnoreCase(address.toHexString(), MSWETH_SWETH_RANGE_LP) ||
    isStringEqualIgnoreCase(address.toHexString(), MSWETH_SWETH_PCS_LP) ||
    isStringEqualIgnoreCase(address.toHexString(), ZIRCUIT_STAKING)
    ) {
        return true;
    }
    return false;
}

function is2xBoost(lpToken: Bytes): bool {
    return isStringEqualIgnoreCase(lpToken.toHexString(), MSTETH_WSTETH_CURVE_LP) || 
    isStringEqualIgnoreCase(lpToken.toHexString(), MSTETH_WSTETH_RANGE_LP) ||
    isStringEqualIgnoreCase(lpToken.toHexString(), MSTETH_ZIRCUIT_STAKING_LP) || 
    isStringEqualIgnoreCase(lpToken.toHexString(), MWBETH_ZIRCUIT_STAKING_LP);
}

function is3xBoost(lpToken: Bytes): bool {
    return isStringEqualIgnoreCase(lpToken.toHexString(), MSWETH_SWETH_CURVE_LP) || 
    isStringEqualIgnoreCase(lpToken.toHexString(), MSWETH_SWETH_RANGE_LP) ||
    isStringEqualIgnoreCase(lpToken.toHexString(), MSWETH_ZIRCUIT_STAKING_LP);
}

function calEigenpiePointGroupBoost(groupTvl: BigInt): BigInt {
    let boostMultiplier = ETHER_ONE;

    // Define TVL thresholds and their corresponding boost values
    const tvlThresholds: BigInt[] = [
        BigInt.fromI32(100).times(ETHER_ONE),
        BigInt.fromI32(500).times(ETHER_ONE),
        BigInt.fromI32(1000).times(ETHER_ONE),
        BigInt.fromI32(2000).times(ETHER_ONE),
        BigInt.fromI32(5000).times(ETHER_ONE)
    ]

    const boostValues = [12000, 14000, 16000, 18000, 20000]

    // Determine the boost multiplier based on the total TVL
    for (let i = tvlThresholds.length - 1; i >= 0; i--) {
        if (groupTvl.ge(tvlThresholds[i])) {
            boostMultiplier = ETHER_ONE.times(BigInt.fromI32(boostValues[i])).div(DENOMINATOR);
            break
        }
    }

    return boostMultiplier;
}

function updateAllPools(blockTimestamp: BigInt): void {
    for (let i = 0; i < LPTOKEN_LIST.length; i++) {
        updatePools(Bytes.fromHexString(LPTOKEN_LIST[i]), blockTimestamp);
    }
}

function updatePools(lpToken: Bytes, blockTimestamp: BigInt): void {
    let lpInfo = loadOrCreateLpInfo(lpToken);
    let pools = lpInfo.pools.load();
    for (let i = 0; i < pools.length; i++) {
        let pool = pools[i];
        updatePool(pool.group, pool.lpToken, blockTimestamp);
    }
}

function dailyUpdateAllPools(blockTimestamp: BigInt): void {
    let globalInfo = loadOrCreateGlobalInfo();
    if (blockTimestamp.minus(globalInfo.lastDailyUpdateAllPoolsTimestamp).gt(BigInt.fromI32(3600*24))) {
        updateAllPools(blockTimestamp);
        globalInfo.lastDailyUpdateAllPoolsTimestamp = blockTimestamp;
        globalInfo.save();
    }
}

function updateGlobalBoost(blockTimestamp: BigInt): void {
    let globalInfo = loadOrCreateGlobalInfo();
    if (blockTimestamp.le(BigInt.fromI32(1707782400))) {
        // 2X global boost
        // Duration: from Eigenpie launche time to 2024/2/13 0:00 UTC
        if (globalInfo.globalBoost.notEqual(BIGINT_TWO.times(ETHER_ONE))) {
            updateAllPools(blockTimestamp);
            globalInfo.globalBoost = BIGINT_TWO.times(ETHER_ONE);
        }
    } else if (blockTimestamp.le(BigInt.fromI32(1708765200))) {
        // 1X global boost
        // Duration: from 2024/2/13 0:00 UTC to 2024/2/24 9:00 UTC
        if (globalInfo.globalBoost.notEqual(BIGINT_ONE.times(ETHER_ONE))) {
            updateAllPools(blockTimestamp);
            globalInfo.globalBoost = BIGINT_ONE.times(ETHER_ONE);
        }
    } else if (blockTimestamp.le(BigInt.fromI32(1709629200))) {
        // 2X global boost
        // Duration: from 2024/2/24 9:00 to 2024/3/5 9:00 UTC
        if (globalInfo.globalBoost.notEqual(BIGINT_TWO.times(ETHER_ONE))) {
            updateAllPools(blockTimestamp);
            globalInfo.globalBoost = BIGINT_TWO.times(ETHER_ONE);
        }
    } else {
        // 1X global boost
        // Duration: from 2024/3/5 9:00 UTC to future
        if (globalInfo.globalBoost.notEqual(BIGINT_ONE.times(ETHER_ONE))) {
            updateAllPools(blockTimestamp);
            globalInfo.globalBoost = BIGINT_ONE.times(ETHER_ONE);
        }
    }
    globalInfo.save();
}

function isStringEqualIgnoreCase(str1: string, str2: string): bool {
    return str1.toLowerCase() == str2.toLowerCase();
}

function toLowerCase(address: Bytes): Bytes {
    return Bytes.fromHexString(address.toHexString().toLowerCase());
}

function isZircuitSupportedMlrt(mlrtAddress: Bytes): bool {
    return isStringEqualIgnoreCase(mlrtAddress.toHexString(), MSWETH) || isStringEqualIgnoreCase(mlrtAddress.toHexString(), MSTETH) || isStringEqualIgnoreCase(mlrtAddress.toHexString(), MWBETH)
}

// ################################# Math Utils ######################################## //
function mul(a: BigInt, b: BigInt): BigInt {
    return a.times(b).div(ETHER_ONE);
}

function div(a: BigInt, b: BigInt): BigInt {
    return a.times(ETHER_ONE).div(b);
}

// ################################# Debug Utils ######################################## //
function debugLogInfo(userAddress: Bytes, entryPoint: string, transactionHash: Bytes): void {
    if (isStringEqualIgnoreCase(userAddress.toHexString(), "")) {
        let userInfo = loadOrCreateUserInfo(userAddress);
        let userBalances = userInfo.userBalances.load();
        for (let j = 0; j < userBalances.length; j++) {
            let userBalance = userBalances[j];
            log.debug(entryPoint.concat(": userBalance.shares {}, userBalance.group {}, userBalance.lpToke {}, transactionHash {}"), [userBalance.shares.toString(), userBalance.group.toHexString(), userBalance.lpToken.toHexString(), transactionHash.toHexString()]);
        }        
    }
}