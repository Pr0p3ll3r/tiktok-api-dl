export type TiktokUserPostsResponse = {
  status: "success" | "error"
  message?: string
  result?: Posts[]
  totalPosts?: number
}

export type Posts = {
  id: string
  desc: string
  createTime: number
  privateItem: boolean
  stats: StatsPost
  author: AuthorPost
  video: VideoPost
}

export type StatsPost = {
  playCount: number
}

export type AuthorPost = {
  id: string
  username: string
  nickname: string
  avatarLarger: string
  avatarThumb: string
  avatarMedium: string
  signature: string
  verified: boolean
  openFavorite: boolean
  privateAccount: boolean
  isADVirtual: boolean
  isEmbedBanned: boolean
}

export type VideoPost = {
  id: string
  format: string
  ratio: string
  cover: string
  originCover: string
  dynamicCover: string
  playAddr: string
  downloadAddr: string
}
