import { Args, u64ToBytes } from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';

export class IERC721Receiver {
  constructor(public _origin: Address) {}

  static onERC721ReceivedSelector: StaticArray<u8> = u64ToBytes(0x150b7a02);

  onERC721Received(
    operator: Address,
    from: Address,
    tokenId: u64,
  ): StaticArray<u8> {
    return call(
      this._origin,
      'onERC721Received',
      new Args().add(operator).add(from).add(tokenId),
      0,
    );
  }
}
