import { useInfiniteQuery } from '@tanstack/react-query'
import { postsApi } from '@/api/posts'
import { PostCard } from '@/components/shared/PostCard'
import { PostSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export default function SavedPostsPage() {
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['saved-posts'],
    queryFn: ({ pageParam = 1 }) => postsApi.getSavedPosts(pageParam as number),
    getNextPageParam: (lastPage) => lastPage.meta?.hasNext ? (lastPage.meta.page + 1) : undefined,
    initialPageParam: 1,
  })

  const posts = data?.pages.flatMap(page => page.data) ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Bài viết đã lưu</h1>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => <PostSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <EmptyState
          title="Không thể tải bài đã lưu"
          description="Có lỗi xảy ra. Vui lòng thử lại."
          action={<Button variant="secondary" onClick={() => refetch()}>Thử lại</Button>}
        />
      ) : posts.length === 0 ? (
        <EmptyState
          title="Bạn chưa lưu bài viết nào"
          description="Nhấn Lưu ở các bài bạn muốn xem lại sau."
        />
      ) : (
        <>
          {posts.map(post => <PostCard key={post.id} post={post} />)}
          {hasNextPage && (
            <div className="flex justify-center py-2">
              <Button variant="secondary" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}