/**
 * core/index.ts — re-export the public core types and API surface.
 * Other modules must import from this barrel, not reach into individual files.
 */

export * from './types';
export * from './events';
export * from './api';
