import { dbz } from '@/app/lib/db/db';
import { eq, and } from 'drizzle-orm';
import { climbCommunityStatus } from '@/app/lib/db/schema';

type FetchClimbDetailDataParams = {
  boardName: string;
  climbUuid: string;
  angle: number;
};

export async function fetchClimbDetailData({ boardName, climbUuid, angle }: FetchClimbDetailDataParams) {
  try {
    const [result] = await dbz
      .select({ communityGrade: climbCommunityStatus.communityGrade })
      .from(climbCommunityStatus)
      .where(
        and(
          eq(climbCommunityStatus.climbUuid, climbUuid),
          eq(climbCommunityStatus.boardType, boardName),
          eq(climbCommunityStatus.angle, angle),
        ),
      )
      .limit(1);

    return { communityGrade: result?.communityGrade ?? null };
  } catch {
    return { communityGrade: null };
  }
}
