import { z } from 'zod';
import { BoardNameSchema, ExternalUUIDSchema } from './primitives';

export const CreateBetaVideoInputSchema = z.object({
  boardType: BoardNameSchema,
  climbUuid: ExternalUUIDSchema,
  angle: z.number().int().min(0).max(90).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
});
