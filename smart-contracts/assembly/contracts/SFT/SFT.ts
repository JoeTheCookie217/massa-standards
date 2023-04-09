import {
  Storage,
  Context,
  generateEvent,
  callerHasWriteAccess,
  Address,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToString,
  bytesToU64,
  stringToBytes,
  u64ToBytes,
} from '@massalabs/as-types';

export const nameKey = 'name';
export const symbolKey = 'symbol';
export const totalSupplyKey = stringToBytes('totalSupply');
export const baseURIKey = 'baseURI';
export const ownerKey = 'Owner';
export const counterKey = stringToBytes('Counter');
export const approvedTokenKey = 'approved_';
export const initCounter = 0;

/**
 * Initialize all the properties of the SFT (contract Owner, counter to 0...)
 *
 * @remarks
 * Storage specification:
 * - 'name' =\> (string) the token name
 * - 'symbol' =\> (string) the token symbol
 * - 'totalSupply' =\> (StaticArray<u8>) the total supply
 * - 'baseURI' =\> (string) the base URI (must ends with '/')
 * - 'Owner' =\> (string) the owner address
 * - 'Counter' =\> (StaticArray<u8>) the current counter
 * - 'ownerOf_[token id]' =\> (string) the owner of the specified token id
 *
 * @example
 * ```typescript
 * constructor(
 *   new Args()
 *     .add(SFTName)
 *     .add(SFTSymbol)
 *     .add(u64(SFTtotalSupply))
 *     .add(SFTBaseURI)
 *     .serialize(),
 *   );
 * ```
 *
 * @param binaryArgs - arguments serialized with `Args` containing the name, the symbol, the totalSupply as u64,
 * the baseURI
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(callerHasWriteAccess());

  const args = new Args(binaryArgs);
  const name = args.nextString().expect('name argument is missing or invalid');
  const symbol = args
    .nextString()
    .expect('symbol argument is missing or invalid');
  const totalSupply = args
    .nextU64()
    .expect('totalSupply argument is missing or invalid');
  const baseURI = args
    .nextString()
    .expect('baseURI argument is missing or invalid');

  Storage.set(nameKey, name);
  Storage.set(symbolKey, symbol);
  Storage.set(totalSupplyKey, u64ToBytes(totalSupply));
  Storage.set(baseURIKey, baseURI);
  Storage.set(ownerKey, Context.caller().toString());
  Storage.set(counterKey, u64ToBytes(initCounter));

  generateEvent(
    `${name} with symbol ${symbol} and total supply of ${totalSupply.toString()} is well set`,
  );
}

/**
 * Change the base URI, can be only called by the contract Owner
 * @param binaryArgs - Serialized URI String with `Args`
 */
export function setURI(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);
  const newBaseURI = args
    .nextString()
    .expect('BaseURI argument is missing or invalid');

  assert(_onlyOwner(), 'The caller is not the owner of the contract');
  Storage.set(baseURIKey, newBaseURI);
  generateEvent(`new base URI ${newBaseURI} well set`);
}

// ======================================================== //
// ====                 TOKEN ATTRIBUTES               ==== //
// ======================================================== //

// Token attributes functions return a generateEvent when possible for more readability as we cannot return string

/**
 * Returns the SFT's name
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 */
export function name(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return stringToBytes(Storage.get(nameKey));
}

/**
 * Returns the SFT's symbol
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 */
export function symbol(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return stringToBytes(Storage.get(symbolKey));
}

/**
 * Returns the token URI (external link written in SFT where pictures or others are stored)
 * @param binaryArgs - U64 serialized tokenID with `Args`
 */
export function tokenURI(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenId = args
    .nextU64()
    .expect('token id argument is missing or invalid');

  return stringToBytes(Storage.get(baseURIKey) + tokenId.toString());
}

/**
 * Returns the base URI
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 */
export function baseURI(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return stringToBytes(Storage.get(baseURIKey));
}

/**
 * Returns the max supply possible
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns the u64 max supply
 */
export function totalSupply(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return Storage.get(totalSupplyKey);
}

