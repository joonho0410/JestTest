import refreshToken from './refresh'

// 1초 딜레이를 가지고 성공 / 실패하는 리퀘스트 생성
function mockDelayedSuccess(response: Response, delay: number = 1000): jest.Mock {
    return jest.fn(() => new Promise((resolve) => {
        setTimeout(() => resolve(response), delay);
    }));
}

function mockDelayedFailure(error: any, delay: number = 1000): jest.Mock {
    return jest.fn(() => new Promise((_, reject) => {
        setTimeout(() => reject(error), delay);
    }));
}

// 성공과 실패경우 Response 생성
function makeSuccessResponse(requestNumber: number) {
    return new Response(JSON.stringify({ data: requestNumber }), { status: 200 });
}

function makeFailedResponse(errorNumber: number) {
    return new Response(null, { status: 200 + errorNumber });
}

// 실제 테스트 코드 
describe('refreshToken', () => {
    let successRefreshRequest: jest.Mock;
    let failedResponse: Response;
    let successResponse: Response;

    beforeEach(() => {
        successRefreshRequest = jest.fn();
        failedResponse = new Response(null, { status: 401 }); // 예: 만료된 응답
        successResponse = new Response(JSON.stringify({ data: 'success' }), { status: 200 });
    });

    it('✅ 하나의 요청이 실패하고 refresh 함수를 실행시켰을 때', async () => {
        // refresh 요청이 성공했을 때.
        successRefreshRequest.mockResolvedValueOnce(successResponse);

        const promise = refreshToken(successRefreshRequest, failedResponse, 'GET', '/test');

        const res = await promise;
        expect(res.status).toBe(200);
    });

    it('✅ 여러개의 요청이 실패하고, 내부 대기열 queue에 쌓여서 처리에 성공하는 경우', async () => {
        const delayedSuccessRequest = mockDelayedSuccess(successResponse) // 1초의 딜레이를 가지고 성공하는 함수.
        const afterRequests = [0, 1, 2].map((reqNum) => jest.fn().mockResolvedValueOnce(makeSuccessResponse(reqNum))) // 성공응답으로 reqNum을 반환하는 펜딩되는 요청들

        const firstCall = refreshToken(delayedSuccessRequest, failedResponse, 'GET', '/test'); // 첫 refresh 요청을 가정. 1초 후 성공
        const afterCalls = afterRequests.map((req) => refreshToken(req, failedResponse, 'Get', '/test')) // 펜딩에 쌓이는 요청들 0, 1, 2 (reqNum)을 반환값으로 가지고있음.

        const results = await Promise.all([...afterCalls]);
        
        // 첫 요청과 펜딩된 결과들 비교.
        expect(await firstCall).toEqual(successResponse)
        for (let i = 0; i < results.length; ++i) {
            const data = await results[i].json();
            expect(data).toEqual({ data : i })
        }
    });

    it('✅ 여러개의 요청이 실패하고, 내부 대기열 queue에 쌓여서 처리에 실패하는 경우', async () => {
        const delayedFailedRequest = mockDelayedFailure(failedResponse) // 1초의 딜레이를 가지고 실패하는 함수.
        const afterResponse = [0, 1, 2].map((idx) => makeFailedResponse(idx)) // 각각 실패한 경우로 201, 202, 203 을 response를 갖고있음
        const failedRequest = jest.fn().mockImplementation(() => makeFailedResponse) // 항상 실패하는 함수
        
        const firstCall = refreshToken(delayedFailedRequest, failedResponse, 'Get', '/Test') // 첫 refresh 요청을 가정. 1초 후 실패
        const afterCalls = afterResponse.map((res) => refreshToken(failedRequest, res, 'Get', '/test')) // 펜딩에 쌓이는 요청들 201, 202, 203 을 실패에러로 가진 결과들

        const results = await Promise.all([...afterCalls])

        // 첫 요청과 펜딩된 결과들 비교.
        expect(await firstCall).toEqual(failedResponse)
        for (let i = 0; i < results.length; ++i) {
            expect(results[i].status).toEqual(200 + i)
        }
    });
});
