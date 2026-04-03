import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { postsApi } from '@/api/posts'
import { PostCard } from '@/components/shared/PostCard'
import { PostSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: post, isLoading, isError, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => postsApi.getPost(id!),
    enabled: !!id,
  })

  if (isLoading) return <PostSkeleton />

  if (isError || !post) {
    return (
      <EmptyState
        title="Không thể tải bài viết"
        description="Bài viết không tồn tại hoặc đã bị xóa."
        action={<Button variant="secondary" onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  }

  return (
    <div>
      <PostCard post={post} showComments />
    </div>
  )
}