/**
 * Return the current supply.
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns the u64 current counter
 */
export function currentSupply(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return Storage.get(counterKey);
}

// ==================================================== //
// ====                    MINT                    ==== //
// ==================================================== //

/**
 * The argument's address becomes the owner of the next token (if current tokenID = 10, will mint the 11 )
 * Check if max supply is not reached
 * @param _args - Address as string serialized with `Args`
 */
export function mint(_args: StaticArray<u8>): void {
  assert(
    bytesToU64(Storage.get(totalSupplyKey)) > _currentSupply(),
    'Max supply reached',
  );

  const args = new Args(_args);
  const mintAddress = new Address(
    args.nextString().expect('mintAddress argument is missing or invalid'),
  );
  const amount = args.nextU64().expect('amount argument is missing or invalid');

  _increment();
  const tokenToMint = _currentSupply();
  _setBalance(mintAddress, tokenToMint, _balance(mintAddress, tokenToMint) + amount);
  // generateEvent(`tokenId ${tokenToMint} minted to ${mintAddress} `);
}

function _mint(to: Address, id: u64, amount: u64): void {
  const operator = Context.caller();
  _setBalance(to, id, _balance(to, id) + amount);
}

/**
 * Increment the SFT counter
 */
function _increment(): void {
  const currentID = bytesToU64(Storage.get(counterKey));
  Storage.set(counterKey, u64ToBytes(currentID + 1));
}

/**
 * @returns true if the caller is the creator of the SC
 */
function _onlyOwner(): bool {
  return Context.caller().toString() == Storage.get(ownerKey);
}

/**
 * Internal function returning the currentSupply
 * @returns u64
 */
function _currentSupply(): u64 {
  return bytesToU64(Storage.get(counterKey));
}

// ==================================================== //
// ====                 TRANSFER                   ==== //
// ==================================================== //

/**
 * Transfer a chosen token from the caller to the to Address.
 * First check that the token is minted and that the caller owns the token.
 * @param binaryArgs - arguments serialized with `Args` containing the following data in this order :
 * - the recipient's account (address)
 * - the tokenID (u64).
 */
export function transfer(binaryArgs: StaticArray<u8>): void {
  const fromAddress = Context.caller();
  const args = new Args(binaryArgs);
  const toAddress = new Address(
    args.nextString().expect('toAddress argument is missing or invalid'),
  );
  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');
  const amount = args.nextU64().expect('amount argument is missing or invalid');

  // assertOwnsSFT(tokenId);

  _transfer(fromAddress, toAddress, tokenId, amount);

  generateEvent(
    `token ${tokenId.toString()} sent from ${fromAddress.toString()} to ${toAddress}`,
  );
}

/**
 * Transfer a chosen token from the from Address to the to Address.
 * First check that the token is minted and that the caller is allowed to transfer the token.
 * @param binaryArgs - arguments serialized with `Args` containing the following data in this order :
 * - the sender's account (address)
 * - the recipient's account (address)
 * - the tokenID (u64).
 * @throws if the token is not minted or if the caller is not allowed to transfer the token
 */
export function transferFrom(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);
  const from = args
    .nextString()
    .expect('fromAddress argument is missing or invalid');
  const to = args
    .nextString()
    .expect('toAddress argument is missing or invalid');
  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');

  assertOnlyApproved(from, tokenId);

  _removeApprovals(tokenId);
}

function _transfer(
  from: Address,
  to: Address,
  tokenId: u64,
  amount: u64,
): void {
  _removeApprovals(tokenId);

  const oldBalance = _balance(from, tokenId);
  assert(oldBalance >= amount, 'Insufficient balance');

  _setBalance(from, tokenId, oldBalance - amount);
  _setBalance(to, tokenId, _balance(to, tokenId) + amount);
}

/**
 * Approves another address to transfer the given token ID.
 * @param binaryArgs - arguments serialized with `Args` containing the following data in this order:
 * - the owner's - owner address
 * - the spenderAddress - spender address
 * - the tokenID (u64)
 */
