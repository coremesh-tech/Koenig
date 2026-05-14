import React from "react";
import {LineType, createChart} from "lightweight-charts";

const CHART_RATE_MIN = 0;
const CHART_RATE_MAX = 100;
// 上下内边距, 让 0% / 100% 数据线离 canvas 顶/底有充足空间, stroke width 4 不会被
// surfaceViewport 的 overflow-hidden 切掉. 底部稍大, 给 0% 段更多缓冲.
const SCALE_MARGIN_TOP = 0.06;
const SCALE_MARGIN_BOTTOM = 0.1;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function formatRate(value) {
    return `${Number(value || 0).toFixed(2)}%`;
}

function formatHoverDateTime(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${month}.${day} ${hours}:${minutes}`;
}

function resolveLabelLayout(items, {minGap, minY, maxY}) {
    if (items.length === 0) {
        return new Map();
    }

    const sorted = [...items].sort((a, b) => a.y - b.y);
    const out = new Map();
    let prev = -Infinity;

    for (const item of sorted) {
        const y = Math.max(item.y, prev + minGap);
        out.set(item.id, y);
        prev = y;
    }

    let next = Infinity;
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
        const item = sorted[index];
        const current = out.get(item.id);
        const y = clamp(Math.min(current, next - minGap), minY, maxY);
        out.set(item.id, y);
        next = y;
    }

    return out;
}

function toChartTimestamp(value) {
    const milliseconds = new Date(value).getTime();
    if (!Number.isFinite(milliseconds)) {
        return null;
    }

    return {
        seconds: Math.floor(milliseconds / 1000),
        milliseconds,
    };
}

function prepareTrendModelForChart(trendModel) {
    if (!trendModel || !Array.isArray(trendModel.buckets) || !Array.isArray(trendModel.series) || trendModel.series.length === 0) {
        return null;
    }

    const buckets = trendModel.buckets.map((bucket) => {
        const timestamp = toChartTimestamp(bucket.key);

        return {
            ...bucket,
            chartTime: timestamp ? timestamp.seconds : null,
            chartMs: timestamp ? timestamp.milliseconds : null,
        };
    });

    if (buckets.length === 0 || buckets.some(bucket => bucket.chartTime === null)) {
        return null;
    }

    const series = trendModel.series.map((item) => {
        return {
            ...item,
            rates: Array.isArray(item.rates)
                ? item.rates.map(rate => clamp(Number(rate || 0), 0, 100))
                : [],
        };
    }).filter((item) => {
        return item.rates.length === buckets.length;
    });

    if (series.length === 0) {
        return null;
    }

    return {
        buckets,
        series,
        activeIndex: clamp(
            trendModel.activeIndex ?? buckets.length - 1,
            0,
            Math.max(buckets.length - 1, 0),
        ),
    };
}

function measureChartSurface(surfaceElement) {
    const rect = surfaceElement.getBoundingClientRect();

    return {
        width: Math.max(Math.round(rect.width), 1),
        height: Math.max(Math.round(rect.height), 1),
    };
}

function resolveRateY(rate, height) {
    const clampedRate = clamp(Number(rate || 0), CHART_RATE_MIN, CHART_RATE_MAX);
    const plotTop = height * SCALE_MARGIN_TOP;
    const plotBottom = height * SCALE_MARGIN_BOTTOM;
    const plotHeight = Math.max(height - plotTop - plotBottom, 1);
    const normalizedRate = (clampedRate - CHART_RATE_MIN) / (CHART_RATE_MAX - CHART_RATE_MIN);

    return clamp(plotTop + ((1 - normalizedRate) * plotHeight), 0, height);
}

function getBucketCoordinates(chart, buckets, width) {
    const count = buckets.length;

    return buckets.map((bucket, index) => {
        const coordinate = chart.timeScale().timeToCoordinate(bucket.chartTime);

        if (typeof coordinate === "number" && Number.isFinite(coordinate)) {
            return clamp(coordinate, 0, width);
        }

        if (count <= 1) {
            return width / 2;
        }

        return (width * index) / (count - 1);
    });
}

function resolveNearestBucketIndex(bucketXs, x) {
    if (bucketXs.length <= 1) {
        return 0;
    }

    let nearestIndex = 0;
    let nearestDistance = Infinity;

    bucketXs.forEach((bucketX, index) => {
        const distance = Math.abs(bucketX - x);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });

    return nearestIndex;
}

export function PollTrendChart({
    // 当前实现默认显示 trendModel.activeIndex 对应的激活点;
    // hover 时再额外显示时间和百分比标签. 这里保留 prop 只是兼容调用方.
    // eslint-disable-next-line no-unused-vars
    activeIndex,
    onActivateIndex,
    trendModel,
}) {
    const plotWrapRef = React.useRef(null);
    const surfaceViewportRef = React.useRef(null);
    const surfaceRef = React.useRef(null);
    const chartRef = React.useRef(null);
    const seriesRefs = React.useRef([]);
    const hoverXRef = React.useRef(null);
    const animationFrameRef = React.useRef(0);

    const [surfaceSize, setSurfaceSize] = React.useState({width: 0, height: 0});
    const [activePosition, setActivePosition] = React.useState(null);

    const preparedTrendModel = React.useMemo(() => {
        return prepareTrendModelForChart(trendModel);
    }, [trendModel]);

    const updateOverlay = React.useCallback(() => {
        const chart = chartRef.current;
        const prepared = preparedTrendModel;

        if (!chart || !prepared || !surfaceSize.width || !surfaceSize.height) {
            setActivePosition(null);
            return;
        }

        const bucketXs = getBucketCoordinates(chart, prepared.buckets, surfaceSize.width);
        if (bucketXs.length === 0) {
            setActivePosition(null);
            return;
        }

        const isHovering = hoverXRef.current !== null;
        const defaultX = bucketXs[prepared.activeIndex] ?? bucketXs[bucketXs.length - 1] ?? 0;
        const hoveredX = isHovering
            ? clamp(hoverXRef.current, bucketXs[0], bucketXs[bucketXs.length - 1])
            : defaultX;
        const activeBucketIndex = isHovering
            ? resolveNearestBucketIndex(bucketXs, hoveredX)
            : prepared.activeIndex;
        const activeX = bucketXs[activeBucketIndex] ?? hoveredX;
        const activeBucket = prepared.buckets[activeBucketIndex];
        const timeText = activeBucket?.chartMs
            ? formatHoverDateTime(new Date(activeBucket.chartMs))
            : "";
        const labelMinY = 10;
        const labelMaxY = Math.max(labelMinY, surfaceSize.height - 10);

        const values = seriesRefs.current.map((seriesRef, seriesIndex) => {
            const rate = Number(seriesRef.values[activeBucketIndex] || 0);
            const y = resolveRateY(rate, surfaceSize.height);

            return {
                id: prepared.series[seriesIndex].optionId,
                color: seriesRef.color,
                text: prepared.series[seriesIndex].text,
                rate,
                y,
            };
        }).filter(Boolean);

        if (values.length === 0) {
            setActivePosition(null);
            return;
        }

        const labelLayout = resolveLabelLayout(values.map((value) => {
            return {
                id: value.id,
                y: clamp(value.y, labelMinY, labelMaxY),
            };
        }), {
            minGap: 18,
            minY: labelMinY,
            maxY: labelMaxY,
        });

        const nextPosition = {
            x: activeX,
            isHovering,
            bucketXs,
            timeText,
            activeBucketIndex,
            values: values.map((value) => {
                return {
                    ...value,
                    labelY: labelLayout.get(value.id) ?? value.y,
                };
            }),
        };

        setActivePosition(nextPosition);
        if (typeof onActivateIndex === "function") {
            onActivateIndex(activeBucketIndex);
        }
    }, [onActivateIndex, preparedTrendModel, surfaceSize.height, surfaceSize.width]);

    const scheduleOverlayUpdate = React.useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
            animationFrameRef.current = requestAnimationFrame(() => {
                animationFrameRef.current = 0;
                updateOverlay();
            });
        });
    }, [updateOverlay]);

    React.useLayoutEffect(() => {
        if (!surfaceRef.current) {
            return undefined;
        }

        const chart = createChart(surfaceRef.current, {
            width: Math.max(surfaceSize.width, 1),
            height: Math.max(surfaceSize.height, 1),
            layout: {
                background: {color: "transparent"},
                textColor: "transparent",
                attributionLogo: false,
            },
            grid: {
                vertLines: {visible: false},
                horzLines: {visible: false},
            },
            crosshair: {
                mode: 0,
                vertLine: {visible: false, labelVisible: false},
                horzLine: {visible: false, labelVisible: false},
            },
            leftPriceScale: {
                visible: false,
                borderVisible: false,
                scaleMargins: {top: SCALE_MARGIN_TOP, bottom: SCALE_MARGIN_BOTTOM},
            },
            rightPriceScale: {
                visible: false,
                borderVisible: false,
                scaleMargins: {top: SCALE_MARGIN_TOP, bottom: SCALE_MARGIN_BOTTOM},
            },
            timeScale: {
                visible: false,
                borderVisible: false,
                ticksVisible: false,
                timeVisible: false,
                secondsVisible: true,
                fixLeftEdge: true,
                fixRightEdge: true,
                rightOffset: 0,
                barSpacing: preparedTrendModel?.buckets.length > 1 ? 18 : 24,
            },
            handleScroll: false,
            handleScale: false,
        });

        chartRef.current = chart;

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            chart.remove();
            chartRef.current = null;
            seriesRefs.current = [];
        };
    }, []);

    React.useEffect(() => {
        const surfaceViewportElement = surfaceViewportRef.current;
        if (!surfaceViewportElement || typeof ResizeObserver === "undefined") {
            return undefined;
        }

        const observer = new ResizeObserver(() => {
            const nextSize = measureChartSurface(surfaceViewportElement);
            setSurfaceSize(nextSize);
        });

        observer.observe(surfaceViewportElement);
        setSurfaceSize(measureChartSurface(surfaceViewportElement));

        return () => observer.disconnect();
    }, []);

    React.useLayoutEffect(() => {
        const chart = chartRef.current;
        if (!chart || !surfaceSize.width || !surfaceSize.height) {
            return;
        }

        chart.applyOptions({
            width: surfaceSize.width,
            height: surfaceSize.height,
            leftPriceScale: {
                visible: false,
                borderVisible: false,
                scaleMargins: {top: SCALE_MARGIN_TOP, bottom: SCALE_MARGIN_BOTTOM},
            },
            rightPriceScale: {
                visible: false,
                borderVisible: false,
                scaleMargins: {top: SCALE_MARGIN_TOP, bottom: SCALE_MARGIN_BOTTOM},
            },
            timeScale: {
                visible: false,
                borderVisible: false,
                ticksVisible: false,
                timeVisible: false,
                secondsVisible: true,
                fixLeftEdge: true,
                fixRightEdge: true,
                rightOffset: 0,
                barSpacing: preparedTrendModel?.buckets.length > 1 ? 18 : 24,
            },
        });
        chart.timeScale().fitContent();

        if (hoverXRef.current !== null) {
            hoverXRef.current = clamp(hoverXRef.current, 0, surfaceSize.width);
        }

        scheduleOverlayUpdate();
    }, [preparedTrendModel?.buckets.length, scheduleOverlayUpdate, surfaceSize.height, surfaceSize.width]);

    React.useLayoutEffect(() => {
        const chart = chartRef.current;
        if (!chart || !preparedTrendModel) {
            return;
        }

        seriesRefs.current.forEach((seriesRef) => {
            try {
                chart.removeSeries(seriesRef.api);
            } catch (_error) {
                // ignore removed series
            }
        });
        seriesRefs.current = [];

        preparedTrendModel.series.forEach((series) => {
            const lineSeries = chart.addLineSeries({
                color: series.color,
                lineWidth: 2,
                lineType: typeof LineType?.Curved === "number" ? LineType.Curved : 2,
                crosshairMarkerVisible: false,
                lastValueVisible: false,
                priceLineVisible: false,
                autoscaleInfoProvider: () => ({
                    priceRange: {
                        minValue: CHART_RATE_MIN,
                        maxValue: CHART_RATE_MAX,
                    },
                }),
            });

            lineSeries.setData(preparedTrendModel.buckets.map((bucket, bucketIndex) => {
                return {
                    time: bucket.chartTime,
                    value: preparedTrendModel.series.find(item => item.optionId === series.optionId).rates[bucketIndex],
                };
            }));

            seriesRefs.current.push({
                api: lineSeries,
                color: series.color,
                values: series.rates,
            });
        });

        hoverXRef.current = null;
        chart.timeScale().fitContent();

        scheduleOverlayUpdate();
    }, [preparedTrendModel, scheduleOverlayUpdate]);

    React.useEffect(() => {
        const chart = chartRef.current;
        const plotWrapElement = plotWrapRef.current;
        if (!chart || !plotWrapElement || !surfaceSize.width) {
            return undefined;
        }

        const handlePointerMove = (event) => {
            const rect = surfaceViewportRef.current?.getBoundingClientRect();
            if (!rect || rect.width <= 0) {
                return;
            }

            hoverXRef.current = clamp(event.clientX - rect.left, 0, rect.width);
            updateOverlay();
        };

        const handlePointerLeave = () => {
            hoverXRef.current = null;
            updateOverlay();
        };

        const handleCrosshairMove = (event) => {
            if (!event?.point || typeof event.point.x !== "number" || !Number.isFinite(event.point.x)) {
                return;
            }

            hoverXRef.current = clamp(event.point.x, 0, surfaceSize.width);
            updateOverlay();
        };

        plotWrapElement.addEventListener("mousemove", handlePointerMove);
        plotWrapElement.addEventListener("mouseleave", handlePointerLeave);
        chart.subscribeCrosshairMove(handleCrosshairMove);

        return () => {
            plotWrapElement.removeEventListener("mousemove", handlePointerMove);
            plotWrapElement.removeEventListener("mouseleave", handlePointerLeave);
            chart.unsubscribeCrosshairMove(handleCrosshairMove);
        };
    }, [surfaceSize.width, updateOverlay]);

    if (!preparedTrendModel) {
        return null;
    }

    return (
        <div className="flex h-[240px] w-full flex-col rounded-[12px] sm:h-full">
            <div className="mb-[10px] flex flex-wrap gap-x-6 gap-y-2">
                {preparedTrendModel.series.map((series) => (
                    <div key={series.optionId} className="inline-flex items-center gap-2 text-[1.5rem] leading-none text-white/90">
                        <span
                            className="inline-block size-[0.9rem] rounded-full"
                            style={{backgroundColor: series.color}}
                        />
                        <span>{series.text}</span>
                    </div>
                ))}
            </div>

            <div
                ref={plotWrapRef}
                className="relative min-h-0 flex-1 cursor-crosshair pt-6"
            >
                <div
                    ref={surfaceViewportRef}
                    className="absolute inset-x-0 overflow-hidden"
                    style={{top: "24px", bottom: "18px", zIndex: 1}}
                >
                    <div
                        ref={surfaceRef}
                        className="absolute inset-0"
                    />
                </div>

                {activePosition?.isHovering && (
                    <div
                        className="pointer-events-none absolute z-[2] w-px bg-[rgba(255,255,255,0.22)]"
                        style={{
                            left: activePosition.x,
                            top: "30px",
                            bottom: "30px",
                            transform: "translateX(-50%)",
                        }}
                    />
                )}

                <div
                    className="pointer-events-none absolute inset-x-0 z-[2]"
                    style={{top: "24px", bottom: "18px"}}
                >
                    {activePosition?.values.map((value) => {
                        const flipLeft = activePosition.x > surfaceSize.width - 140;
                        const labelX = clamp(
                            activePosition.x + (flipLeft ? -12 : 12),
                            4,
                            Math.max(surfaceSize.width - 4, 4),
                        );

                        return (
                            <React.Fragment key={value.id}>
                                <div
                                    className="absolute size-[14px]"
                                    style={{
                                        left: Math.round(activePosition.x),
                                        top: Math.round(value.y),
                                        color: value.color,
                                        transform: "translate(-50%, -50%)",
                                    }}
                                >
                                    <span
                                        className="absolute inset-0 rounded-full bg-current opacity-45"
                                        style={{
                                            animation: "poll-trend-dot-pulse 1.8s ease-out infinite",
                                            transformOrigin: "center",
                                        }}
                                    />
                                    <span
                                        className="absolute rounded-full border-2 border-[#232120] bg-current"
                                        style={{inset: "1.5px"}}
                                    />
                                </div>

                                {activePosition.isHovering && (
                                    <div
                                        className="pointer-events-none absolute flex min-h-[14px] whitespace-nowrap text-[1.2rem] font-medium leading-[14px]"
                                        style={{
                                            left: Math.round(labelX),
                                            top: Math.round(value.labelY),
                                            color: value.color,
                                            textShadow: "0 0 1px #232120, 0 0 4px #232120, 0 0 6px #232120",
                                            transform: flipLeft ? "translate(-100%, -50%)" : "translateY(-50%)",
                                            textAlign: flipLeft ? "right" : "left",
                                            justifyContent: flipLeft ? "flex-end" : "flex-start",
                                            zIndex: 2,
                                        }}
                                    >
                                        {`${activePosition.timeText} ${formatRate(value.rate)}`}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                <style>{`
                    @keyframes poll-trend-dot-pulse {
                        0% {
                            transform: scale(1);
                            opacity: 0.45;
                        }

                        70% {
                            transform: scale(2.3);
                            opacity: 0;
                        }

                        100% {
                            transform: scale(2.3);
                            opacity: 0;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}
