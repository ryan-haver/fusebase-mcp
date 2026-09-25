/**
 * Random identifiers for notes, blocks, column keys and embeds.
 *
 * Uses the cryptographic RNG rather than Math.random (COR-16): these ids are written into
 * shared documents and must not collide or be predictable across processes.
 */

import { randomInt } from "crypto";

export const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const LOWER_ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";
export const HEX = "0123456789abcdef";

/** A random string of `length` characters drawn uniformly from `alphabet`. */
export function randomId(length: number, alphabet: string = ALPHANUMERIC): string {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}
