export interface PostStats {
  id: string
  playCount: number
  likeCount: number
  commentCount: number
  saveCount: number
  shareCount: number
}

export interface TiktokGetStatsResponse {
  status: "success" | "error"
  message?: string
  result?: PostStats[]
}
