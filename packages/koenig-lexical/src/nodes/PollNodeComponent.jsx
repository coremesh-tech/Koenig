import AddIcon from "../assets/icons/kg-add.svg?react";
import CardContext from "../context/CardContext";
import CloseIcon from "../assets/icons/kg-close.svg?react";
import DeleteIcon from "../assets/icons/delete-bin-4-line.svg?react";
import EditIcon from "../assets/icons/edit-line.svg?react";
import ErifiedBadgeLineIcon from "../assets/icons/verified-badge-line.svg?react";
import KoenigComposerContext from "../context/KoenigComposerContext";
import React from "react";
import { $getNodeByKey } from "lexical";
import {
    DELETE_CARD_COMMAND,
    EDIT_CARD_COMMAND,
    SELECT_CARD_COMMAND,
} from "../plugins/KoenigBehaviourPlugin";
import {
    deleteAdminPoll,
    getAdminPoll,
    getAdminPollTrends,
    getAdminPollVotes,
    publishAdminPoll,
    publishAdminPollResults,
    saveAdminPoll,
    unpublishAdminPoll,
} from "../utils/pollsApi.js";
import { PollPublishResultsDialog } from "./PollPublishResultsDialog";
import { buildTrendsQueryWindow, mapTrendsResponseToModel } from "./pollTrendModel";
import { openFileSelection } from "../utils/openFileSelection.js";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

function createOptionId() {
    const uuid =
        globalThis.crypto?.randomUUID?.() ||
        Math.random().toString(36).slice(2, 10);
    return `opt_${uuid.replace(/-/g, "").slice(0, 8)}`;
}

function formatVoteRate(value) {
    return `${Number(value || 0).toFixed(2)}%`;
}

function formatVoteCount(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function toDateTimeLocalValue(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
}

function toApiDateTime(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

function formatDisplayDate(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toISOString().slice(0, 10);
}

function getMinimumEndDate() {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function isExpired(value) {
    if (!value) {
        return false;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return false;
    }

    return date.getTime() <= Date.now();
}

function buildOptionVoteMap(results = []) {
    return new Map(results.map((option) => [option.id, option]));
}

function ClockIcon(props) {
    return (
        <svg fill="none" viewBox="0 0 16 16" {...props}>
            <circle
                cx="8"
                cy="8"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.4"
            />
            <path
                d="M8 5v3.2l2 1.2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.4"
            />
        </svg>
    );
}

function DotsIcon(props) {
    return (
        <svg fill="currentColor" viewBox="0 0 16 16" {...props}>
            <circle cx="3" cy="8" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="13" cy="8" r="1.2" />
        </svg>
    );
}

function PublishResultsIcon(props) {
    return (
        <svg fill="none" viewBox="0 0 16 16" {...props}>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
            <path
                d="M5.4 8 L7.2 9.8 L10.7 6.3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.4"
            />
        </svg>
    );
}

function PollPreviewOption({
    answerRevealed,
    option,
    selectedOptionIds,
    totalVotes,
}) {
    const isCorrect =
        answerRevealed && selectedOptionIds.correct.has(option.id);
    const isSelected = selectedOptionIds.selected.has(option.id);
    const voteRate = option.voteRate || 0;
    const fillWidth = `${Math.max(0, Math.min(voteRate, 100))}%`;

    // 揭晓后走附件里的极简样式: 文本 + 内联 Result 徽标 + 底部细进度条
    if (answerRevealed) {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[1.85rem] font-semibold leading-none text-white">
                        <span>{option.text}</span>
                        {isCorrect && (
                            <span className="rounded-md bg-[#22C55E] px-2 py-1 text-[1.2rem] font-semibold leading-none text-white">
                                Result
                            </span>
                        )}
                    </div>
                    <span className="text-[1.8rem] font-semibold text-white">
                        {formatVoteRate(voteRate)}
                    </span>
                </div>
                <div className="relative h-[6px] w-full overflow-hidden rounded-full bg-white/8">
                    <div
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-0 rounded-full ${isCorrect ? "bg-[#22C55E]" : "bg-white/15"}`}
                        style={{ width: fillWidth }}
                    />
                </div>
            </div>
        );
    }

    // 未揭晓: 保留原本的圆角卡片 + 内填充样式
    const showFill = totalVotes > 0 && voteRate > 0;
    const fillClassName = isSelected
        ? "bg-[rgba(255,255,255,0.12)]"
        : "";

    return (
        <div className="relative overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.2)] bg-transparent">
            {showFill && (
                <div
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 rounded-[11px] ${fillClassName}`}
                    style={{ width: fillWidth }}
                />
            )}
            <div className="relative z-[1] flex items-center justify-between gap-4 px-5 py-4">
                <div
                    className={`inline-flex items-center rounded-[12px] text-[1.85rem] font-semibold leading-none ${isSelected ? "bg-white/12" : ""}`}
                >
                    {option.text}
                </div>
                <div className="flex items-center gap-3 text-[1.8rem] font-semibold">
                    <span>{formatVoteRate(voteRate)}</span>
                </div>
            </div>
        </div>
    );
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// ---------------- Mock trend chart data ----------------
// 图表使用的是独立 mock 数据，与上方选项列表 (option.voteRate / totalVotes) 完全脱钩。
// 选项列表始终展示真实投票数据，图表展示一个固定的时间序列示意。
//
// 横轴 7 个时间点: 4.30 / 5.1 / 5.2 / 5.3 (当前) / 5.4 / 5.6 / 5.8
// MOCK_ACTIVE_INDEX = 3 表示「当前」落在 5.3 这一列。
const MOCK_BUCKET_DATES = [
    {month: 4, day: 30, hour: 18},
    {month: 5, day: 1,  hour: 9},
    {month: 5, day: 2,  hour: 21},
    {month: 5, day: 3,  hour: 5},   // 当前 = "5 AM"
    {month: 5, day: 4,  hour: 5},
    {month: 5, day: 6,  hour: 5},
    {month: 5, day: 8,  hour: 5},
];

const MOCK_ACTIVE_INDEX = 3;

const MOCK_SERIES_TEMPLATES = [
    {color: "#FF5FD2", rates: [52.40, 49.80, 53.30, 56.12, 58.20, 60.10, 61.50]}, // Yes 粉红
    {color: "#4CE063", rates: [44.20, 47.10, 44.80, 43.00, 39.50, 36.20, 34.30]}, // No  绿
    {color: "#F2BE00", rates: [3.40, 3.10, 1.90, 3.88, 2.30, 3.70, 4.20]},        // Other 黄
    {color: "#5BC8FF", rates: [2.80, 2.40, 2.10, 1.80, 1.60, 1.40, 1.30]},        // 备用
    {color: "#C084FC", rates: [1.60, 1.40, 1.20, 1.10, 1.00, 0.90, 0.80]},        // 备用
];

function buildMockTrendModel(options) {
    const buckets = MOCK_BUCKET_DATES.map((date, index) => ({
        key: `mock-${date.month}-${date.day}`,
        label: `${date.month}.${date.day}`,
        detail: `${date.hour < 12 ? date.hour : date.hour - 12 || 12} ${date.hour < 12 ? "AM" : "PM"}`,
        isFuture: index > MOCK_ACTIVE_INDEX,
    }));

    const series = (options || []).map((option, optionIndex) => {
        const template = MOCK_SERIES_TEMPLATES[optionIndex] || MOCK_SERIES_TEMPLATES[MOCK_SERIES_TEMPLATES.length - 1];
        return {
            optionId: option.id,
            text: option.text,
            color: template.color,
            rates: template.rates.slice(),
        };
    });

    return {
        buckets,
        series,
        activeIndex: MOCK_ACTIVE_INDEX,
    };
}

function createSmoothPath(points) {
    if (points.length === 0) {
        return "";
    }

    if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let index = 1; index < points.length; index += 1) {
        const previousPoint = points[index - 1];
        const currentPoint = points[index];
        const controlPointX = previousPoint.x + (currentPoint.x - previousPoint.x) / 2;

        path += ` C ${controlPointX} ${previousPoint.y}, ${controlPointX} ${currentPoint.y}, ${currentPoint.x} ${currentPoint.y}`;
    }

    return path;
}

