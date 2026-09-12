import type { StandardApiResponseContract } from "./common";
export interface GetHealth200ResponseContract extends StandardApiResponseContract {
    data?: {
        status?: string;
    };
}
