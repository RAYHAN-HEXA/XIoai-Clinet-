/**
 * XiaoCai engine — pure, deterministic finance functions.
 * No I/O: no DB, no network, no filesystem, no clock, no randomness.
 * No LLM. The AI layer explains engine output; it never produces numbers.
 * All money values are integers in fen (¥1 = 100).
 */
export * from './types';
export * from './trueProfit';
export * from './drivers';
export * from './cash';
export * from './financing';
export * from './evidence';
export * from './brief';
export const ENGINE_VERSION = '0.2.0';
