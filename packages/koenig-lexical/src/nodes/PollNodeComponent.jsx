import AddIcon from "../assets/icons/kg-add.svg?react";
import CardContext from "../context/CardContext";
import CloseIcon from "../assets/icons/kg-close.svg?react";
import DeleteIcon from "../assets/icons/kg-trash.svg?react";
import EditIcon from "../assets/icons/kg-edit.svg?react";
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
    getAdminPollVotes,
    publishAdminPoll,
    saveAdminPoll,
    unpublishAdminPoll,
} from "../utils/pollsApi.js";
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

function CheckIcon(props) {
    return (
        <svg fill="none" viewBox="0 0 16 16" {...props}>
            <circle cx="8" cy="8" fill="currentColor" r="8" />
            <path
                d="M5.1 8.1 7 10l3.9-4"
                stroke="#0D180F"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
            />
        </svg>
    );
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

function PollPreviewOption({
    answerRevealed,
    option,
    selectedOptionIds,
    totalVotes,
}) {
    const isCorrect =
        answerRevealed && selectedOptionIds.correct.has(option.id);
    const isSelected = selectedOptionIds.selected.has(option.id);
    const showFill = totalVotes > 0 && option.voteRate > 0;
    const fillWidth = `${Math.max(0, Math.min(option.voteRate || 0, 100))}%`;
    const fillClassName = isCorrect
        ? "bg-[#1B3B1F]"
        : isSelected
          ? "bg-white/12"
          : "bg-white/8";

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
                    className={`inline-flex min-h-11 items-center rounded-[12px] px-4 text-[1.85rem] font-semibold leading-none ${isSelected && !isCorrect ? "bg-white/12" : ""}`}
                >
                    {option.text}
                </div>
                <div className="flex items-center gap-3 text-[1.8rem] font-semibold">
                    {isCorrect && (
                        <CheckIcon className="size-6 text-[#59D14B]" />
                    )}
                    <span>{formatVoteRate(option.voteRate)}</span>
                </div>
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

        const payload = {
            ...(pollId ? { poll_id: pollId } : {}),
            title: trimmedTitle,
            description: draftDescription.trim(),
            image_src: imageSrc,
            expires_at: toApiDateTime(expiresAt),
            poll_type: "single",
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
    const minEndDateValue = React.useMemo(
        () => toDateTimeLocalValue(getMinimumEndDate().toISOString()),
        [],
    );

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
                            <div className="absolute right-0 top-14 w-44 rounded-xl bg-white p-2 text-grey-950 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition hover:bg-grey-100 cursor-pointer"
                                    type="button"
                                    onClick={handleEditCard}
                                >
                                    <EditIcon className="size-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.55rem] font-medium transition hover:bg-grey-100 cursor-pointer"
                                    type="button"
                                    onClick={handleDeleteCard}
                                >
                                    <DeleteIcon className="size-4" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                {description && (
                    <p className="mt-4 text-[1.8rem] leading-[1.45] text-white/55">
                        {description}
                    </p>
                )}

                <div className="mt-7 flex flex-col gap-5">
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

                <div className="mt-8 flex items-center justify-between gap-4 text-[1.55rem] text-white/42">
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
                className="mt-4 min-h-[30px] w-full resize-none border-0 bg-transparent p-0 text-[2.7rem] leading-[1.3] text-grey-900 outline-none placeholder:text-grey-500"
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
