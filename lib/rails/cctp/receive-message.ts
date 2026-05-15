import type { Hex } from 'viem';
import { encodeFunctionData } from 'viem';

export const messageTransmitterV2Abi = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'usedNonces',
    stateMutability: 'view',
    inputs: [{ name: 'nonce', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'MessageReceived',
    anonymous: false,
    inputs: [
      { name: 'caller', type: 'address', indexed: true },
      { name: 'sourceDomain', type: 'uint32', indexed: false },
      { name: 'nonce', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'bytes32', indexed: false },
      { name: 'finalityThresholdExecuted', type: 'uint32', indexed: true },
      { name: 'messageBody', type: 'bytes', indexed: false },
    ],
  },
] as const;

/**
 * Encodes the `receiveMessage` call that completes a CCTP V2 transfer on the
 * destination chain. `message` and `attestation` are the bytes returned by
 * Circle's Iris API once the burn is attested. The call is permissionless —
 * anyone can submit it — but the transaction still needs gas on the destination.
 */
export function encodeReceiveMessage(message: Hex, attestation: Hex): Hex {
  return encodeFunctionData({
    abi: messageTransmitterV2Abi,
    functionName: 'receiveMessage',
    args: [message, attestation],
  });
}
