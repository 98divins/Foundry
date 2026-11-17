import { describe, expect, it } from 'vitest';
import { collectSocialData, SOCIAL_EXPORT } from './cloud/social';

describe('social data export', () => {
  it('collects the member’s rows from every shared table and skips missing ones', async () => {
    const asked: string[] = [];
    const out = await collectSocialData('me', async (table, owner, uid) => {
      asked.push(`${table}.${owner}=${uid}`);
      if (table === 'respects') return null; // table not created on the server
      return [{ table, owner }];
    });
    expect(asked.length).toBe(SOCIAL_EXPORT.length);
    expect(out.friendships.length).toBe(2); // asked and received
    expect(out.respects).toBeUndefined();
    expect(Object.keys(out)).toEqual(expect.arrayContaining(['profiles', 'activities', 'activity_comments', 'shared_meals', 'community_foods']));
  });
});
