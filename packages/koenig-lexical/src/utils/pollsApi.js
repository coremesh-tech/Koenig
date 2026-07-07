// 同源走 Ghost admin API 代理层, 由 Ghost 服务端转发到 prediction markets 的 /market-topic.
// 外部环境如果需要直连, 仍然可以通过 cardConfig.pollsApi.baseUrl 或 VITE_POLL_API_BASE_URL 覆盖.
const DEFAULT_POLLS_API_BASE_URL = '/ghost/api/admin/polls_mixin';
// const DEFAULT_POLLS_API_BASE_URL = 'http://localhost:3000/market-topic';

function stripTrailingSlash(url = '') {
    return url.replace(/\/+$/, '');
}

function resolvePollsApiConfig(cardConfig = {}) {
    return cardConfig.pollsApi || cardConfig.polls || {};
}

function resolveBaseUrl(cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    return stripTrailingSlash(config.baseUrl || import.meta.env?.VITE_POLL_API_BASE_URL || DEFAULT_POLLS_API_BASE_URL);
}

function unwrapGhostPollsMixinPayload(payload) {
    if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'polls_mixin')) {
        return payload;
    }

    const wrappedPayload = payload.polls_mixin;

    if (Array.isArray(wrappedPayload)) {
        return wrappedPayload[0] ?? null;
    }

    return wrappedPayload;
}

async function resolveHeaders(cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    const dynamicHeaders = typeof config.getHeaders === 'function' ? await config.getHeaders() : {};

    return {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
        ...(dynamicHeaders || {})
    };
}

async function request(path, {method = 'GET', body, cardConfig} = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    const response = await fetch(`${resolveBaseUrl(cardConfig)}${path}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: await resolveHeaders(cardConfig),
        credentials: config.credentials || 'include',
        mode: config.mode || 'cors'
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message = payload?.error?.message || `Poll API request failed with status ${response.status}`;
        throw new Error(message);
    }

    return unwrapGhostPollsMixinPayload(payload);
}

export async function saveAdminPoll(payload, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.savePoll === 'function') {
        return config.savePoll(payload);
    }

    return request('/admin/polls', {
        method: 'POST',
        body: payload,
        cardConfig
    });
}

export async function getAdminPoll(pollId, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.getPoll === 'function') {
        return config.getPoll(pollId);
    }

    return request(`/admin/polls/${pollId}`, {cardConfig});
}

export async function getAdminPollTrends(pollId, params = {}, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.getPollTrends === 'function') {
        return config.getPollTrends(pollId, params);
    }

    const search = new URLSearchParams();
    if (params.from) {
        search.set('from', params.from);
    }
    if (params.to) {
        search.set('to', params.to);
    }
    if (params.resolution) {
        search.set('resolution', params.resolution);
    }
    const query = search.toString() ? `?${search.toString()}` : '';

    return request(`/admin/polls/${pollId}/trends${query}`, {cardConfig});
}

export async function getAdminPollVotes(pollId, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.getPollVotes === 'function') {
        return config.getPollVotes(pollId);
    }

    return request(`/admin/polls/${pollId}/votes`, {cardConfig});
}

export async function publishAdminPoll(pollId, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.publishPoll === 'function') {
        return config.publishPoll(pollId);
    }

    return request(`/admin/polls/${pollId}/publish`, {
        method: 'POST',
        cardConfig
    });
}

export async function publishAdminPollResults(pollId, {correctOptionIds = []} = {}, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.publishPollResults === 'function') {
        return config.publishPollResults(pollId, {correctOptionIds});
    }

    return request(`/admin/polls/${pollId}/reveal-answer`, {
        method: 'POST',
        body: {correct_option_ids: correctOptionIds},
        cardConfig
    });
}

export async function unpublishAdminPoll(pollId, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.unpublishPoll === 'function') {
        return config.unpublishPoll(pollId);
    }

    return request(`/admin/polls/${pollId}/unpublish`, {
        method: 'POST',
        cardConfig
    });
}

export async function pauseAdminPollVoting(pollId, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.pausePollVoting === 'function') {
        return config.pausePollVoting(pollId);
    }

    return request(`/admin/polls/${pollId}/pause`, {
        method: 'POST',
        cardConfig
    });
}

export async function resumeAdminPollVoting(pollId, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.resumePollVoting === 'function') {
        return config.resumePollVoting(pollId);
    }

    return request(`/admin/polls/${pollId}/resume`, {
        method: 'POST',
        cardConfig
    });
}

export async function deleteAdminPoll(pollId, cardConfig = {}) {
    const config = resolvePollsApiConfig(cardConfig);
    if (typeof config.deletePoll === 'function') {
        return config.deletePoll(pollId);
    }

    return request(`/admin/polls/${pollId}`, {
        method: 'DELETE',
        cardConfig
    });
}
