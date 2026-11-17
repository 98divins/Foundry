import { describe, expect, it } from 'vitest';
import { LEGAL_DRAFT, missingLegalFields } from './legalConfig';

describe('legal identity', () => {
  it('cannot leave draft mode while the publisher identity is incomplete', () => {
    // Fails (and so blocks the deploy) if LEGAL_DRAFT is set to false with empty fields.
    if (!LEGAL_DRAFT) expect(missingLegalFields()).toEqual([]);
    else expect(Array.isArray(missingLegalFields())).toBe(true);
  });
});
