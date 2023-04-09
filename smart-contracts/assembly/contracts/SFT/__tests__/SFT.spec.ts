import { Address, Storage, mockScCall } from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToString,
  bytesToU64,
  stringToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import {
  constructor,
  name,
  symbol,
  tokenURI,
  baseURI,
  totalSupply,
  mint,
  currentSupply,
  transfer,
  setURI,
  counterKey,
  initCounter,
  getApproved,
  approve,
  transferFrom,
  balanceOf,
} from '../SFT';
import { SFTWrapper } from '../SFTWrapper';

const callerAddress = 'A12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

const SFTName = 'MASSA_SFT';
const SFTSymbol = 'SFT';
const SFTBaseURI = 'my.massa/';
const SFTtotalSupply = 5;

describe('SFT contract TEST', () => {
  test('demonstrative test', () => {
    const SFTaddr = new Address(
      'A1C5bqToGpzCg3K4yQkuto69KhxcC5AtrsA11zyuC3cd1QeHmgU',
    );
    const myAddress = new Address(
      'A1qDAxGJ387ETi9JRQzZWSPKYq4YPXrFvdiE4VoXUaiAt38JFEC',
    );
    const SFT = new SFTWrapper(SFTaddr);
    mockScCall(stringToBytes('SFT name'));
    SFT.name();
    mockScCall(stringToBytes('SFT'));
    SFT.symbol();
    mockScCall(stringToBytes('test.massa/'));
    SFT.baseURI();
    mockScCall(stringToBytes('test.massa/2'));
    SFT.tokenURI(2);
    mockScCall(u64ToBytes(3));
    SFT.totalSupply();
    for (let i = 0; i < 3; i++) {
      mockScCall(stringToBytes('toto'));
      SFT.mint(myAddress.toString());
    }
    mockScCall(u64ToBytes(3));
    SFT.currentSupply();
    mockScCall(stringToBytes(myAddress.toString()));
    mockScCall([]); // mocked calls need a mocked value, this may change is the future
    SFT.transfer('1x', 1, 2);
    mockScCall(stringToBytes(myAddress.toString()));
  });

  test('constructor call', () => {
    constructor(
      new Args()
        .add(SFTName)
        .add(SFTSymbol)
        .add(u64(SFTtotalSupply))
        .add(SFTBaseURI)
        .serialize(),
    );
    expect(bytesToU64(Storage.get(counterKey))).toBe(initCounter);
  });

  test('get name', () => {
    expect(bytesToString(name())).toBe(SFTName);
  });
  test('get symbol', () => {
    expect(bytesToString(symbol())).toBe(SFTSymbol);
  });
  test('totalSupply call', () => {
    expect(bytesToU64(totalSupply())).toBe(SFTtotalSupply);
  });
  test('get baseURI', () => {
    expect(bytesToString(baseURI())).toBe(SFTBaseURI);
  });

  test('get current supply', () => {
    expect(bytesToU64(currentSupply())).toBe(0);
  });

  test('get tokenURI', () => {
    const tokenID = 1;
    expect(
      bytesToString(tokenURI(new Args().add<u64>(tokenID).serialize())),
    ).toBe('my.massa/1');
  });

  test('set URI', () => {
    const newURI = 'my.newMassaURI/';
    const tokenID = 1;
    setURI(new Args().add(newURI).serialize());
    expect(
      bytesToString(tokenURI(new Args().add<u64>(tokenID).serialize())),
    ).toBe('my.newMassaURI/1');
  });

  test('mint call, ownerOf and currentSupply call', () => {
    expect(bytesToU64(currentSupply())).toBe(0);
    const amountToMint = u64(2);
    for (let i = 0; i < 5; i++) {
      mint(new Args().add(callerAddress).add(amountToMint).serialize());
    }
    expect(Storage.get(counterKey)).toStrictEqual(u64ToBytes(SFTtotalSupply));
    expect(bytesToU64(currentSupply())).toBe(SFTtotalSupply);

    const someTokenID = u64(3);
    expect(
      balanceOf(new Args().add(callerAddress).add(someTokenID).serialize()),
    ).toStrictEqual(u64ToBytes(2));
  });

  throws('we have reach max supply', () => {
    mint(new Args().add(callerAddress).serialize());
  });
  test('current supply call', () => {
    expect(bytesToU64(currentSupply())).toBe(SFTtotalSupply);
  });

  test('transfer call', () => {
    const receiver = '2x';
    const tokenToSend = u64(2);
    const amountToSend = u64(1);
    const argTransfer = new Args()
      .add(receiver)
      .add(tokenToSend)
      .add(amountToSend)
      .serialize();

    transfer(argTransfer);
    expect(
      balanceOf(new Args().add(callerAddress).add(tokenToSend).serialize()),
    ).toStrictEqual(u64ToBytes(1));
    expect(
      balanceOf(new Args().add(receiver).add(tokenToSend).serialize()),
    ).toStrictEqual(u64ToBytes(1));

    transfer(argTransfer);
    expect(
      balanceOf(new Args().add(callerAddress).add(tokenToSend).serialize()),
    ).toStrictEqual(u64ToBytes(0));
    expect(
      balanceOf(new Args().add(receiver).add(tokenToSend).serialize()),
    ).toStrictEqual(u64ToBytes(2));
  });

  test('approval', () => {
    const tokenId: u64 = 1;
    const addresses = ['2x', '3x'];

    addresses.forEach((address) => {
      const args = new Args().add(tokenId).add(address).serialize();
      approve(args);
    });

    const allowedAddress = bytesToString(
      getApproved(new Args().add(tokenId).serialize()),
    );

    const approvedAddressArray = allowedAddress.split(',');

    expect(approvedAddressArray[0]).toStrictEqual(addresses[0]);
    expect(approvedAddressArray[1]).toStrictEqual(addresses[1]);
  });

  test('transferFrom', () => {
    const tokenId: u64 = 1;
    const addresses = ['2x', '3x'];

    transferFrom(
      new Args().add(addresses[0]).add(addresses[1]).add(tokenId).serialize(),
    );

    // expect(ownerOf(u64ToBytes(tokenId))).toStrictEqual(
    //   stringToBytes(addresses[1]),
    // );

    const allowedAddress = bytesToString(
      getApproved(new Args().add(tokenId).serialize()),
    );

    expect(allowedAddress).toStrictEqual('');
  });
});
