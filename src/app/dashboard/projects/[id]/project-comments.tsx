'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  MessageSquare,
  Send,
  MoreVertical,
  Pencil,
  Trash2,
  User,
  Loader2,
  AtSign,
  Layers,
  CheckSquare,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface ProjectCommentsProps {
  projectId: string
  currentUserId: string
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  members?: Array<{
    employee: {
      id: string
      name: string
    }
  }>
}

export function ProjectComments({ projectId, currentUserId }: ProjectCommentsProps) {
  const utils = trpc.useUtils()
  const [newComment, setNewComment] = useState('')
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  const { data: comments, isLoading } = trpc.project.getComments.useQuery({
    projectId,
  })

  const createComment = trpc.project.createComment.useMutation({
    onSuccess: () => {
      utils.project.getComments.invalidate({ projectId })
      utils.project.getActivities.invalidate({ projectId })
      setNewComment('')
    },
  })

  const updateComment = trpc.project.updateComment.useMutation({
    onSuccess: () => {
      utils.project.getComments.invalidate({ projectId })
      setEditingComment(null)
    },
  })

  const deleteComment = trpc.project.deleteComment.useMutation({
    onSuccess: () => {
      utils.project.getComments.invalidate({ projectId })
      setDeletingCommentId(null)
    },
  })

  const handleSubmit = () => {
    if (!newComment.trim()) return
    createComment.mutate({
      projectId,
      content: newComment,
      authorId: currentUserId,
    })
  }

  const handleUpdate = () => {
    if (!editingComment || !editingComment.content.trim()) return
    updateComment.mutate({
      id: editingComment.id,
      content: editingComment.content,
      actorId: currentUserId,
    })
  }

  const handleDelete = () => {
    if (!deletingCommentId) return
    deleteComment.mutate({
      id: deletingCommentId,
      actorId: currentUserId,
    })
  }

  const getTargetLabel = (comment: { phase?: { name: string } | null; task?: { name: string } | null }) => {
    if (comment.task) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <CheckSquare className="h-3 w-3" />
          {comment.task.name}
        </Badge>
      )
    }
    if (comment.phase) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <Layers className="h-3 w-3" />
          {comment.phase.name}
        </Badge>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          討論區
          {comments && comments.length > 0 && (
            <Badge variant="secondary">{comments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Comment Form */}
        <div className="space-y-2">
          <Textarea
            placeholder="輸入評論..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || createComment.isPending}
            >
              {createComment.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              發送
            </Button>
          </div>
        </div>

        {/* Comments List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : comments && comments.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    'p-4 border rounded-lg',
                    comment.authorId === currentUserId && 'bg-primary/5'
                  )}
                >
                  {editingComment?.id === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingComment.content}
                        onChange={(e) => setEditingComment({ ...editingComment, content: e.target.value })}
                        rows={3}
                        className="resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingComment(null)}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUpdate}
                          disabled={!editingComment.content.trim() || updateComment.isPending}
                        >
                          {updateComment.isPending ? '儲存中...' : '儲存'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{comment.author.name}</span>
                              {getTargetLabel(comment)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.createdAt), {
                                addSuffix: true,
                                locale: zhTW,
                              })}
                            </p>
                          </div>
                        </div>
                        {comment.authorId === currentUserId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setEditingComment({ id: comment.id, content: comment.content })}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                編輯
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeletingCommentId(comment.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                刪除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <p className="mt-2 text-sm whitespace-pre-wrap">{comment.content}</p>
                      {comment.mentions && comment.mentions.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 flex-wrap">
                          <AtSign className="h-3 w-3 text-muted-foreground" />
                          {comment.mentions.map((mention) => (
                            <Badge key={mention.employee.id} variant="secondary" className="text-xs">
                              {mention.employee.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>尚無評論</p>
            <p className="text-sm">成為第一個發表評論的人</p>
          </div>
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingCommentId} onOpenChange={() => setDeletingCommentId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>刪除評論</AlertDialogTitle>
              <AlertDialogDescription>
                確定要刪除這則評論嗎？此操作無法復原。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                {deleteComment.isPending ? '刪除中...' : '確定刪除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
