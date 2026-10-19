import { TiktokPlaylistResponse } from "../../types/get/getPlaylist";
export declare const getPlaylist: (playlistId: string, proxy?: string, page?: number, count?: number) => Promise<TiktokPlaylistResponse>;
