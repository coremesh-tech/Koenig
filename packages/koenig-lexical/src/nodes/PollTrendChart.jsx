import React from "react";

// ---- 数学 / 路径 / 文案小工具 ----

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// 平滑折线: 在相邻两点间用三次贝塞尔, 控制点取两端 x 中点保证曲线水平进出.
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

function formatRate(value) {
    return `${Number(value || 0).toFixed(2)}%`;
}

function formatDetailTime(date) {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = date.getHours() < 12 ? "AM" : "PM";
    return `${hours}:${minutes} ${ampm}`;
}

/**
 * 标签去重叠.
 *
 * 当多个 series 在同一时间点的百分比相同 (或非常接近) 时, 它们的标签 y 会重合,
 * 看起来像是只画了一条数据. 这里做一次「弹簧式」垂直推开:
 *
 *   1. 按初始 y 升序, 顺序遍历, 保证相邻标签 y 距离 >= minGap
 *   2. 反向再扫一次, 防止整体被往下推超出 [minY, maxY] 边界
 *
 * 返回 Map<seriesIndex, adjustedY>.
 */
function resolveLabelLayout(items, {minGap, minY, maxY}) {
    if (items.length === 0) {
        return new Map();
    }

    const sorted = [...items].sort((a, b) => a.y - b.y);
    const adjusted = new Map();

    // 正向: 把每个标签往下顶到至少与上一个差 minGap
    let prevY = -Infinity;
    for (const item of sorted) {
        const y = Math.max(item.y, prevY + minGap);
        adjusted.set(item.seriesIndex, y);
        prevY = y;
    }

    // 反向: 如果尾部被顶出 maxY, 反过来把它们往上回推
    let nextY = Infinity;
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
        const item = sorted[i];
        const current = adjusted.get(item.seriesIndex);
        const y = clamp(Math.min(current, nextY - minGap), minY, maxY);
        adjusted.set(item.seriesIndex, y);
        nextY = y;
    }

    return adjusted;
}

/**
 * 趋势图.
 *
 * Props:
 *   activeIndex       number              非 hover 状态下的「当前激活」整数索引
 *   onActivateIndex   (index) => void     hover 时把最近 bucket 同步给父端 (可选)
 *   trendModel        {buckets, series, activeIndex?}
 *     buckets: [{key, label, detail, isFuture}]
 *     series:  [{optionId, text, color, rates: number[]}]
 */
