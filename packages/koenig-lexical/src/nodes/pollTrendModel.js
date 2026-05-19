// 图表用到的固定调色板. 第 N 个选项配第 N 种颜色, 一共 10 种, 视觉上彼此可区分.
// 选项超过 10 个时, 会用 getOverflowColor 基于 option.id 哈希生成色相,
// 并保证生成色和这 10 种固定色 (以及彼此之间) 的色相距离 >= 阈值.
export const TREND_PALETTE = [
    "#FF5FD2", // pink
    "#4CE063", // green
    "#F2BE00", // yellow
    "#5BC8FF", // sky blue
    "#C084FC", // purple
    "#FF8C42", // orange
    "#FF5C5C", // red / coral
    "#2DD4BF", // teal
    "#4F8AFF", // blue
    "#A3E635", // lime
];

const PALETTE_MIN_HUE_DISTANCE = 22;   // 生成色相必须离每个固定色色相 >= 这个度数
const OVERFLOW_MIN_HUE_DISTANCE = 18;  // 生成色相必须离已生成的溢出色 >= 这个度数

const DEFAULT_WINDOW_HOURS = 24;       // 缺少生命周期时间时, 退化到最近 24 小时
const DEFAULT_DISPLAY_BUCKETS = 7;     // 图表上最终显示 7 个 bucket, 视觉密度合适

// ---- 颜色辅助 ----

function hexToHue(hex) {
    const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!match) {
        return 0;
    }
    const r = parseInt(match[1], 16) / 255;
    const g = parseInt(match[2], 16) / 255;
    const b = parseInt(match[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) {
        return 0;
    }
    let hue;
    if (max === r) {
        hue = ((g - b) / delta) % 6;
    } else if (max === g) {
        hue = (b - r) / delta + 2;
    } else {
        hue = (r - g) / delta + 4;
    }
    hue *= 60;
    return hue < 0 ? hue + 360 : hue;
}

const PALETTE_HUES = TREND_PALETTE.map(hexToHue);

// 计算两个色相之间的最短距离 (色相是环形, 0 和 359 实际只差 1°)
function hueDistance(a, b) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
}

// 基于字符串做一个稳定的 32-bit 哈希, 同一个 option.id 永远落到同一个起始色相,
// 这样不同次渲染颜色不会闪.
function hashStringToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // 强制 32-bit
    }
    return Math.abs(hash) % 360;
}

/**
 * 为「超过 10 个选项」时的溢出选项生成一个色相, 保证:
 *   - 离 TREND_PALETTE 里任意一种固定色都 >= PALETTE_MIN_HUE_DISTANCE 度
 *   - 离已生成的溢出色 >= OVERFLOW_MIN_HUE_DISTANCE 度
 * usedHues: 调用方传入的可变数组, 用来记录本次渲染中已经用掉的色相.
 */
export function getOverflowColor(optionId, usedHues) {
    let hue = hashStringToHue(optionId || "");
    let attempts = 0;
    while (attempts < 36) {
        const conflictsWithPalette = PALETTE_HUES.some(
            (paletteHue) => hueDistance(hue, paletteHue) < PALETTE_MIN_HUE_DISTANCE,
        );
        const conflictsWithUsed = usedHues.some(
            (usedHue) => hueDistance(hue, usedHue) < OVERFLOW_MIN_HUE_DISTANCE,
        );
        if (!conflictsWithPalette && !conflictsWithUsed) {
            break;
        }
        // 13° 偏移, 与 360 互质, 36 次能覆盖整圈
        hue = (hue + 13) % 360;
        attempts += 1;
    }
    usedHues.push(hue);
    return `hsl(${Math.round(hue)}, 72%, 62%)`;
}

function resolveWindowBoundary(value) {
    const milliseconds = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(milliseconds) ? milliseconds : null;
}

/**
 * 计算 trends 接口的查询窗口.
 * - from: 优先 publishedAt, 再退化到 createdAt
 * - to:   没到期 / 没设结束时间时用现在; 已到期则用 expiresAt
 * - 若开始时间缺失, 再退化到最近 24 小时, 保证 from 始终合法
 */