export function approve(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const callerAddress = Context.caller();

  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');

  assertOwnsSFT(tokenId);

  const toAddress = new Address(
    args.nextString().expect('toAddress argument is missing or invalid'),
  );

  assert(
    callerAddress.toString() != toAddress.toString(),
    `You are already the owner of ${tokenId.toString()}`,
  );

  assert(
    !isApproved(new Args().add(callerAddress).add(tokenId).serialize()),
    `You are already allowed to transfer ${tokenId.toString()}`,
  );

  _approve(tokenId, toAddress);

  generateEvent(
    `token ${tokenId.toString()} approved by ${Context.caller().toString()} for ${toAddress}`,
  );
}

/**
 * Store the approved address for a token
 *
 * @param owner - owner address
 * @param spenderAddress - spender address
 * @param tokenId - The token ID to approve
 */
function _approve(tokenId: u64, spenderAddress: Address): void {
  let value: string = spenderAddress.toString();

  const key = approvedTokenKey + tokenId.toString();

  if (Storage.has(key)) value = Storage.get(key) + ',' + value;

  Storage.set(key, value);
}

/**
 * @param binaryArgs - arguments serialized with `Args` containing the following data in this order :
 * - the tokenID (u64)
 * @returns string containing the authorized addresses separated by a comma
 */
export function getApproved(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');

  const key = approvedTokenKey + tokenId.toString();

  return stringToBytes(Storage.get(key));
}

/**
 * Removes all the approvals of the token
 * @param tokenId - the tokenID
 */
function _removeApprovals(tokenId: u64): void {
  const key = approvedTokenKey + tokenId.toString();
  Storage.del(key);
}

/**
 * Return if the address is approved to transfer the tokenId
 * @param binaryArgs - arguments serialized with `Args` containing the following data in this order :
 * - the address (string)
 * - the tokenID (u64)
 * @returns true if the address is approved to transfer the tokenId, false otherwise
 */
export function isApproved(binaryArgs: StaticArray<u8>): bool {
  const args = new Args(binaryArgs);
  const address = args
    .nextString()
    .expect('address argument is missing or invalid');
  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');

  const key = approvedTokenKey + tokenId.toString();

  const value = Storage.get(key);

  const addresses: string[] = value.split(',');

  return addresses.includes(address);
}

// ==================================================== //
// ====             General Assertions             ==== //
// ==================================================== //

function assertOwnsSFT(tokenId: u64): void {
  assert(
    _balance(Context.caller(), tokenId) >= 1,
    `You are not the owner of ${tokenId.toString()}`,
  );
}

function assertOnlyApproved(from: string, tokenId: u64): void {
  assert(
    isApproved(new Args().add(from).add(tokenId).serialize()),
    'You are not allowed to transfer this token',
  );
}

// ==================================================== //
// ====                   Balance                  ==== //
// ==================================================== //

export const BALANCE_KEY = 'BALANCE';

/**
 * Returns the balance of an account.
 *
 * @param binaryArgs - Args object serialized as a string containing an owner's account (Address).
 */
export function balanceOf(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);

  const addr = new Address(
    args.nextString().expect('Address argument is missing or invalid'),
  );
  const id = args.nextU64().expect('Token ID argument is missing or invalid');

  return u64ToBytes(_balance(addr, id));
}

/**
 * Returns the balance of a given address.
 *
 * @param address - address to get the balance for
 */
function _balance(address: Address, id: u64): u64 {
  const key = getBalanceKey(address, id);
  if (Storage.has(key)) {
    return bytesToU64(Storage.get(key));
  }
  return 0;
}

/**
 * Sets the balance of a given address.
 *
 * @param address - address to set the balance for
 * @param balance -
 */
function _setBalance(address: Address, id: u64, balance: u64): void {
  Storage.set(getBalanceKey(address, id), u64ToBytes(balance));
}

/**
 * @param address -
 * @returns the key of the balance in the storage for the given address
 */
function getBalanceKey(address: Address, id: u64): StaticArray<u8> {
  return stringToBytes(BALANCE_KEY + address.toString() + id.toString());
}
