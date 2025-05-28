let isRetrying = false;
let pendingQueue: ((isSuccess : boolean) => any)[] = []

async function refreshToken(request: (...args: any[]) => Promise<Response>, originalRes: Response, method: string, url: string, config?: RequestInit, form: boolean = false): Promise<Response> {
    if (isRetrying) {
        return new Promise((resolve, reject) => {
            pendingQueue.push((isSuccess: boolean) => {
                    if (!isSuccess) return resolve(originalRes);
                    else { 
                        request(method, url, config, form, true)
                        .then((res) => resolve(res))
                        .catch((error) => reject(error))
                    }
                }
            )
        }) 
    }

    isRetrying = true
    try {
        // const res = await userService.extendLogin('refreshToken') // 실제 refreshToken 사용 필요
        return await request(method, url, config, form, true);

    } catch {
        pendingQueue.forEach((pendingFn) => pendingFn(false))
        pendingQueue = []
        return originalRes;
    }
    
    finally {
        isRetrying = false
        if (pendingQueue.length > 0) {
            pendingQueue.forEach((pendingFn)=> pendingFn(true))
        }
        pendingQueue = []
    }
}

export default refreshToken