function PollTrendChart({
    activeIndex,
    onActivateIndex,
    trendModel,
}) {
    // ---- 内部留白常量 (相对 SVG 像素) ----
    const topPadding = 24;       // 顶部 "5 AM" 时间标签
    const bottomPadding = 36;    // 底部 bucket 日期标签 + 间距
    const labelGutter = 12;      // 右侧给随圆点的百分比标签留点空间

    const containerRef = React.useRef(null);
    const svgRef = React.useRef(null);
    const [hoverX, setHoverX] = React.useState(null);    // null = 没在 hover, 落在默认位
    const [mounted, setMounted] = React.useState(false); // 首次绘入动画
    // 用 ResizeObserver 测量 SVG 容器实际尺寸, 让 viewBox / plot 区域跟着选项列高度走
    const [dims, setDims] = React.useState({width: 348, height: 200});

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const {width, height} = entry.contentRect;
                if (width > 0 && height > 0) {
                    setDims({width, height});
                }
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const viewBoxWidth = dims.width;
    const viewBoxHeight = dims.height;
    const plotWidth = Math.max(80, viewBoxWidth - labelGutter);
    const plotHeight = Math.max(60, viewBoxHeight - topPadding - bottomPadding);

    const maxRate = Math.max(
        100,
        ...trendModel.series.flatMap(series => series.rates),
    );
    const bucketCount = trendModel.buckets.length;
    const xStep = bucketCount > 1 ? plotWidth / (bucketCount - 1) : 0;

    // hover 时 activeFraction 跟随鼠标连续变化, 否则回落到 activeIndex (默认 5.3)
    const activeFraction = hoverX !== null && xStep > 0
        ? clamp(hoverX / xStep, 0, bucketCount - 1)
        : clamp(activeIndex, 0, Math.max(bucketCount - 1, 0));
    // 用最近的 bucket 来分「过去/未来」线段和顶部时间标签
    const nearestActiveIndex = Math.round(activeFraction);
    const activeBucket = trendModel.buckets[nearestActiveIndex];
    const activeX = activeFraction * xStep;
    const isHovering = hoverX !== null;

    React.useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const handleMouseMove = (event) => {
        const svgEl = svgRef.current;
        if (!svgEl) {
            return;
        }
        const rect = svgEl.getBoundingClientRect();
        if (rect.width <= 0) {
            return;
        }
        const x = ((event.clientX - rect.left) / rect.width) * viewBoxWidth;
        setHoverX(clamp(x, 0, plotWidth));
    };

    const handleMouseLeave = () => {
        setHoverX(null);
    };

    // hover 期间持续把最近 bucket 同步给父组件 (可选, 当前父端没消费, 但保留接口)
    React.useEffect(() => {
        if (hoverX === null || typeof onActivateIndex !== 'function') {
            return;
        }
        onActivateIndex(nearestActiveIndex);
    }, [hoverX, nearestActiveIndex, onActivateIndex]);

    const pointsBySeries = trendModel.series.map((series) => {
        return series.rates.map((rate, index) => ({
            x: index * xStep,
            y: plotHeight - (rate / maxRate) * (plotHeight - 18),
        }));
    });

    // 按最近 bucket 切分过去 / 未来线段
    const splitPointsBySeries = pointsBySeries.map((points) => ({
        pastPoints: points.slice(0, nearestActiveIndex + 1),
        futurePoints: points.slice(nearestActiveIndex),
    }));

    // 在 activeFraction 位置, 对每个 series 做线性插值, 得到当前 y 和当前百分比
    const activePositionForSeries = (seriesIndex) => {
        const rates = trendModel.series[seriesIndex].rates;
        const lower = Math.floor(activeFraction);
        const upper = Math.min(lower + 1, rates.length - 1);
        const t = activeFraction - lower;
        const r = rates[lower] + (rates[upper] - rates[lower]) * t;
        const y = plotHeight - (r / maxRate) * (plotHeight - 18);
        return {x: activeX, y, rate: r};
    };

    // hover 时给「快」的过渡 (跟手), 离开时给「慢」的过渡 (优雅回弹)
    const fastTransition = 'transform 0.08s linear';
    const restTransition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    const followTransition = isHovering ? fastTransition : restTransition;

    return (
        <div className="flex h-full flex-col rounded-[12px]">
            <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                {trendModel.series.map((series) => (
                    <div key={series.optionId} className="flex items-center gap-2 text-[1.5rem] leading-none text-white/90">
                        <span className="size-[0.9rem] rounded-full" style={{backgroundColor: series.color}} />
                        <span>{series.text}</span>
                    </div>
                ))}
            </div>

            {/* SVG 容器: flex-1 + min-h-0 让它在 flex-col 里精确吃掉剩余空间; ResizeObserver 测它的实际像素 */}
            <div ref={containerRef} className="relative min-h-0 flex-1">
                <svg
                    ref={svgRef}
                    className="absolute inset-0 h-full w-full overflow-visible"
                    preserveAspectRatio="none"
                    viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                    onMouseLeave={handleMouseLeave}
                    onMouseMove={handleMouseMove}
                >
                    {/* 持续脉冲的 halo 动画 (r 从 5 → 16, opacity 从 0.55 → 0, 无限循环) */}
                    <style>{`
                        @keyframes poll-trend-dot-pulse {
                            0%   { r: 5;  opacity: 0.55; }
                            70%  { r: 16; opacity: 0;    }
                            100% { r: 16; opacity: 0;    }
                        }
                    `}</style>

                    <g transform={`translate(0 ${topPadding})`}>
                        {/* 整片可交互的透明覆盖层, 用来接收 mousemove */}
                        <rect
                            fill="transparent"
                            height={plotHeight + 40}
                            width={plotWidth}
                            x={0}
                            y={-topPadding}
                        />

                        {/* 竖向 crosshair (跟随 hover) */}
                        <g
                            style={{
                                transform: `translateX(${activeX}px)`,
                                transition: followTransition,
                            }}
                        >
                            <line
                                stroke="rgba(255,255,255,0.22)"
                                strokeWidth="1"
                                x1={0}
                                x2={0}
                                y1={-10}
                                y2={plotHeight + 18}
                            />
                            {activeBucket?.detail && (
                                <text
                                    fill="rgba(255,255,255,0.88)"
                                    fontSize="11"
                                    fontWeight="500"
                                    textAnchor="start"
                                    x={6}
                                    y={-12}
                                >
                                    {activeBucket.detail}
                                </text>
                            )}
                        </g>

                        {/* 第一层: 所有线. 使用 pathLength=100 + dashoffset 实现首次绘入 */}
                        {trendModel.series.map((series, seriesIndex) => {
                            const {pastPoints, futurePoints} = splitPointsBySeries[seriesIndex];
                            return (
                                <g key={`lines-${series.optionId}`}>
                                    <path
                                        d={createSmoothPath(pastPoints)}
                                        fill="none"
                                        pathLength="100"
                                        stroke={series.color}
                                        strokeDasharray="100"
                                        strokeDashoffset={mounted ? 0 : 100}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2.6"
                                        style={{transition: `stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1) ${seriesIndex * 0.08}s`}}
                                    />
                                    {futurePoints.length > 1 && (
                                        <path
                                            d={createSmoothPath(futurePoints)}
                                            fill="none"
                                            opacity={mounted ? 1 : 0}
                                            stroke="rgba(255,255,255,0.22)"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            style={{transition: `opacity 0.6s ease-out ${0.8 + seriesIndex * 0.05}s`}}
                                        />
                                    )}
                                </g>
                            );
                        })}

                        {/* 第二层: 激活圆点 (脉冲 halo + 实心点) - 跟着 hover 在线上滑 */}
                        {trendModel.series.map((series, seriesIndex) => {
                            const {x, y} = activePositionForSeries(seriesIndex);
                            return (
                                <g
                                    key={`dot-${series.optionId}`}
                                    style={{
                                        transform: `translate(${x}px, ${y}px)`,
                                        transition: followTransition,
                                    }}
                                >
                                    {/* 持续脉冲的 halo: 三条线统一节奏, 同时呼吸 */}
                                    <circle
                                        cx={0}
                                        cy={0}
                                        fill={series.color}
                                        style={{
                                            animation: 'poll-trend-dot-pulse 1.8s ease-out infinite',
                                        }}
                                    />
                                    {/* 实心圆点 */}
                                    <circle
                                        cx={0}
                                        cy={0}
                                        fill={series.color}
                                        r="5.5"
                                        stroke="#232120"
                                        strokeWidth="2"
                                    />
                                </g>
                            );
                        })}

                        {/* 第三层: 百分比标签 (最上层 + 卡片色描边 halo) */}
                        {trendModel.series.map((series, seriesIndex) => {
                            const {x, y, rate} = activePositionForSeries(seriesIndex);
                            const flipLabelToLeft = x > plotWidth - 70;
                            const labelOffsetX = flipLabelToLeft ? -10 : 10;
                            const labelY = clamp(y + 4, 12, plotHeight - 4);
                            return (
                                <g
                                    key={`label-${series.optionId}`}
                                    style={{
                                        transform: `translate(${x + labelOffsetX}px, ${labelY}px)`,
                                        transition: followTransition,
                                    }}
                                >
                                    <text
                                        fill={series.color}
                                        fontSize="12"
                                        fontWeight="500"
                                        paintOrder="stroke fill"
                                        stroke="#232120"
                                        strokeLinejoin="round"
                                        strokeWidth="3"
                                        textAnchor={flipLabelToLeft ? "end" : "start"}
                                        x={0}
                                        y={0}
                                    >
                                        {formatVoteRate(rate)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* 底部 bucket 日期标签 */}
                        {trendModel.buckets.map((bucket, index) => {
                            const isActive = index === nearestActiveIndex;
                            const labelColor = isActive
                                ? "rgba(255,255,255,0.82)"
                                : bucket.isFuture
                                    ? "rgba(255,255,255,0.28)"
                                    : "rgba(255,255,255,0.5)";

                            return (
                                <text
                                    key={bucket.key}
                                    fill={labelColor}
                                    fontSize="10"
                                    style={{transition: 'fill 0.2s ease'}}
                                    textAnchor="middle"
                                    x={index * xStep}
                                    y={plotHeight + 30}
                                >
                                    {bucket.label}
                                </text>
                            );
                        })}
                    </g>
                </svg>
            </div>
        </div>
    );
}

export function PollNodeComponent({
    answerRevealed,
    correctOptionIds,
    description,
    expiresAt,
    imageSrc,
    nodeKey,
    options,
    pollId,
    pollType = "single",
    selectedOptionIds,
    status,
    title,
    totalVotes,
}) {
    const [editor] = useLexicalComposerContext();
    const { isEditing, isSelected } = React.useContext(CardContext);
    const { cardConfig, fileUploader } = React.useContext(
        KoenigComposerContext,
    );
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [apiError, setApiError] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);
    const [imagePreview, setImagePreview] = React.useState("");
    const [activeTrendIndex, setActiveTrendIndex] = React.useState(null);
    // Publish Results 弹窗
    const [publishResultsOpen, setPublishResultsOpen] = React.useState(false);
    const [publishResultsError, setPublishResultsError] = React.useState("");
    const [isPublishingResults, setIsPublishingResults] = React.useState(false);
    // 历史走势接口的原始返回; null = 还没数据 / 接口空 / 出错, 渲染层会直接不显示图表那一列
    const [trendsResponse, setTrendsResponse] = React.useState(null);
    const [draftTitle, setDraftTitle] = React.useState(title);
    const [draftDescription, setDraftDescription] = React.useState(description);
    const [draftOptions, setDraftOptions] = React.useState(() =>
        options.map((option) => option.text),
    );
    const [isEndDateInputActive, setIsEndDateInputActive] =
        React.useState(false);
    const [showMediaFields, setShowMediaFields] = React.useState(
        Boolean(description || imageSrc),
    );
    const [showEndDateField, setShowEndDateField] = React.useState(
        Boolean(expiresAt),
    );
    const menuRef = React.useRef(null);
    const imageInputRef = React.useRef(null);
    const endDateInputRef = React.useRef(null);
    const previewSyncPollIdRef = React.useRef(null);
    const imageUploader = fileUploader.useFileUpload("image") || {};
    const imageMimeTypes = fileUploader.fileTypes?.image?.mimeTypes || [
        "image/*",
    ];

    React.useEffect(() => {
        if (description || imageSrc) {
            setShowMediaFields(true);
        }
    }, [description, imageSrc]);

    React.useEffect(() => {
        if (expiresAt) {
            setShowEndDateField(true);
        }
    }, [expiresAt]);

    React.useEffect(() => {
        if (expiresAt) {
            setIsEndDateInputActive(false);
        }
    }, [expiresAt]);

    React.useEffect(() => {
        setDraftTitle(title);
    }, [title]);

    React.useEffect(() => {
        setDraftDescription(description);
    }, [description]);

    React.useEffect(() => {
        setDraftOptions(options.map((option) => option.text));
    }, [options]);

    React.useEffect(() => {
        if (!isSelected) {
            setMenuOpen(false);
        }
    }, [isSelected]);

    React.useEffect(() => {
        if (!menuOpen) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) {
                setMenuOpen(false);
            }
        };

        window.addEventListener("mousedown", handlePointerDown);
        return () => {
            window.removeEventListener("mousedown", handlePointerDown);
        };
    }, [menuOpen]);

    const updateNode = React.useCallback(
        (updater) => {
            editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if (node) {
                    updater(node);
                }
            });
        },
        [editor, nodeKey],
    );

    const syncPollData = React.useCallback(
        async (nextPollId, fallback = {}) => {
            const [pollResponse, votesResponse] = await Promise.allSettled([
                getAdminPoll(nextPollId, cardConfig),
                getAdminPollVotes(nextPollId, cardConfig),
            ]);

            const poll =
                pollResponse.status === "fulfilled"
                    ? pollResponse.value
                    : {
                          poll_id: nextPollId,
                          title: fallback.title || title,
                          description: fallback.description || description,
                          image_src: fallback.image_src || imageSrc,
                          expires_at: fallback.expires_at || expiresAt,
                          poll_type: fallback.poll_type || "single",
                          status: fallback.status || status,
                          answer_revealed:
                              fallback.answer_revealed || answerRevealed,
                          correct_option_ids:
                              fallback.correct_option_ids || correctOptionIds,
                          options: fallback.options || options,
                      };

            const votes =
                votesResponse.status === "fulfilled"
                    ? votesResponse.value
                    : {
                          total_votes: fallback.total_votes ?? totalVotes,
                          options: fallback.options || [],
                      };

            const optionVotes = buildOptionVoteMap(votes.options || []);
            const normalizedOptions = (
                poll.options ||
                fallback.options ||
                []
            ).map((option, index) => {
                const optionVote = optionVotes.get(option.id);
                return {
                    id: option.id,
                    text: option.text,
                    sortOrder: index,
                    voteCount: Number(
                        optionVote?.vote_count ??
                            option.voteCount ??
                            option.vote_count ??
                            0,
                    ),
                    voteRate: Number(
                        optionVote?.vote_rate ??
                            option.voteRate ??
                            option.vote_rate ??
                            0,
                    ),
                };
            });

            updateNode((node) => {
                node.applyPollSnapshot({
                    pollId: poll.poll_id,
                    title: poll.title,
                    description: poll.description,
                    imageSrc: poll.image_src,
                    expiresAt: poll.expires_at,
                    pollType: poll.poll_type,
                    status: poll.status || fallback.status || "draft",
                    answerRevealed: poll.answer_revealed,
                    correctOptionIds: poll.correct_option_ids || [],
                    selectedOptionIds,
                    options: normalizedOptions,
                    totalVotes: votes.total_votes ?? fallback.total_votes ?? 0,
                });
            });
        },
        [
            answerRevealed,
            cardConfig,
            correctOptionIds,
            description,
            expiresAt,
            imageSrc,
            options,
            selectedOptionIds,
            status,
            title,
            totalVotes,
            updateNode,
        ],
    );

    const handleTitleChange = (event) => {
        const nextTitle = event.target.value;
        setDraftTitle(nextTitle);

        if (!event.nativeEvent?.isComposing) {
            updateNode((node) => node.setTitle(nextTitle));
        }
    };

    const handleTitleCompositionEnd = (event) => {
        const nextTitle = event.currentTarget.value;
        setDraftTitle(nextTitle);
        updateNode((node) => node.setTitle(nextTitle));
    };

    const handleDescriptionChange = (event) => {
        const nextDescription = event.target.value;
        setDraftDescription(nextDescription);

        if (!event.nativeEvent?.isComposing) {
            updateNode((node) => node.setDescription(nextDescription));
        }
    };

    const handleDescriptionCompositionEnd = (event) => {
        const nextDescription = event.currentTarget.value;
        setDraftDescription(nextDescription);
        updateNode((node) => node.setDescription(nextDescription));
    };

    const handleExpiresAtChange = (event) => {
        updateNode((node) => node.setExpiresAt(event.target.value));
    };

    const handleActivateEndDateInput = () => {
        setIsEndDateInputActive(true);

        requestAnimationFrame(() => {
            endDateInputRef.current?.focus();
            endDateInputRef.current?.showPicker?.();
        });
    };

    const commitOptionText = React.useCallback(
        (index, value) => {
            const nextOptions = options.map((option, optionIndex) => {
                if (optionIndex !== index) {
                    return option;
                }

                return {
                    ...option,
                    text: value,
                };
            });

            updateNode((node) => node.setOptions(nextOptions));
        },
        [options, updateNode],
    );

    const handleOptionTextChange = (index, event) => {
        const nextValue = event.target.value;
        setDraftOptions((currentOptions) => {
            const nextOptions = [...currentOptions];
            nextOptions[index] = nextValue;
            return nextOptions;
        });

        if (!event.nativeEvent?.isComposing) {
            commitOptionText(index, nextValue);
        }
    };

    const handleOptionCompositionEnd = (index, event) => {
        const nextValue = event.currentTarget.value;
        setDraftOptions((currentOptions) => {
            const nextOptions = [...currentOptions];
            nextOptions[index] = nextValue;
            return nextOptions;
        });
        commitOptionText(index, nextValue);
    };

    const handleAddOption = () => {
        updateNode((node) =>
            node.setOptions([
                ...node.options,
                {
                    id: createOptionId(),
                    text: "",
                    voteCount: 0,
                    voteRate: 0,
                },
            ]),
        );
    };

    const handleRemoveOption = (index) => {
        if (options.length <= 2) {
            return;
        }

        const nextOptions = options.filter(
            (_, optionIndex) => optionIndex !== index,
        );
        updateNode((node) => node.setOptions(nextOptions));
    };

    const handleDeleteCard = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setMenuOpen(false);

        if (isSaving) {
            return;
        }

        setApiError("");

        if (pollId) {
            try {
                setIsSaving(true);
                await deleteAdminPoll(pollId, cardConfig);
            } catch (error) {
                setApiError(error.message || "Failed to delete poll");
                setIsSaving(false);
                return;
            } finally {
                setIsSaving(false);
            }
        }

        editor.dispatchCommand(DELETE_CARD_COMMAND, { cardKey: nodeKey });
    };

    const handleEditCard = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setMenuOpen(false);

        if (isSaving) {
            return;
        }

        setApiError("");

        if (pollId) {
            try {
                setIsSaving(true);
                const unpublishResponse = await unpublishAdminPoll(
                    pollId,
                    cardConfig,
                );
                updateNode((node) => {
                    node.setStatus(unpublishResponse?.status || "draft");
                });
            } catch (error) {
                setApiError(error.message || "Failed to switch poll to draft");
                setIsSaving(false);
                return;
            } finally {
                setIsSaving(false);
            }
        }

        editor.dispatchCommand(EDIT_CARD_COMMAND, {
            cardKey: nodeKey,
            focusEditor: false,
        });
    };

    const handlePublishResult = (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setMenuOpen(false);
        setPublishResultsError("");
        setPublishResultsOpen(true);
    };

    const handleClosePublishResults = () => {
        if (isPublishingResults) {
            return;
        }
        setPublishResultsOpen(false);
        setPublishResultsError("");
    };

    const handleSubmitPublishResults = async (nextCorrectOptionIds) => {
        if (!pollId) {
            setPublishResultsError("Poll has not been created yet");
            return;
        }
        if (!Array.isArray(nextCorrectOptionIds) || nextCorrectOptionIds.length === 0) {
            setPublishResultsError("Please select at least one answer");
            return;
        }

        setIsPublishingResults(true);
        setPublishResultsError("");

        try {
            await publishAdminPollResults(
                pollId,
                {correctOptionIds: nextCorrectOptionIds},
                cardConfig,
            );
            updateNode((node) => {
                node.setCorrectOptionIds(nextCorrectOptionIds);
                node.setAnswerRevealed(true);
            });
            setPublishResultsOpen(false);
        } catch (error) {
            setPublishResultsError(error.message || "Failed to publish results");
        } finally {
            setIsPublishingResults(false);
        }
    };

    const handleImageUpload = async (files) => {
        const imageFile = files?.[0];
        if (!imageFile) {
            return;
        }

        const previewUrl = URL.createObjectURL(imageFile);
        setImagePreview(previewUrl);
        setApiError("");

        try {
            if (typeof imageUploader.upload !== "function") {
                throw new Error("Image uploader is not configured");
            }

            const uploadResult = await imageUploader.upload(files);
            const uploadedImageUrl = uploadResult?.[0]?.url || "";

            if (uploadedImageUrl) {
                updateNode((node) => node.setImageSrc(uploadedImageUrl));
            }
        } catch (error) {
            setApiError(error.message || "Image upload failed");
        } finally {
            setImagePreview("");
            URL.revokeObjectURL(previewUrl);
        }
    };

    const handleImageInputChange = async (event) => {
        await handleImageUpload(event.target.files);
    };

    const handleRemoveImage = () => {
        updateNode((node) => node.setImageSrc(""));
    };

    const handleSavePoll = async () => {
        const trimmedTitle = draftTitle.trim();
        const preparedOptions = options
            .map((option, index) => ({
                id: option.id || createOptionId(),
                text: (draftOptions[index] ?? option.text ?? "").trim(),
                sort_order: index,
            }))
            .filter((option) => option.text);

        if (!trimmedTitle) {
            setApiError("Question is required");
            return;
        }

        if (preparedOptions.length < 2) {
            setApiError("At least two answer options are required");
            return;
        }

        if (expiresAt) {
            const expiresAtDate = new Date(expiresAt);
            const minimumEndDate = getMinimumEndDate();

            if (Number.isNaN(expiresAtDate.getTime())) {
                setApiError("End date is invalid");
                return;
            }

            if (expiresAtDate.getTime() < minimumEndDate.getTime()) {
                setApiError(
                    "End date must be at least one day later than the current time",
                );
                return;
            }
        }

        setApiError("");
        setIsSaving(true);

        const normalizedPollType = pollType === "multiple" ? "multiple" : "single";

        const payload = {
            ...(pollId ? { poll_id: pollId } : {}),
            title: trimmedTitle,
            description: draftDescription.trim(),
            image_src: imageSrc,
            expires_at: toApiDateTime(expiresAt),
            poll_type: normalizedPollType,
            correct_option_ids: correctOptionIds,
            options: preparedOptions,
        };

        try {
            const saveResponse = await saveAdminPoll(payload, cardConfig);
            const nextPollId = saveResponse.poll_id || pollId;
            const publishResponse = nextPollId
                ? await publishAdminPoll(nextPollId, cardConfig)
                : null;
            const nextStatus =
                publishResponse?.status || saveResponse.status || "draft";

            updateNode((node) => {
                node.applyPollSnapshot({
                    pollId: nextPollId,
                    title: trimmedTitle,
                    description: payload.description,
                    imageSrc: imageSrc,
                    expiresAt: payload.expires_at || "",
                    pollType: payload.poll_type,
                    status: nextStatus,
                    answerRevealed,
                    correctOptionIds,
                    selectedOptionIds,
                    options: preparedOptions.map((option, index) => ({
                        id: option.id,
                        text: option.text,
                        sortOrder: index,
                        voteCount: 0,
                        voteRate: 0,
                    })),
                });
            });

            if (nextPollId) {
                await syncPollData(nextPollId, {
                    ...payload,
                    status: nextStatus,
                    total_votes: totalVotes,
                });
            }

            editor.dispatchCommand(SELECT_CARD_COMMAND, { cardKey: nodeKey });
        } catch (error) {
            setApiError(error.message || "Failed to save poll");
        } finally {
            setIsSaving(false);
        }
    };

    const previewSelection = React.useMemo(
        () => ({
            correct: new Set(correctOptionIds),
            selected: new Set(selectedOptionIds),
        }),
        [correctOptionIds, selectedOptionIds],
    );

    const previewImage = imagePreview || imageSrc;
    const isCreated = Boolean(pollId);
    const isPublished = status === "published";
    const showPreview = isCreated && isPublished && !isEditing;
    const createButtonLabel = pollId ? "Update vote" : "Create vote";
    // 没设结束时间 → 直接可发布; 设了结束时间 → 必须等过期才能发布
    // 已经公布过则隐藏入口, 避免重复操作
    const canPublishResults = (!expiresAt || isExpired(expiresAt)) && !answerRevealed;
    const minEndDateValue = React.useMemo(
        () => toDateTimeLocalValue(getMinimumEndDate().toISOString()),
        [],
    );

    // 图表的趋势数据: 只用 /admin/polls/:id/trends 的真实数据.
    // 接口未返回 / 空 / 出错时, 这里返回 null, 渲染层换成 <PollTrendEmpty />.
    const trendModel = React.useMemo(
        () => mapTrendsResponseToModel(trendsResponse, options),
        [trendsResponse, options],
    );
    const trendBucketCount = trendModel?.buckets?.length ?? 0;
    const defaultActiveTrendIndex = trendModel
        ? trendModel.activeIndex ?? Math.max(trendBucketCount - 1, 0)
        : 0;
    const resolvedActiveTrendIndex = activeTrendIndex ?? defaultActiveTrendIndex;

    React.useEffect(() => {
        if (!trendModel) {
            return;
        }
        const fallbackIndex = trendModel.activeIndex ?? Math.max(trendBucketCount - 1, 0);
        setActiveTrendIndex(fallbackIndex);
    }, [trendModel, trendBucketCount]);

    React.useEffect(() => {
        if (!showPreview || !pollId) {
            return;
        }

        if (previewSyncPollIdRef.current === pollId) {
            return;
        }

        previewSyncPollIdRef.current = pollId;

        syncPollData(pollId).catch(() => {
            previewSyncPollIdRef.current = null;
        });
    }, [pollId, showPreview, syncPollData]);

    // 拉取历史走势数据. 切换 pollId / 进入 preview / expiresAt 变化时重新计算窗口并请求
    React.useEffect(() => {
        if (!showPreview || !pollId) {
            setTrendsResponse(null);
            return undefined;
        }

        let cancelled = false;
        const window = buildTrendsQueryWindow({expiresAt});

        getAdminPollTrends(pollId, window, cardConfig)
            .then((response) => {
                if (cancelled) {
                    return;
                }
                const hasPoints = Array.isArray(response?.points) && response.points.length > 0;
                setTrendsResponse(hasPoints ? response : null);
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }
                // 接口挂了就清空, 渲染层会隐藏图表那一列
                setTrendsResponse(null);
            });

        return () => {
            cancelled = true;
        };
    }, [cardConfig, expiresAt, pollId, showPreview]);

    if (showPreview) {
        return (
            <div
                className="not-kg-prose relative w-full max-w-full rounded-[20px] bg-[#232120] px-8 py-8 font-sans text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                data-kg-allow-clickthrough="false"
            >
                {previewImage && (
                    <img
                        alt={title || "Poll cover"}
                        className="mb-7 h-[240px] w-full rounded-[12px] object-cover"
                        src={previewImage}
                    />
                )}

                <div className="flex justify-between items-center">
                    <h3 className="m-0 text-[2.8rem] font-semibold leading-[1.25] text-white">
                        {title || "Untitled poll"}
                    </h3>
                    <div
                        ref={menuRef}
                        className="relative"
                        data-kg-allow-clickthrough="false"
                    >
                        <button
                            aria-label="Open poll actions"
                            className="flex size-12 items-center justify-center rounded-full text-white/90 transition hover:bg-[rgba(255,255,255,0.08)] cursor-pointer"
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setMenuOpen((value) => !value);
                            }}
                        >
                            <DotsIcon className="size-5" />
                        </button>

                        {menuOpen && (
                            <div className="absolute right-0 top-14 w-[200px] rounded-xl bg-white p-2 text-grey-950 shadow-[0_18px_40px_rgba(0,0,0,0.24)] z-[99]">
                                {/* 公布答案后 poll 不可再修改, 隐藏 Edit 入口 */}
                                {!answerRevealed && (
                                    <button
                                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition hover:bg-grey-100 cursor-pointer"
                                        type="button"
                                        onClick={handleEditCard}
                                    >
                                        <EditIcon className="size-4" />
                                        <span>Edit</span>
                                    </button>
                                )}
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition hover:bg-grey-100 cursor-pointer"
                                    type="button"
                                    onClick={handleDeleteCard}
                                >
                                    <DeleteIcon className="size-4" />
                                    <span>Delete</span>
                                </button>
                                {canPublishResults && (
                                    <button
                                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition hover:bg-grey-100 cursor-pointer"
                                        type="button"
                                        onClick={handlePublishResult}
                                    >
                                        <ErifiedBadgeLineIcon className="size-4" />
                                        <span>Publish Results</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {description && (
                    <p className="mt-4 text-[1.8rem] leading-[1.45] text-white/55">
                        {description}
                    </p>
                )}

                {/*
                  * 布局:
                  * - 移动端 (默认): flex-col, 图表在上 (order-1), 选项在下 (order-2)
                  * - 桌面端 (sm 及以上): flex-row + items-stretch (默认),
                  *   行高由选项的自然堆叠高度决定, 图表通过 h-full + ResizeObserver
                  *   动态匹配同样的高度 (见 PollTrendChart 内部)
                  */}
                <div className="mt-7 flex flex-col gap-7 sm:flex-row sm:gap-8">
                    <div className="order-2 flex flex-col gap-5 sm:order-1 sm:flex-1 sm:min-w-0">
                        {options.map((option) => (
                            <PollPreviewOption
                                key={option.id}
                                answerRevealed={answerRevealed}
                                option={option}
                                selectedOptionIds={previewSelection}
                                totalVotes={totalVotes}
                            />
                        ))}
                    </div>
                    {trendModel && (
                        <div className="order-1 min-h-[260px] w-full sm:order-2 sm:flex-[1.2] sm:min-h-0 sm:min-w-0">
                            <PollTrendChart
                                activeIndex={resolvedActiveTrendIndex}
                                onActivateIndex={setActiveTrendIndex}
                                trendModel={trendModel}
                            />
                        </div>
                    )}
                </div>

                <div className="mt-8 flex items-center justify-between gap-4 text-[1.55rem] text-[#878888]">
                    <div>{formatVoteCount(totalVotes)} Votes</div>
                    <div className="flex items-center gap-6">
                        {expiresAt && (
                            <div className="flex items-center gap-2">
                                <ClockIcon className="size-4" />
                                <span>{formatDisplayDate(expiresAt)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {publishResultsOpen && (
                    <PollPublishResultsDialog
                        error={publishResultsError}
                        initialSelectedIds={correctOptionIds}
                        isSubmitting={isPublishingResults}
                        options={options}
                        pollType={pollType}
                        title={title}
                        onClose={handleClosePublishResults}
                        onSubmit={handleSubmitPublishResults}
                    />
                )}
            </div>
        );
    }

    return (
        <div
            className="not-kg-prose w-full max-w-full rounded-[8px] bg-[#F7F7F7] px-8 py-7 font-sans text-grey-900 shadow-[0_0_0_1px_rgba(12,17,29,0.06)]"
            data-kg-allow-clickthrough
        >
            <div className="text-[1.45rem] font-medium text-[#9FA0A4]">
                Vote
            </div>
            <div className="mt-4 border-t border-grey-200" />

            <textarea
                className="mt-4 h-[30px] w-full resize-none border-0 bg-transparent p-0 text-[2.7rem] leading-[1.3] text-grey-900 outline-none placeholder:text-grey-500"
                placeholder="Type your question here"
                value={draftTitle}
                onChange={handleTitleChange}
                onCompositionEnd={handleTitleCompositionEnd}
            />

            {!showMediaFields && (
                <button
                    className="mt-2 flex w-fit items-center gap-2 border-0 bg-transparent p-0 text-[1.65rem] text-[#9FA0A4] transition hover:text-grey-900 cursor-pointer"
                    type="button"
                    onClick={() => setShowMediaFields(true)}
                >
                    <AddIcon className="size-4" />
                    <span>Add description or image</span>
                </button>
            )}

            {showMediaFields && (
                <div className="mt-6 space-y-5">
                    <label className="block">
                        <div className="mb-2 text-[1.45rem] font-medium text-[#9FA0A4]">
                            Description
                        </div>
                        <textarea
                            className="min-h-[120px] w-full resize-none rounded-xl bg-white px-5 py-4 text-[1.7rem] leading-[1.5] text-grey-900 outline-none transition"
                            placeholder="Description"
                            value={draftDescription}
                            onChange={handleDescriptionChange}
                            onCompositionEnd={handleDescriptionCompositionEnd}
                        />
                    </label>

                    <div>
                        <div className="mb-2 text-[1.45rem] font-medium text-[#9FA0A4]">
                            Image
                        </div>
                        {!previewImage ? (
                            <div className="flex">
                                <button
                                    className="flex h-[120px] w-[120px] items-center justify-center rounded-[8px] bg-white text-grey-500 transition hover:text-grey-800"
                                    type="button"
                                    onClick={() =>
                                        openFileSelection({
                                            fileInputRef: imageInputRef,
                                        })
                                    }
                                >
                                    <AddIcon className="size-6" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative inline-flex overflow-hidden rounded-[8px]">
                                <img
                                    alt="Poll cover preview"
                                    className="h-[120px] w-[260px] object-cover"
                                    src={previewImage}
                                />
                                <button
                                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/85 text-white transition hover:bg-black"
                                    type="button"
                                    onClick={handleRemoveImage}
                                >
                                    <CloseIcon className="size-4 text-[#A6A6A6]" />
                                </button>
                            </div>
                        )}

                        <form
                            className="hidden"
                            onChange={handleImageInputChange}
                        >
                            <input
                                ref={imageInputRef}
                                accept={imageMimeTypes.join(",")}
                                name="poll-image-input"
                                type="file"
                            />
                        </form>
                    </div>
                </div>
            )}

            <div className="mt-8 text-[1.45rem] font-medium text-[#9FA0A4]">
                Answer options
            </div>
            <div className="mt-4 space-y-3">
                {options.map((option, index) => (
                    <div
                        key={option.id}
                        className="flex items-center gap-3 rounded-xl bg-white px-4 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
                    >
                        <input
                            className="h-11 w-full border-0 bg-transparent text-[1.65rem] text-grey-900 outline-none placeholder:text-grey-500"
                            placeholder={`Option ${index + 1}`}
                            value={draftOptions[index] ?? option.text}
                            onChange={(event) =>
                                handleOptionTextChange(index, event)
                            }
                            onCompositionEnd={(event) =>
                                handleOptionCompositionEnd(index, event)
                            }
                        />
                        <button
                            className={`flex size-8 items-center justify-center rounded-full border-0 bg-transparent text-grey-500 transition ${options.length > 2 ? "hover:text-grey-900" : "cursor-not-allowed opacity-40"}`}
                            disabled={options.length <= 2}
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                        >
                            <CloseIcon className="size-4 text-[#A6A6A6]" />
                        </button>
                    </div>
                ))}
            </div>

            <button
                className="mt-4 flex w-fit items-center gap-2 border-0 bg-transparent p-0 text-[1.65rem] text-[#9FA0A4] transition hover:text-grey-900 cursor-pointer"
                type="button"
                onClick={handleAddOption}
            >
                <AddIcon className="size-4" />
                <span>Add option</span>
            </button>

            <div className="mt-4">
                <div className="mb-2 text-[1.45rem] font-medium text-[#9FA0A4]">
                    Poll type
                </div>
                <div className="relative flex items-center rounded-xl bg-white px-4 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                    <select
                        className="h-11 w-full cursor-pointer appearance-none border-0 bg-transparent pr-8 text-[1.65rem] text-grey-900 outline-none"
                        value={pollType === "multiple" ? "multiple" : "single"}
                        onChange={(event) => updateNode((node) => node.setPollType(event.target.value))}
                    >
                        <option value="single">Single choice</option>
                        <option value="multiple">Multiple choice</option>
                    </select>
                    <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute right-4 size-4 text-grey-500"
                        fill="none"
                        viewBox="0 0 16 16"
                    >
                        <path
                            d="M4 6 L8 10 L12 6"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.6"
                        />
                    </svg>
                </div>
            </div>

            {!showEndDateField ? (
                <button
                    className="mt-10 flex w-fit items-center gap-2 border-0 bg-transparent p-0 text-[1.65rem] text-[#9FA0A4] transition hover:text-grey-900 cursor-pointer"
                    type="button"
                    onClick={() => setShowEndDateField(true)}
                >
                    <AddIcon className="size-4" />
                    <span>Add end date</span>
                </button>
            ) : (
                <div className="mt-10">
                    <div className="mb-2 text-[1.45rem] text-[#9FA0A4]">
                        End date
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                        <input
                            ref={endDateInputRef}
                            className="h-11 w-full border-0 bg-transparent text-[1.65rem] text-grey-900 outline-none"
                            type="datetime-local"
                            min={minEndDateValue}
                            value={toDateTimeLocalValue(expiresAt)}
                            onChange={handleExpiresAtChange}
                            onBlur={() => setIsEndDateInputActive(false)}
                        />
                        <button
                            className="flex size-8 items-center justify-center rounded-full border-0 bg-transparent text-grey-500 transition hover:text-grey-900"
                            type="button"
                            onClick={() => {
                                setShowEndDateField(false);
                                setIsEndDateInputActive(false);
                                updateNode((node) => node.setExpiresAt(""));
                            }}
                        >
                            <CloseIcon className="size-4 text-[#A6A6A6]" />
                        </button>
                    </div>
                </div>
            )}

            {apiError && (
                <div className="mt-5 rounded-2xl border border-red/20 bg-red/5 px-4 py-3 text-[1.5rem] text-red">
                    {apiError}
                </div>
            )}

            <button
                className="mt-8 flex h-10 w-fit items-center justify-center rounded-[8px] bg-black px-6 text-[1.7rem] font-medium text-white transition hover:bg-grey-950 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                disabled={isSaving}
                type="button"
                onClick={handleSavePoll}
            >
                {isSaving ? "Saving..." : createButtonLabel}
            </button>
        </div>
    );
}
