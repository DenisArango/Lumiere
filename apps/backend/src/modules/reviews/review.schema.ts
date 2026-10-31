import { z } from "zod";
import { paginationSchema } from "@/utils/pagination";

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export const updateReviewSchema = createReviewSchema.partial();

export const moderateReviewSchema = z.object({
  isApproved: z.boolean(),
});

export const listReviewsQuerySchema = paginationSchema;

export const listAllReviewsQuerySchema = paginationSchema.extend({
  isApproved: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type ListAllReviewsQuery = z.infer<typeof listAllReviewsQuerySchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
