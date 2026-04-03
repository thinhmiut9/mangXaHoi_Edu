import { z } from 'zod'
import { isCloudinaryImageUrl, isCloudinaryVideoUrl } from '../../utils/cloudinary'

const cloudinaryMediaUrlSchema = z
  .string()
  .url('URL media khong hop le')

export const createStorySchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO']),
  mediaUrl: cloudinaryMediaUrlSchema,
  content: z.string().max(300, 'Noi dung tin toi da 300 ky tu').optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'VIDEO' && !isCloudinaryVideoUrl(value.mediaUrl)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mediaUrl'],
      message: 'Tin video phai dung URL video tu Cloudinary',
    })
  }
  if (value.type === 'IMAGE' && !isCloudinaryImageUrl(value.mediaUrl)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mediaUrl'],
      message: 'Tin anh phai dung URL anh tu Cloudinary',
    })
  }
})

export type CreateStoryDto = z.infer<typeof createStorySchema>