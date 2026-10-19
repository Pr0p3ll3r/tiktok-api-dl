export interface PostStats {
    id: string;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    playCount: number;
    downloadCount: number;
    collectCount: number;
}
export interface TiktokGetStatsResponse {
    status: "success" | "error";
    message?: string;
    result?: PostStats[];
}