export function buildTrendsQueryWindow({
    createdAt,
    expiresAt,
    publishedAt,
    windowHours = DEFAULT_WINDOW_HOURS
} = {}) {
    const nowMs = Date.now();
    const expiresMs = resolveWindowBoundary(expiresAt);
    const publishedMs = resolveWindowBoundary(publishedAt);
    const createdMs = resolveWindowBoundary(createdAt);
    const toMs = expiresMs && expiresMs <= nowMs ? expiresMs : nowMs;
    const fallbackFromMs = toMs - windowHours * 60 * 60 * 1000;
    const candidateFromMs = publishedMs || createdMs || fallbackFromMs;
    const fromMs = candidateFromMs < toMs ? candidateFromMs : fallbackFromMs;

    return {
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
    };
}

// 把 N 个原始点均匀采样到 targetCount 个 (保证首尾, 中间等步长取最近邻)
function sampleEvenly(items, targetCount) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    if (items.length <= targetCount) {
        return items.slice();
    }
    const step = (items.length - 1) / (targetCount - 1);
    const out = [];
    for (let i = 0; i < targetCount; i += 1) {
        out.push(items[Math.round(i * step)]);
    }
    return out;
}

function formatBucketLabel(date) {
    return `${date.getMonth() + 1}.${date.getDate()}`;
}

function formatBucketDetail(date) {
    // 24 小时数字 + AM/PM 标签 (按 12 时分割), 例: 17:13 PM / 09:05 AM / 00:42 AM
    const rawHours = date.getHours();
    const hours = rawHours.toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = rawHours < 12 ? "AM" : "PM";
    return `${hours}:${minutes} ${ampm}`;
}

/**
 * 把 GET /admin/polls/:id/trends 的响应映射成 PollTrendChart 用的 trendModel.
 *
 * @param  {object}   response               接口返回 ({points, resolution, from, to, ...})
 * @param  {array}    options                poll 自带的 options [{id, text}, ...]
 * @param  {object}   [opts]
 * @param  {number}   [opts.targetBuckets]   最终展示多少个 bucket (默认 7)
 * @return {object|null}                     trendModel; 数据不足时返回 null, 调用方回退到 mock
 */
export function mapTrendsResponseToModel(response, options, {targetBuckets = DEFAULT_DISPLAY_BUCKETS} = {}) {
    const points = Array.isArray(response?.points) ? response.points : [];
    if (points.length === 0 || !Array.isArray(options) || options.length === 0) {
        return null;
    }

    const sampled = sampleEvenly(points, targetBuckets);

    const buckets = sampled.map((point) => {
        const date = new Date(point.time);
        return {
            key: point.time,
            label: formatBucketLabel(date),
            detail: formatBucketDetail(date),
            // 真实数据没有「未来」概念, 全部置 false (图表会全段彩色)
            isFuture: false,
        };
    });

    // 前 10 个选项命中 TREND_PALETTE; 超过 10 的部分用 getOverflowColor 哈希生成,
    // overflowHues 在 series.map 内被传递累积, 保证同一次渲染里溢出色之间也错开.
    const overflowHues = [];
    const series = options.map((option, index) => {
        const color = index < TREND_PALETTE.length
            ? TREND_PALETTE[index]
            : getOverflowColor(option.id, overflowHues);
        const rates = sampled.map((point) => {
            const matched = point.options?.find((entry) => entry.id === option.id);
            return Number(matched?.vote_rate || 0);
        });
        return {
            optionId: option.id,
            text: option.text,
            color,
            rates,
        };
    });

    const responseToMs = response?.to ? new Date(response.to).getTime() : NaN;
    const lastBucketMs = buckets.length > 0 ? new Date(buckets[buckets.length - 1].key).getTime() : NaN;
    const windowEndKey = Number.isFinite(responseToMs) && Number.isFinite(lastBucketMs) && responseToMs > lastBucketMs
        ? new Date(responseToMs).toISOString()
        : null;

    return {
        buckets,
        series,
        // 活跃点默认停在最近一个 bucket
        activeIndex: buckets.length - 1,
        windowEndKey,
    };
}
