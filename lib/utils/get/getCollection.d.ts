import { TiktokCollectionResponse } from "../../types/get/getCollection";
export declare const getCollection: (collectionId: string, proxy?: string, page?: number, count?: number) => Promise<TiktokCollectionResponse>;
