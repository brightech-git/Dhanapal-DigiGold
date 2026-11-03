// apiClient.ts
import { axiosInstance } from "./axiosInstance";
import { withTimeout, REQUEST_TIMEOUT_MS, TIMEOUT_MSG, NETWORK_MSG } from "../utils/withTimeout";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface ApiOptions<T> {
    method: HttpMethod;
    url: string;
    data?: T;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    isFormData?: boolean;
}

export interface ApiError {
    status: "error";
    message: string;
    errors?: any;
    statusCode?: number;
}

export const callApi = async <T, R>({
    method,
    url,
    data,
    params,
    headers = {},
    isFormData = false,
}: ApiOptions<T>): Promise<R> => {
    try {

       
        // Hard 30s cap (covers interceptors too) so Login / MPIN loaders can never spin forever
        const response = await withTimeout(
            axiosInstance.request<R>({
                method,
                url,
                params,
                data,
                timeout: REQUEST_TIMEOUT_MS,
                headers: {
                    ...headers,
                    ...(isFormData ? { "Content-Type": "multipart/form-data" } : {}),
                },
            }),
            REQUEST_TIMEOUT_MS + 1000,
        );

        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log(`✅ API SUCCESS [${method.toUpperCase()}] ${url}`);
        // console.log('📦 Request    :', JSON.stringify(data ?? params ?? null, null, 2));
        // console.log('📨 Response   :', JSON.stringify(response.data, null, 2));
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if ((response.data as any)?.status === 'error') {
            throw {
                status: 'error',
                message: (response.data as any).message ?? 'Something went wrong',
                errors: (response.data as any).errors,
                statusCode: response.status,
            } as ApiError;
        }

        return response.data;
    } catch (error: any) {
        const status   = error?.response?.status;
        const resData  = error?.response?.data;

        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log(`❌ API FAILED [${method.toUpperCase()}] ${url}`);
        // console.log('📌 Status     :', status ?? 'No response');
        // console.log('📦 Request    :', JSON.stringify(data ?? params ?? null, null, 2));
        // console.log('📨 Response   :', JSON.stringify(resData, null, 2));
        // console.log('💬 Message    :', resData?.message ?? resData ?? error?.message ?? 'Unknown error');
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const isTimeout = error?.isTimeout || error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT';
        const isNetwork = !error?.response && error?.message === 'Network Error';

        throw {
            status: 'error',
            message:
                (isTimeout ? TIMEOUT_MSG : null) ||
                (isNetwork ? NETWORK_MSG : null) ||
                resData?.message ||
                resData?.error   ||
                (typeof resData === 'string' ? resData : null) ||
                error?.message   ||
                'Something went wrong',
            errors:     resData?.errors,
            statusCode: status,
        } as ApiError;
    }
};
