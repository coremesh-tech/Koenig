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
    getAdminPollPermissions,
    getAdminPollTrends,
    getAdminPollVotes,
    pauseAdminPollVoting,
    publishAdminPoll,
    publishAdminPollResults,
    resumeAdminPollVoting,
    saveAdminPoll,
    unpublishAdminPoll,
} from "../utils/pollsApi.js";
import { PollPublishResultsDialog } from "./PollPublishResultsDialog";
import { PollTrendChart } from "./PollTrendChart";
import { buildTrendsQueryWindow, mapTrendsResponseToModel } from "./pollTrendModel";
import { Toggle } from "../components/ui/Toggle";
import { useClickOutside } from "../hooks/useClickOutside";
import useAutoExpandTextArea from "../utils/autoExpandTextArea";
import { openFileSelection } from "../utils/openFileSelection.js";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

const MONTH_OPTIONS = [
    {label: "Jan", value: 1},
    {label: "Feb", value: 2},
    {label: "Mar", value: 3},
    {label: "Apr", value: 4},
    {label: "May", value: 5},
    {label: "Jun", value: 6},
    {label: "Jul", value: 7},
    {label: "Aug", value: 8},
    {label: "Sep", value: 9},
    {label: "Oct", value: 10},
    {label: "Nov", value: 11},
    {label: "Dec", value: 12}
];

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

function padTimeValue(value) {
    return `${value}`.padStart(2, "0");
}

function getPickerBaseDate(value) {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
        return new Date();
    }

    return date;
}

function createPickerValue(value) {
    const date = getPickerBaseDate(value);

    return {
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        month: date.getMonth() + 1,
        year: date.getFullYear()
    };
}

function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function normalizePickerValue(value) {
    const month = Math.max(1, Math.min(12, Number(value.month) || 1));
    const year = Math.max(new Date().getFullYear(), Number(value.year) || new Date().getFullYear());
    const maxDay = getDaysInMonth(year, month);

    return {
        day: Math.max(1, Math.min(maxDay, Number(value.day) || 1)),
        hour: Math.max(0, Math.min(23, Number(value.hour) || 0)),
        minute: Math.max(0, Math.min(59, Number(value.minute) || 0)),
        month,
        year
    };
}

function pickerValueToInputValue(value) {
    const normalizedValue = normalizePickerValue(value);
    return `${normalizedValue.year}-${padTimeValue(normalizedValue.month)}-${padTimeValue(normalizedValue.day)}T${padTimeValue(normalizedValue.hour)}:${padTimeValue(normalizedValue.minute)}`;
}

function getYearOptions() {
    const currentYear = new Date().getFullYear();

    return Array.from({length: 11}, (_, index) => currentYear + index);
}

function formatDisplayDate(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const meridiem = date.getHours() >= 12 ? "PM" : "AM";
    const dateLabel = new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
    const [monthDay, year] = dateLabel.split(", ");

    return `${monthDay}, ${year}, ${padTimeValue(date.getHours())}:${padTimeValue(date.getMinutes())} ${meridiem}`;
}

function formatEditorDateTime(value) {
    if (!value) {
        return "Select end date";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Select end date";
    }

    const meridiem = date.getHours() >= 12 ? "PM" : "AM";
    const timeLabel = `${padTimeValue(date.getHours())}:${padTimeValue(date.getMinutes())}${meridiem}`;

    return `${new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date)} ${timeLabel}`;
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

function PauseIcon(props) {
    return (
        <svg fill="currentColor" viewBox="0 0 16 16" {...props}>
            <rect x="4" y="3" width="2.6" height="10" rx="0.6" />
            <rect x="9.4" y="3" width="2.6" height="10" rx="0.6" />
        </svg>
    );
}

function ResumeIcon(props) {
    return (
        <svg fill="currentColor" viewBox="0 0 16 16" {...props}>
            <path d="M5 3.2 L12.4 8 L5 12.8 Z" />
        </svg>
    );
}

function SelectChevronIcon(props) {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            viewBox="0 0 16 16"
            {...props}
        >
            <path
                d="M4 6 L8 10 L12 6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
        </svg>
    );
}

