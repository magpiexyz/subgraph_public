import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
export const EIGEN_LAYER_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const EIGENPIE_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const CURVE_POINT_PER_SEC = BigInt.fromString("2000000000000000000").div(BigInt.fromI32(3600))
export const RANGE_POINT_PER_SEC = BigInt.fromString("2000000000000000000").div(BigInt.fromI32(3600))
export const MLRT_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const ETHER_ONE = BigInt.fromString("1000000000000000000")
export const ETHER_TWO = BigInt.fromString("2000000000000000000")
export const ETHER_THREE = BigInt.fromString("2000000000000000000")
export const ETHER_TEN = BigInt.fromString("10000000000000000000")
export const DENOMINATOR = BigInt.fromI32(10000)
export const ADDRESS_ZERO = Address.fromHexString("0x0000000000000000000000000000000000000000".toLowerCase())
export const ADDRESS_ZERO_BYTES = Bytes.fromHexString("0x0000000000000000000000000000000000000000".toLowerCase())
export const BIGINT_ZERO = BigInt.fromI32(0)
export const BIGINT_ONE = BigInt.fromI32(1)
export const BIGINT_TWO = BigInt.fromI32(2)
export const BYTES_ZERO = Bytes.fromI32(0)
export const EIGEN_LAYER_LAUNCH_TIME = BigInt.fromI32(1707163200)
export const EIGENPIE_PREDEPLOST_HELPER = "0xcc5460cf8f81caa790b87910364e67ddb50e242b".toLowerCase();
export const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0".toLowerCase();
export const MSTETH = "0x49446A0874197839D15395B908328a74ccc96Bc0".toLowerCase();
export const STETH = "0xae7ab96520de3a18e5e111b5eaab095312d7fe84".toLowerCase();
export const MRETH = "0xd05728038681bcc79b2d5aeb4d9b002e66C93A40".toLowerCase();
export const RETH = "0xae78736cd615f374d3085123a210448e74fc6393".toLowerCase();
export const MSFRXETH = "0x879054273cb2DAD631980Fa4efE6d25eeFe08AA4".toLowerCase();
export const SFRXETH = "0xac3e018457b222d93114458476f3e3416abbe38f".toLowerCase();
export const MMETH = "0x8a053350ca5F9352a16deD26ab333e2D251DAd7c".toLowerCase();
export const METH = "0xd5f7838f5c461feff7fe49ea5ebaf7728bb0adfa".toLowerCase();
export const MWBETH = "0xE46a5E19B19711332e33F33c2DB3eA143e86Bc10".toLowerCase();
export const WBETH = "0xa2E3356610840701BDf5611a53974510Ae27E2e1".toLowerCase();
export const MSWETH = "0x32bd822d615A3658A68b6fDD30c2fcb2C996D678".toLowerCase();
export const SWETH = "0xf951e335afb289353dc249e82926178eac7ded78".toLowerCase();
export const MCBETH = "0xD09124e8a1e3D620E8807aD1d968021A5495CEe8".toLowerCase();
export const CBETH = "0xbe9895146f7af43049ca1c1ae358b0541ea49704".toLowerCase();
export const METHX = "0x9a1722b1f4A1BB2F271211ade8e851aFc54F77E5".toLowerCase();
export const ETHX = "0xa35b1b31ce002fbf2058d22f30f95d405200a15b".toLowerCase();
export const MANKRETH = "0x5A4A503F4745c06A07E29D9a9DD88aB52f7a505B".toLowerCase();
export const ANKRETH = "0xe95a203b1a91a908f9b9ce46459d101078c2c3cb".toLowerCase();
export const MOSETH = "0x352a3144e88D23427993938cfd780291D95eF091".toLowerCase();
export const OSETH = "0xf1c9acdc66974dfb6decb12aa385b9cd01190e38".toLowerCase();
export const MOETH = "0x310718274509a38cc5559a1ff48c5eDbE75a382B".toLowerCase();
export const OETH = "0x856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc3".toLowerCase();
export const MLSETH = "0xa939C02DbA8F237b40d2A3E96AD4252b00Bb8a72".toLowerCase();
export const LSETH = "0x8c1bed5b9a0928467c9b1341da1d7bd5e10b6549".toLowerCase();
// Zircuit
export const ZIRCUIT_STAKING = "0xF047ab4c75cebf0eB9ed34Ae2c186f3611aEAfa6".toLowerCase();
export const MSTETH_ZIRCUIT_STAKING_LP = ZIRCUIT_STAKING.concat(MSTETH).toLowerCase();
export const MSWETH_ZIRCUIT_STAKING_LP = ZIRCUIT_STAKING.concat(MSWETH).toLowerCase();
export const MWBETH_ZIRCUIT_STAKING_LP = ZIRCUIT_STAKING.concat(MWBETH).toLowerCase();
// DEX LP
export const MSTETH_WSTETH_CURVE_LP = "0xC040041088B008EAC1bf5FB886eAc8c1e244B60F".toLowerCase();
export const MSTETH_WSTETH_RANGE_LP = "0x3E0c9e83f2718C2a05b2dd42E672b335Cdf13824".toLowerCase();
export const MSTETH_WSTETH_PCS_LP = "0x350d6d813Be7B64681f91F16A98Ef360Bd42b66b".toLowerCase();
export const MSWETH_SWETH_CURVE_LP = "0x2022d9AF896eCF0F1f5B48cdDaB9e74b5aAbCf00".toLowerCase();
export const MSWETH_SWETH_RANGE_LP = "0xE4b7aC5a573056cfF9C361Bc68aD779f7DA9D342".toLowerCase();
export const MSWETH_SWETH_PCS_LP = "0x6177811663A60Ac211566bE5873c5Ed441D9E948".toLowerCase();
export const  LST_TO_MLRT_MAP = new Map<string, string>();
LST_TO_MLRT_MAP.set(STETH , MSTETH);
LST_TO_MLRT_MAP.set(RETH, MRETH);
LST_TO_MLRT_MAP.set(SFRXETH, MSFRXETH);
LST_TO_MLRT_MAP.set(METH, MMETH);
LST_TO_MLRT_MAP.set(WBETH, MWBETH);
LST_TO_MLRT_MAP.set(SWETH, MSWETH);
LST_TO_MLRT_MAP.set(CBETH, MCBETH);
LST_TO_MLRT_MAP.set(ETHX, METHX);
LST_TO_MLRT_MAP.set(ANKRETH, MANKRETH);
LST_TO_MLRT_MAP.set(OSETH, MOSETH);
LST_TO_MLRT_MAP.set(OETH, MOETH);
LST_TO_MLRT_MAP.set(LSETH, MLSETH);
export const LPTOKEN_LIST = [
    MSTETH, MRETH, MSFRXETH, MMETH, MWBETH, MSWETH, MCBETH, METHX, MANKRETH, MOSETH, MOETH, MLSETH, // mLRT LPs
    MSTETH_WSTETH_CURVE_LP, MSWETH_SWETH_CURVE_LP, // Curve LPs
    MSTETH_ZIRCUIT_STAKING_LP, MSWETH_ZIRCUIT_STAKING_LP, MWBETH_ZIRCUIT_STAKING_LP]; // Zircuit LPs
export const LST_PRICE_MAP = new Map<string, BigInt>();
LST_PRICE_MAP.set(STETH, ETHER_ONE);
LST_PRICE_MAP.set(WSTETH, ETHER_ONE.times(BigInt.fromI32(1159)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(RETH, ETHER_ONE.times(BigInt.fromI32(1101)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(SFRXETH, ETHER_ONE.times(BigInt.fromI32(1077)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(METH, ETHER_ONE.times(BigInt.fromI32(1024)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(WBETH, ETHER_ONE.times(BigInt.fromI32(1033)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(SWETH, ETHER_ONE.times(BigInt.fromI32(1053)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(CBETH, ETHER_ONE.times(BigInt.fromI32(1065)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(ETHX, ETHER_ONE.times(BigInt.fromI32(1023)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(ANKRETH, ETHER_ONE.times(BigInt.fromI32(1149)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(OSETH, ETHER_ONE.times(BigInt.fromI32(1009)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(OETH, ETHER_ONE);
LST_PRICE_MAP.set(LSETH, ETHER_ONE.times(BigInt.fromI32(1042)).div(BigInt.fromI32(1000)));