export function PollTrendChart({
    activeIndex,
    onActivateIndex,
    trendModel,
}) {
    // ---- 内部留白常量 (相对 SVG 像素) ----
    const topPadding = 24;       // 顶部 "5 AM" 时间标签
    const bottomPadding = 36;    // 底部 bucket 日期标签 + 间距
    const labelGutter = 12;      // 右侧给随圆点的百分比标签留点空间
    const labelMinGap = 16;      // 同一时间点两个百分比标签之间的最小垂直距离

    const containerRef = React.useRef(null);
    const svgRef = React.useRef(null);
    const [hoverX, setHoverX] = React.useState(null);    // null = 没在 hover, 落在默认位
    const [mounted, setMounted] = React.useState(false); // 首次绘入动画
    // 用 ResizeObserver 测量 SVG 容器实际尺寸, 让 viewBox / plot 区域跟着选项列高度走
    const [dims, setDims] = React.useState({width: 348, height: 200});

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === "undefined") {
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
    const lowerActiveIndex = Math.floor(activeFraction);
    const upperActiveIndex = Math.min(lowerActiveIndex + 1, bucketCount - 1);
    const activeProgress = activeFraction - lowerActiveIndex;

    const rateToY = React.useCallback((rate) => {
        const normalizedRate = clamp(Number(rate) || 0, 0, 100);
        return plotHeight - (normalizedRate / 100) * plotHeight;
    }, [plotHeight]);

    const activeDetail = React.useMemo(() => {
        const lowerBucket = trendModel.buckets[lowerActiveIndex];
        const upperBucket = trendModel.buckets[upperActiveIndex];
        const lowerMs = lowerBucket ? Date.parse(lowerBucket.key) : NaN;
        const upperMs = upperBucket ? Date.parse(upperBucket.key) : NaN;

        if (Number.isFinite(lowerMs) && Number.isFinite(upperMs)) {
            const interpolatedMs = lowerMs + (upperMs - lowerMs) * activeProgress;
            return formatDetailTime(new Date(interpolatedMs));
        }

        return activeBucket?.detail || "";
    }, [
        activeBucket?.detail,
        activeProgress,
        lowerActiveIndex,
        trendModel.buckets,
        upperActiveIndex,
    ]);

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
        if (hoverX === null || typeof onActivateIndex !== "function") {
            return;
        }
        onActivateIndex(nearestActiveIndex);
    }, [hoverX, nearestActiveIndex, onActivateIndex]);

    const pointsBySeries = trendModel.series.map((series) =>
        series.rates.map((rate, index) => ({
            x: index * xStep,
            y: rateToY(rate),
        })),
    );

    // 按最近 bucket 切分过去 / 未来线段
    const splitPointsBySeries = pointsBySeries.map((points) => ({
        pastPoints: points.slice(0, nearestActiveIndex + 1),
        futurePoints: points.slice(nearestActiveIndex),
    }));

    // 在 activeFraction 位置, 对每个 series 做线性插值, 得到当前 y 和当前百分比
    const activePositions = trendModel.series.map((series, seriesIndex) => {
        const rates = series.rates;
        const lower = lowerActiveIndex;
        const upper = Math.min(upperActiveIndex, rates.length - 1);
        const t = activeProgress;
        const rate = rates[lower] + (rates[upper] - rates[lower]) * t;
        const y = rateToY(rate);
        return {seriesIndex, x: activeX, y, rate};
    });

    // 标签的初始 y 落点 (跟圆点 y 偏 4px 用于视觉对齐), 然后做去重叠;
    // 圆点本身的 y 不变, 保持数据真实.
    const labelInitial = activePositions.map((pos) => ({
        seriesIndex: pos.seriesIndex,
        y: clamp(pos.y + 4, 12, plotHeight - 4),
    }));
    const labelYBySeries = resolveLabelLayout(labelInitial, {
        minGap: labelMinGap,
        minY: 12,
        maxY: plotHeight - 4,
    });

    // hover 时给「快」的过渡 (跟手), 离开时给「慢」的过渡 (优雅回弹)
    const fastTransition = "transform 0.08s linear";
    const restTransition = "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)";
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
            <div ref={containerRef} className="relative min-h-200 sm:min-h-0 flex-1">
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
                            {activeDetail && (
                                <text
                                    fill="rgba(255,255,255,0.88)"
                                    fontSize="11"
                                    fontWeight="500"
                                    textAnchor="start"
                                    x={-20}
                                    y={-18}
                                >
                                    {activeDetail}
                                </text>
                            )}
                        </g>

                        {/* 第一层: 所有线. 使用 pathLength=100 + dashoffset 实现首次绘入.
                            stroke-opacity 略小于 1, 让两条线在数据相同时叠加色更深, 用户能感知到重合 */}
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
                                        strokeOpacity="0.9"
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

                        {/* 第二层: 激活圆点 (脉冲 halo + 实心点) - 跟着 hover 在线上滑.
                            就算多个 series 落在同一坐标, 后画的圆点会盖住前面, 但是因为下面的标签
                            层已经做了垂直去重叠, 用户依然能看到每个 series 的百分比. */}
                        {activePositions.map((pos) => {
                            const series = trendModel.series[pos.seriesIndex];
                            return (
                                <g
                                    key={`dot-${series.optionId}`}
                                    style={{
                                        transform: `translate(${pos.x}px, ${pos.y}px)`,
                                        transition: followTransition,
                                    }}
                                >
                                    <circle
                                        cx={0}
                                        cy={0}
                                        fill={series.color}
                                        style={{
                                            animation: "poll-trend-dot-pulse 1.8s ease-out infinite",
                                        }}
                                    />
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

                        {/* 第三层: 百分比标签 (最上层 + 卡片色描边 halo).
                            y 用 resolveLabelLayout 算出来的「去重叠后」位置. */}
                        {activePositions.map((pos) => {
                            const series = trendModel.series[pos.seriesIndex];
                            const flipLabelToLeft = pos.x > plotWidth - 70;
                            const labelOffsetX = flipLabelToLeft ? -10 : 10;
                            const labelY = labelYBySeries.get(pos.seriesIndex) ?? pos.y + 4;
                            return (
                                <g
                                    key={`label-${series.optionId}`}
                                    style={{
                                        transform: `translate(${pos.x + labelOffsetX}px, ${labelY}px)`,
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
                                        {formatRate(pos.rate)}
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
                                    style={{transition: "fill 0.2s ease"}}
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