function PickerSelect({children, className = "", ...props}) {
    return (
        <div className="relative">
            <select
                className={`h-11 w-full appearance-none rounded-lg border border-grey-200 bg-white pl-3 pr-10 text-[1.55rem] text-grey-900 outline-none ${className}`}
                {...props}
            >
                {children}
            </select>
            <SelectChevronIcon className="pointer-events-none absolute right-3.5 top-1/2 size-4 !-translate-y-1/2 text-grey-500" />
        </div>
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
                    <div className="flex min-w-0 flex-1 items-center gap-2 text-[1.85rem] font-semibold text-white">
                        <span className="min-w-0 truncate" title={option.text}>{option.text}</span>
                        {isCorrect && (
                            <span className="shrink-0 rounded-md bg-[#22C55E] px-2 py-1 text-[1.2rem] font-semibold leading-none text-white">
                                Result
                            </span>
                        )}
                    </div>
                    <span className="shrink-0 text-[1.8rem] font-semibold text-white">
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
    return (
        <div className="relative overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.2)] bg-transparent">
            {showFill && (
                <div
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 rounded-[11px] bg-[rgba(255,255,255,0.12)]`}
                    style={{ width: fillWidth }}
                />
            )}
            <div className="relative z-[1] flex items-center justify-between gap-4 px-[18px] py-[12px]">
                <div
                    className={`min-w-0 flex-1 truncate rounded-[12px] text-[1.85rem] font-semibold ${isSelected ? "bg-white/12" : ""}`}
                    title={option.text}
                >
                    {option.text}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[1.8rem] font-semibold">
                    <span>{formatVoteRate(voteRate)}</span>
                </div>
            </div>
        </div>
    );
}

export function PollNodeComponent({
    answerRevealed,
    allowAnonymousVote = true,
    correctOptionIds,
    createdAt,
    description,
    expiresAt,
    imageSrc,
    nodeKey,
    options,
    pollId,
    pollType = "single",
    publishedAt,
    selectedOptionIds,
    status,
    title,
    totalVotes,
    votingPaused = false,
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
    // Pause / Resume voting 切换中的 loading, 避免快速多次点击
    const [isTogglingPause, setIsTogglingPause] = React.useState(false);
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
    // 自定义票数草稿 (与 draftOptions 平行的 string[]; "" = 未设置)
    const [draftCustomVotes, setDraftCustomVotes] = React.useState(() =>
        options.map((option) =>
            option.customVoteCount === null || option.customVoteCount === undefined
                ? ""
                : String(option.customVoteCount),
        ),
    );
    // 是否允许配置自定义票数 (仅 admin/owner); null = 权限未知, 先不渲染输入框
    const [canManageSeedVotes, setCanManageSeedVotes] = React.useState(null);
    const seedPermissionFetchedRef = React.useRef(false);
    // 已在服务端设置过自定义票数的选项 id 集合 (锁定判定以服务端为准;
    // 不能用节点本地的 customVoteCount, 否则历史 poll 一输入就会被误判为锁定)
    const [lockedCustomVoteOptionIds, setLockedCustomVoteOptionIds] =
        React.useState(() => new Set());
    const [isEndDateInputActive, setIsEndDateInputActive] =
        React.useState(false);
    const [endDatePickerValue, setEndDatePickerValue] = React.useState(() =>
        createPickerValue(expiresAt),
    );
    const [showMediaFields, setShowMediaFields] = React.useState(
        Boolean(description || imageSrc),
    );
    const [showEndDateField, setShowEndDateField] = React.useState(
        Boolean(expiresAt),
    );
    const menuRef = React.useRef(null);
    const imageInputRef = React.useRef(null);
    const endDatePickerRef = React.useRef(null);
    const titleInputRef = React.useRef(null);
    const previewSyncPollIdRef = React.useRef(null);
    const imageUploader = fileUploader.useFileUpload("image") || {};
    const imageMimeTypes = fileUploader.fileTypes?.image?.mimeTypes || [
        "image/*",
    ];

    useAutoExpandTextArea({
        el: titleInputRef,
        value: draftTitle,
    });

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
        setEndDatePickerValue(createPickerValue(expiresAt));
    }, [expiresAt]);

    React.useEffect(() => {
        setDraftTitle(title);
    }, [title]);

    React.useEffect(() => {
        setDraftDescription(description);
    }, [description]);

    React.useEffect(() => {
        setDraftOptions(options.map((option) => option.text));
        setDraftCustomVotes(
            options.map((option) =>
                option.customVoteCount === null ||
                option.customVoteCount === undefined
                    ? ""
                    : String(option.customVoteCount),
            ),
        );
    }, [options]);

    // 编辑态首次渲染时查询一次权限, 决定是否显示自定义票数配置
    React.useEffect(() => {
        if (isEditing === false && Boolean(pollId) && status === "published") {
            return;
        }

        if (seedPermissionFetchedRef.current) {
            return;
        }

        seedPermissionFetchedRef.current = true;
        getAdminPollPermissions(cardConfig)
            .then((response) => {
                setCanManageSeedVotes(Boolean(response?.can_manage_seed_votes));
            })
            .catch(() => {
                setCanManageSeedVotes(false);
            });
    }, [cardConfig, isEditing, pollId, status]);

    // 编辑已创建的 poll 时 (如直接加载进编辑态, 没经过预览的 syncPollData),
    // 拉一次服务端数据初始化自定义票数的锁定集合
    React.useEffect(() => {
        if (!pollId || (Boolean(pollId) && status === "published" && !isEditing)) {
            return;
        }

        getAdminPoll(pollId, cardConfig)
            .then((poll) => {
                setLockedCustomVoteOptionIds(
                    new Set(
                        (poll?.options || [])
                            .filter(
                                (option) =>
                                    option.custom_vote_count !== null &&
                                    option.custom_vote_count !== undefined,
                            )
                            .map((option) => option.id),
                    ),
                );
            })
            .catch(() => {});
    }, [cardConfig, isEditing, pollId, status]);

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

    useClickOutside(isEndDateInputActive, endDatePickerRef, () => {
        setIsEndDateInputActive(false);
    });

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
                          allow_anonymous_vote:
                              fallback.allow_anonymous_vote ??
                              allowAnonymousVote,
                          expires_at: fallback.expires_at || expiresAt,
                          published_at: fallback.published_at || publishedAt,
                          created_at: fallback.created_at || createdAt,
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

            // 以服务端返回为准刷新"已设置自定义票数"的锁定集合
            if (pollResponse.status === "fulfilled") {
                setLockedCustomVoteOptionIds(
                    new Set(
                        (pollResponse.value?.options || [])
                            .filter(
                                (option) =>
                                    option.custom_vote_count !== null &&
                                    option.custom_vote_count !== undefined,
                            )
                            .map((option) => option.id),
                    ),
                );
            }

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
                    // 服务端返回的自定义票数 (仅 admin 可见); 有值 = 已设置且锁定
                    customVoteCount:
                        option.custom_vote_count ??
                        option.customVoteCount ??
                        null,
                };
            });

            updateNode((node) => {
                node.applyPollSnapshot({
                    pollId: poll.poll_id,
                    title: poll.title,
                    description: poll.description,
                    imageSrc: poll.image_src,
                    allowAnonymousVote: poll.allow_anonymous_vote,
                    expiresAt: poll.expires_at,
                    publishedAt: poll.published_at,
                    createdAt: poll.created_at,
                    pollType: poll.poll_type,
                    status: poll.status || fallback.status || "draft",
                    answerRevealed: poll.answer_revealed,
                    correctOptionIds: poll.correct_option_ids || [],
                    selectedOptionIds,
                    options: normalizedOptions,
                    totalVotes: votes.total_votes ?? fallback.total_votes ?? 0,
                });
            });

            return {poll, votes};
        },
        [
            answerRevealed,
            allowAnonymousVote,
            cardConfig,
            createdAt,
            correctOptionIds,
            description,
            expiresAt,
            imageSrc,
            options,
            publishedAt,
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

    const handleActivateEndDateInput = () => {
        setIsEndDateInputActive(true);
        setEndDatePickerValue(createPickerValue(expiresAt));
    };

    const handleEndDatePickerChange = (key, nextValue) => {
        setEndDatePickerValue((currentValue) =>
            normalizePickerValue({
                ...currentValue,
                [key]: Number(nextValue)
            }),
        );
    };

    const handleApplyEndDate = () => {
        updateNode((node) =>
            node.setExpiresAt(pickerValueToInputValue(endDatePickerValue)),
        );
        setIsEndDateInputActive(false);
    };

    const handleClearEndDate = () => {
        setShowEndDateField(false);
        setIsEndDateInputActive(false);
        setEndDatePickerValue(createPickerValue(""));
        updateNode((node) => node.setExpiresAt(""));
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

    // 自定义票数: 已设置过 (服务端已有值) 的选项锁定, 不可二次编辑;
    // 历史 poll 上尚未设置的选项依旧可以补设
    const isCustomVotesLocked = React.useCallback(
        (option) => Boolean(pollId) && lockedCustomVoteOptionIds.has(option.id),
        [pollId, lockedCustomVoteOptionIds],
    );

    const handleCustomVotesChange = (index, event) => {
        const rawValue = event.target.value;
        // 只允许空串或非负整数
        if (rawValue !== "" && !/^\d+$/.test(rawValue)) {
            return;
        }

        setDraftCustomVotes((currentValues) => {
            const nextValues = [...currentValues];
            nextValues[index] = rawValue;
            return nextValues;
        });

        const nextOptions = options.map((option, optionIndex) => {
            if (optionIndex !== index) {
                return option;
            }

            return {
                ...option,
                customVoteCount: rawValue === "" ? null : Number(rawValue),
            };
        });

        updateNode((node) => node.setOptions(nextOptions));
    };

    const handleAddOption = () => {
        if (pollId) {
            return;
        }

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
        if (pollId || options.length <= 2) {
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

    const handlePauseVoting = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setMenuOpen(false);
        if (!pollId || isTogglingPause || votingPaused || answerRevealed) {
            return;
        }
        setApiError("");
        setIsTogglingPause(true);
        try {
            await pauseAdminPollVoting(pollId, cardConfig);
            updateNode((node) => node.setVotingPaused(true));
        } catch (error) {
            setApiError(error.message || "Failed to pause poll");
        } finally {
            setIsTogglingPause(false);
        }
    };

    const handleResumeVoting = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setMenuOpen(false);
        if (!pollId || isTogglingPause || !votingPaused || answerRevealed) {
            return;
        }
        setApiError("");
        setIsTogglingPause(true);
        try {
            await resumeAdminPollVoting(pollId, cardConfig);
            updateNode((node) => node.setVotingPaused(false));
        } catch (error) {
            setApiError(error.message || "Failed to resume poll");
        } finally {
            setIsTogglingPause(false);
        }
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
        event.target.value = "";
    };

    const handleRemoveImage = () => {
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
        updateNode((node) => node.setImageSrc(""));
    };

    const handleSavePoll = async () => {
        const trimmedTitle = draftTitle.trim();
        const preparedOptions = options
            .map((option, index) => {
                const prepared = {
                    id: option.id || createOptionId(),
                    text: (draftOptions[index] ?? option.text ?? "").trim(),
                    sort_order: index,
                };

                // 自定义票数: 仅管理员、仅"本次新设置"的值才随 payload 提交;
                // 已锁定的选项不回传, 由服务端保留原值 (服务端也会强制拒绝修改).
                if (canManageSeedVotes && !isCustomVotesLocked(option)) {
                    const draftValue = draftCustomVotes[index] ?? "";
                    if (draftValue !== "") {
                        prepared.custom_vote_count = Number(draftValue);
                    }
                }

                return prepared;
            })
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

            if (Number.isNaN(expiresAtDate.getTime())) {
                setApiError("End date is invalid");
                return;
            }

            if (expiresAtDate.getTime() < Date.now()) {
                setApiError(
                    "End date must be later than the current time",
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
            allow_anonymous_vote: allowAnonymousVote,
            expires_at: toApiDateTime(expiresAt),
            poll_type: normalizedPollType,
            correct_option_ids: correctOptionIds,
            options: preparedOptions,
        };

        try {
            const saveResponse = await saveAdminPoll(payload, cardConfig);
            const nextPollId = saveResponse.poll_id || pollId;

            // 本次新提交的自定义票数立即锁定 (随后 syncPollData 会以服务端为准覆盖)
            const submittedSeedOptionIds = preparedOptions
                .filter((option) => option.custom_vote_count !== undefined)
                .map((option) => option.id);
            if (submittedSeedOptionIds.length > 0) {
                setLockedCustomVoteOptionIds((currentIds) => {
                    const nextIds = new Set(currentIds);
                    submittedSeedOptionIds.forEach((id) => nextIds.add(id));
                    return nextIds;
                });
            }

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
                    allowAnonymousVote,
                    expiresAt: payload.expires_at || "",
                    publishedAt,
                    createdAt,
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
                        // 乐观保留自定义票数, 保存瞬间锁定状态不闪跳; 随后由 syncPollData 以服务端为准覆盖
                        customVoteCount:
                            option.custom_vote_count ??
                            options.find((item) => item.id === option.id)?.customVoteCount ??
                            null,
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
    const isPollTypeLocked = isCreated;
    const isOptionsStructureLocked = isCreated;
    const isPublished = status === "published";
    const showPreview = isCreated && isPublished && !isEditing;
    const createButtonLabel = pollId ? "Update poll" : "Create poll";
    // 便捷派生: 是否已过期 / 是否可编辑其它字段
    const pollExpired = Boolean(expiresAt) && isExpired(expiresAt);
    // 已 reveal 或正在暂停投票 -> 其它字段不可再编辑 (Edit / Delete / Publish Results 按钮置灰)
    const canEditFields = !answerRevealed && !votingPaused;
    // 没设结束时间 → 直接可发布; 设了结束时间 → 必须等过期才能发布. 已 reveal 或暂停中不允许.
    const canPublishResults = (!expiresAt || pollExpired) && !answerRevealed && !votingPaused;
    // 只有已发布 & 未 reveal 才允许在 pause / resume 之间切换
    const canTogglePause = status === "published" && !answerRevealed;
    const yearOptions = React.useMemo(() => getYearOptions(), []);
    const dayOptions = React.useMemo(() => {
        const daysInMonth = getDaysInMonth(
            endDatePickerValue.year,
            endDatePickerValue.month,
        );

        return Array.from({length: daysInMonth}, (_, index) => index + 1);
    }, [endDatePickerValue.month, endDatePickerValue.year]);
    const hourOptions = React.useMemo(
        () => Array.from({length: 24}, (_, index) => index),
        [],
    );
    const minuteOptions = React.useMemo(
        () => Array.from({length: 60}, (_, index) => index),
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
            previewSyncPollIdRef.current = null;
            setTrendsResponse(null);
            return;
        }

        const isFirstSync = previewSyncPollIdRef.current !== pollId;

        const refresh = () => syncPollData(pollId)
            .then(({poll}) => {
                const lifecycleWindow = buildTrendsQueryWindow({
                    expiresAt: poll?.expires_at,
                    publishedAt: poll?.published_at,
                    createdAt: poll?.created_at,
                });

                return getAdminPollTrends(pollId, lifecycleWindow, cardConfig)
                    .then((response) => {
                        const hasPoints = Array.isArray(response?.points) && response.points.length > 0;
                        setTrendsResponse(hasPoints ? response : null);
                    });
            })
            .catch(() => {
                if (isFirstSync) {
                    setTrendsResponse(null);
                }
            });

        if (isFirstSync) {
            previewSyncPollIdRef.current = pollId;
            setTrendsResponse(null);
            refresh();
        }

        // 票数/走势随时间变化(如自定义票数按时间轴逐步生效), 预览态周期刷新
        const timer = setInterval(refresh, 10_000);
        return () => clearInterval(timer);
    }, [cardConfig, pollId, showPreview, syncPollData]);

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
                                {/* Edit / Delete / Publish Results:
                                    暂停中一律 disabled + 置灰 (但不隐藏, 让作者能明确看到有这些操作但当前不可用).
                                    已 reveal 时 Edit 依然隐藏 (发布后 poll 语义上不再可改). */}
                                {!answerRevealed && (
                                    <button
                                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition ${canEditFields ? "hover:bg-grey-100 cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                                        disabled={!canEditFields}
                                        type="button"
                                        onClick={canEditFields ? handleEditCard : undefined}
                                    >
                                        <EditIcon className="size-4" />
                                        <span>Edit</span>
                                    </button>
                                )}
                                <button
                                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition ${canEditFields ? "hover:bg-grey-100 cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                                    disabled={!canEditFields}
                                    type="button"
                                    onClick={canEditFields ? handleDeleteCard : undefined}
                                >
                                    <DeleteIcon className="size-4" />
                                    <span>Delete</span>
                                </button>
                                {/* Publish Results: 只在满足前置条件时才显示; 暂停中也置灰 (由 canPublishResults 内部包含 !votingPaused) */}
                                {(!expiresAt || pollExpired) && !answerRevealed && (
                                    <button
                                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition ${canPublishResults ? "hover:bg-grey-100 cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                                        disabled={!canPublishResults}
                                        type="button"
                                        onClick={canPublishResults ? handlePublishResult : undefined}
                                    >
                                        <ErifiedBadgeLineIcon className="size-4" />
                                        <span>Publish Results</span>
                                    </button>
                                )}
                                {/* Pause / Resume 是互斥的一对: 已发布 + 未 reveal 才展示;
                                    暂停中显示 "Resume poll", 正常状态显示 "Pause poll". */}
                                {canTogglePause && !votingPaused && (
                                    <button
                                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition ${isTogglingPause ? "opacity-40 cursor-not-allowed" : "hover:bg-grey-100 cursor-pointer"}`}
                                        disabled={isTogglingPause}
                                        type="button"
                                        onClick={handlePauseVoting}
                                    >
                                        <PauseIcon className="size-4" />
                                        <span>Pause poll</span>
                                    </button>
                                )}
                                {canTogglePause && votingPaused && (
                                    <button
                                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition ${isTogglingPause ? "opacity-40 cursor-not-allowed" : "hover:bg-grey-100 cursor-pointer"}`}
                                        disabled={isTogglingPause}
                                        type="button"
                                        onClick={handleResumeVoting}
                                    >
                                        <ResumeIcon className="size-4" />
                                        <span>Resume poll</span>
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
                  * - 桌面端 (sm 及以上): flex-row + items-stretch, 图表列和选项列等高;
                  *   PollTrendChart 内部用「顶部标签自然高度 + 剩余高度给绘图区」的方式分配空间
                  */}
                <div className="mt-7 flex flex-col gap-7 sm:flex-row sm:items-stretch sm:gap-8">
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
                        <div className="order-1 w-full sm:order-2 sm:min-w-0 sm:flex-[1.2] sm:self-stretch">
                            <PollTrendChart
                                activeIndex={resolvedActiveTrendIndex}
                                onActivateIndex={setActiveTrendIndex}
                                trendModel={trendModel}
                            />
                        </div>
                    )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 text-[1.55rem] text-[#878888]">
                    <div>{formatVoteCount(totalVotes)} Polls</div>
                    <div className="flex items-center gap-6">
                        {/*
                            右下角展示优先级 (从高到低):
                            1. 暂停中 -> 显示 TBD
                            2. 已过期 (或已 reveal) -> 只显示 "Ended", 不再展示日期
                            3. 未过期 -> 正常显示 结束日期
                        */}
                        {votingPaused ? (
                            <span className="rounded-md bg-white/8 px-2 py-1 text-[1.2rem] font-medium leading-none text-white/70">
                                TBD
                            </span>
                        ) : (pollExpired || answerRevealed) ? (
                            <span className="text-[#878888]">Ended</span>
                        ) : expiresAt ? (
                            <div className="flex items-center gap-2">
                                <ClockIcon className="size-4" />
                                <span>{formatDisplayDate(expiresAt)}</span>
                            </div>
                        ) : null}
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
                Poll
            </div>
            <div className="mt-4 border-t border-grey-200" />

            <textarea
                ref={titleInputRef}
                className="mt-4 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[2.7rem] leading-[1.3] text-grey-900 outline-none placeholder:text-grey-500"
                placeholder="Type your question here"
                rows={1}
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
                                    onClick={() => {
                                        if (imageInputRef.current) {
                                            imageInputRef.current.value = "";
                                        }

                                        openFileSelection({
                                            fileInputRef: imageInputRef,
                                        });
                                    }}
                                >
                                    <AddIcon className="size-6" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative inline-flex h-[120px] overflow-hidden rounded-[8px]">
                                <img
                                    alt="Poll cover preview"
                                    className="h-full w-[260px] object-cover"
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
                        {canManageSeedVotes === true && (
                            <input
                                className={`h-11 w-[110px] shrink-0 rounded-lg border border-grey-200 bg-transparent px-3 text-[1.5rem] outline-none placeholder:text-grey-400 ${isCustomVotesLocked(option) ? "cursor-not-allowed bg-grey-100 text-grey-500" : "text-grey-900"}`}
                                disabled={isCustomVotesLocked(option)}
                                inputMode="numeric"
                                placeholder="Base votes"
                                title={
                                    isCustomVotesLocked(option)
                                        ? "Custom votes are locked once set"
                                        : "Custom votes (optional, admin only, cannot be changed once set)"
                                }
                                type="text"
                                value={draftCustomVotes[index] ?? ""}
                                onChange={(event) =>
                                    handleCustomVotesChange(index, event)
                                }
                            />
                        )}
                        <button
                            className={`flex size-8 items-center justify-center rounded-full border-0 bg-transparent text-grey-500 transition ${!isOptionsStructureLocked && options.length > 2 ? "hover:text-grey-900" : "cursor-not-allowed opacity-40"}`}
                            disabled={isOptionsStructureLocked || options.length <= 2}
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                        >
                            <CloseIcon className="size-4 text-[#A6A6A6]" />
                        </button>
                    </div>
                ))}
            </div>

            <button
                className={`mt-4 flex w-fit items-center gap-2 border-0 bg-transparent p-0 text-[1.65rem] text-[#9FA0A4] transition ${isOptionsStructureLocked ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:text-grey-900"}`}
                disabled={isOptionsStructureLocked}
                type="button"
                onClick={handleAddOption}
            >
                <AddIcon className="size-4" />
                <span>Add option</span>
            </button>

            {isOptionsStructureLocked && (
                <div className="mt-2 text-[1.35rem] text-[#9FA0A4]">
                    Options can no longer be added or removed after the poll is created.
                </div>
            )}

            {canManageSeedVotes === true && (
                <div className="mt-2 text-[1.35rem] text-[#9FA0A4]">
                    Base votes are optional and added on top of real votes. Once set, they cannot be changed.
                </div>
            )}

            <div className="mt-4">
                <div className="mb-2 text-[1.45rem] font-medium text-[#9FA0A4]">
                    Poll type
                </div>
                <div className="relative flex items-center rounded-xl bg-white px-4 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                    <select
                        className={`h-11 w-full appearance-none border-0 bg-transparent pr-8 text-[1.65rem] text-grey-900 outline-none ${isPollTypeLocked ? "cursor-not-allowed text-grey-500" : "cursor-pointer"}`}
                        disabled={isPollTypeLocked}
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

            <div className="mt-4">
                <div className="mb-2 text-[1.45rem] font-medium text-[#9FA0A4]">
                    Poll settings
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                    <div>
                        <div className="text-[1.65rem] font-medium text-grey-900">
                            Allow anonymous
                        </div>
                        <div className="mt-1 text-[1.4rem] text-[#9FA0A4]">
                            Let people vote without showing their identity.
                        </div>
                    </div>
                    <Toggle
                        isChecked={allowAnonymousVote}
                        onChange={(event) =>
                            updateNode((node) =>
                                node.setAllowAnonymousVote(
                                    event.target.checked,
                                ),
                            )
                        }
                    />
                </label>
            </div>

            {!showEndDateField ? (
                <button
                    className="mt-10 flex w-fit items-center gap-2 border-0 bg-transparent p-0 text-[1.65rem] text-[#9FA0A4] transition hover:text-grey-900 cursor-pointer"
                    type="button"
                    onClick={() => {
                        setShowEndDateField(true);

                        requestAnimationFrame(() => {
                            handleActivateEndDateInput();
                        });
                    }}
                >
                    <AddIcon className="size-4" />
                    <span>Add end date</span>
                </button>
            ) : (
                <div className="mt-10">
                    <div className="mb-2 text-[1.45rem] text-[#9FA0A4]">
                        End date
                    </div>
                    <div
                        ref={endDatePickerRef}
                        className="relative rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
                    >
                        <button
                            className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-4 py-3 pr-14 text-left transition ${isEndDateInputActive ? "ring-1 ring-grey-900/10" : ""}`}
                            type="button"
                            onClick={handleActivateEndDateInput}
                        >
                            <span className={`text-[1.65rem] ${expiresAt ? "text-grey-900" : "text-[#9FA0A4]"}`}>
                                {formatEditorDateTime(expiresAt)}
                            </span>
                            <ClockIcon className="size-4 shrink-0 text-grey-500" />
                        </button>
                        <button
                            className="absolute right-3 top-1/2 flex size-8 !-translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent text-grey-500 transition hover:text-grey-900"
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleClearEndDate();
                            }}
                        >
                            <CloseIcon className="size-4 text-[#A6A6A6]" />
                        </button>

                        {isEndDateInputActive && (
                            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-xl border border-grey-200 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.14)]">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[1.3rem] font-medium uppercase tracking-[0.08em] text-[#9FA0A4]">
                                            Month
                                        </span>
                                        <PickerSelect
                                            value={endDatePickerValue.month}
                                            onChange={(event) => handleEndDatePickerChange("month", event.target.value)}
                                        >
                                            {MONTH_OPTIONS.map((monthOption) => (
                                                <option key={monthOption.value} value={monthOption.value}>
                                                    {monthOption.label}
                                                </option>
                                            ))}
                                        </PickerSelect>
                                    </label>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-[1.3rem] font-medium uppercase tracking-[0.08em] text-[#9FA0A4]">
                                            Day
                                        </span>
                                        <PickerSelect
                                            value={endDatePickerValue.day}
                                            onChange={(event) => handleEndDatePickerChange("day", event.target.value)}
                                        >
                                            {dayOptions.map(dayOption => (
                                                <option key={dayOption} value={dayOption}>
                                                    {dayOption}
                                                </option>
                                            ))}
                                        </PickerSelect>
                                    </label>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-[1.3rem] font-medium uppercase tracking-[0.08em] text-[#9FA0A4]">
                                            Year
                                        </span>
                                        <PickerSelect
                                            value={endDatePickerValue.year}
                                            onChange={(event) => handleEndDatePickerChange("year", event.target.value)}
                                        >
                                            {yearOptions.map(yearOption => (
                                                <option key={yearOption} value={yearOption}>
                                                    {yearOption}
                                                </option>
                                            ))}
                                        </PickerSelect>
                                    </label>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-[1.3rem] font-medium uppercase tracking-[0.08em] text-[#9FA0A4]">
                                            Hour
                                        </span>
                                        <PickerSelect
                                            value={endDatePickerValue.hour}
                                            onChange={(event) => handleEndDatePickerChange("hour", event.target.value)}
                                        >
                                            {hourOptions.map(hourOption => (
                                                <option key={hourOption} value={hourOption}>
                                                    {padTimeValue(hourOption)}
                                                </option>
                                            ))}
                                        </PickerSelect>
                                    </label>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-[1.3rem] font-medium uppercase tracking-[0.08em] text-[#9FA0A4]">
                                            Minute
                                        </span>
                                        <PickerSelect
                                            value={endDatePickerValue.minute}
                                            onChange={(event) => handleEndDatePickerChange("minute", event.target.value)}
                                        >
                                            {minuteOptions.map(minuteOption => (
                                                <option key={minuteOption} value={minuteOption}>
                                                    {padTimeValue(minuteOption)}
                                                </option>
                                            ))}
                                        </PickerSelect>
                                    </label>
                                </div>

                                <div className="mt-4 flex items-center justify-end gap-2">
                                    <button
                                        className="rounded-lg px-3 py-2 text-[1.45rem] font-medium text-[#9FA0A4] transition hover:bg-grey-100 hover:text-grey-900"
                                        type="button"
                                        onClick={handleClearEndDate}
                                    >
                                        Clear
                                    </button>
                                    <button
                                        className="rounded-lg bg-black px-4 py-2 text-[1.45rem] font-medium text-white transition hover:bg-grey-950"
                                        type="button"
                                        onClick={handleApplyEndDate}
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
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
