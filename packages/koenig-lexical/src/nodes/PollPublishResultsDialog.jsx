import React from "react";

function DialogCheckSelectedIcon(props) {
    return (
        <svg fill="none" viewBox="0 0 24 24" {...props}>
            <circle cx="12" cy="12" fill="#22C55E" r="11" />
            <path
                d="M7.5 12 L10.5 15 L16.5 9"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
            />
        </svg>
    );
}

function DialogCheckUnselectedIcon(props) {
    return (
        <svg fill="none" viewBox="0 0 24 24" {...props}>
            <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.6" />
        </svg>
    );
}

function DialogCloseIcon(props) {
    return (
        <svg fill="none" viewBox="0 0 24 24" {...props}>
            <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
            />
        </svg>
    );
}

/**
 * 「Publish results」弹窗.
 *
 * Props:
 *   onClose                () => void              点 X / 点遮罩 / Esc 触发
 *   onSubmit               (selectedIds[]) => any  点 Publish 触发, 可返回 Promise
 *   options                [{id, text}]            可选答案列表 (来自 poll.options)
 *   pollType               'single' | 'multiple'      决定能否多选
 *   title                  string                  弹窗顶部展示的问题文本
 *   initialSelectedIds     string[]                可选, 默认勾选项
 *   isSubmitting           boolean                 Publish 按钮 loading 态
 *   error                  string                  接口报错文案
 */
export function PollPublishResultsDialog({
    error = "",
    initialSelectedIds = [],
    isSubmitting = false,
    onClose,
    onSubmit,
    options = [],
    pollType = "single",
    title,
}) {
    const dialogRef = React.useRef(null);
    const [selectedIds, setSelectedIds] = React.useState(
        () => new Set(initialSelectedIds || []),
    );

    React.useEffect(() => {
        const handleKey = (event) => {
            if (event.key === "Escape") {
                onClose?.();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const isMulti = pollType === "multiple";

    const toggleOption = (optionId) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (isMulti) {
                if (next.has(optionId)) {
                    next.delete(optionId);
                } else {
                    next.add(optionId);
                }
                return next;
            }
            // 单选: 点选中态就清空, 否则只保留当前
            if (next.has(optionId)) {
                next.delete(optionId);
                return next;
            }
            return new Set([optionId]);
        });
    };

    const handleSubmit = () => {
        if (isSubmitting || selectedIds.size === 0) {
            return;
        }
        onSubmit?.(Array.from(selectedIds));
    };

    const handleOverlayClick = (event) => {
        if (dialogRef.current && !dialogRef.current.contains(event.target)) {
            onClose?.();
        }
    };

    return (
        <div
            className="not-kg-prose fixed inset-0 z-[1000] flex items-center justify-center p-6 font-sans"
            data-kg-allow-clickthrough="false"
            role="dialog"
            aria-modal="true"
            aria-label="Publish results"
            onClick={handleOverlayClick}
            onMouseDown={(event) => event.stopPropagation()}
        >
            <div
                ref={dialogRef}
                className="w-full max-w-[520px] rounded-2xl bg-white p-8 text-grey-950 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <h3 className="m-0 text-[2rem] font-semibold leading-none">
                        Publish results
                    </h3>
                    <button
                        aria-label="Close"
                        className="-mr-1 -mt-1 flex size-8 items-center justify-center rounded-full border-0 bg-transparent text-grey-700 transition hover:text-grey-950 cursor-pointer"
                        type="button"
                        onClick={onClose}
                    >
                        <DialogCloseIcon className="size-5" />
                    </button>
                </div>

                <div className="mt-7 text-[1.45rem] font-medium text-[#9FA0A4]">
                    Question
                </div>
                <div className="mt-2 text-[2.4rem] font-semibold leading-[1.3]">
                    {title || "Untitled poll"}
                </div>

                <div className="mt-7 text-[1.45rem] font-medium text-[#9FA0A4]">
                    Results
                </div>
                <div className="mt-3 flex flex-col gap-2">
                    {options.map((option) => {
                        const isSelected = selectedIds.has(option.id);
                        return (
                            <button
                                key={option.id}
                                aria-pressed={isSelected}
                                className="flex items-center gap-3 rounded-lg border-0 bg-transparent px-1 py-2 text-left text-[1.7rem] text-grey-950 transition hover:bg-grey-100 cursor-pointer"
                                type="button"
                                onClick={() => toggleOption(option.id)}
                            >
                                {isSelected ? (
                                    <DialogCheckSelectedIcon className="size-6 shrink-0" />
                                ) : (
                                    <DialogCheckUnselectedIcon className="size-6 shrink-0 text-grey-400" />
                                )}
                                <span>{option.text}</span>
                            </button>
                        );
                    })}
                </div>

                {error && (
                    <div className="mt-5 rounded-xl border border-red/20 bg-red/5 px-4 py-3 text-[1.45rem] text-red">
                        {error}
                    </div>
                )}

                <button
                    className="mt-8 flex h-10 w-fit items-center justify-center rounded-lg border-0 bg-black px-6 text-[1.7rem] font-medium text-white transition hover:bg-grey-950 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    disabled={isSubmitting || selectedIds.size === 0}
                    type="button"
                    onClick={handleSubmit}
                >
                    {isSubmitting ? "Publishing..." : "Publish"}
                </button>
            </div>
        </div>
    );
}
