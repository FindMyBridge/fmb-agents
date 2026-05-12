import type { Address, Hex } from 'viem';
import { encodeFunctionData, pad } from 'viem';

export const tokenMessengerV2Abi = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [],
  },
] as const;

export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

export function addressToBytes32(address: Address): Hex {
  return pad(address, { size: 32 });
}

export interface BuildDepositForBurnParams {
  amount: bigint;
  destinationDomain: number;
  mintRecipient: Address;
  burnToken: Address;
  maxFee: bigint;
  minFinalityThreshold: number;
  destinationCaller?: Address;
}

export function encodeDepositForBurn(params: BuildDepositForBurnParams): Hex {
  const destinationCaller = params.destinationCaller
    ? addressToBytes32(params.destinationCaller)
    : ('0x' + '00'.repeat(32)) as Hex;

  return encodeFunctionData({
    abi: tokenMessengerV2Abi,
    functionName: 'depositForBurn',
    args: [
      params.amount,
      params.destinationDomain,
      addressToBytes32(params.mintRecipient),
      params.burnToken,
      destinationCaller,
      params.maxFee,
      params.minFinalityThreshold,
    ],
  });
}

export function encodeApprove(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  });
}
