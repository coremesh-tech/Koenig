import KoenigCardWrapper from '../components/KoenigCardWrapper';
import PollCardIcon from '../assets/icons/kg-card-type-poll.svg?react';
import React from 'react';
import {KoenigDecoratorNode} from '@tryghost/kg-default-nodes';
import {PollNodeComponent} from './PollNodeComponent';
import {createCommand} from 'lexical';

export const INSERT_POLL_COMMAND = createCommand();

function createOptionId() {
    const uuid = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10);
    return `opt_${uuid.replace(/-/g, '').slice(0, 8)}`;
}

function cloneOption(option = {}, index = 0) {
    return {
        id: typeof option.id === 'string' && option.id.trim() ? option.id.trim() : createOptionId(),
        text: typeof option.text === 'string' ? option.text : '',
        voteCount: Number(option.voteCount ?? option.vote_count ?? 0),
        voteRate: Number(option.voteRate ?? option.vote_rate ?? 0),
        sortOrder: Number(option.sortOrder ?? option.sort_order ?? index)
    };
}

function sanitizeOptions(options = []) {
    if (!Array.isArray(options) || options.length === 0) {
        return [
            cloneOption({text: ''}, 0),
            cloneOption({text: ''}, 1)
        ];
    }

    return options.map((option, index) => cloneOption(option, index));
}

function cloneStringArray(values = []) {
    if (!Array.isArray(values)) {
        return [];
    }

    return values.filter(Boolean).map(value => `${value}`);
}

export class PollNode extends KoenigDecoratorNode {
    __pollId;
    __title;
    __description;
    __imageSrc;
    __allowAnonymousVote;
    __expiresAt;
    __publishedAt;
    __createdAt;
    __pollType;
    __status;
    __answerRevealed;
    __correctOptionIds;
    __selectedOptionIds;
    __options;
    __totalVotes;

    static kgMenu = {
        label: 'Poll',
        desc: 'Create an interactive poll',
        Icon: PollCardIcon,
        insertCommand: INSERT_POLL_COMMAND,
        matches: ['poll', 'vote', 'survey'],
        priority: 17,
        shortcut: '/poll'
    };

    static getType() {
        return 'poll';
    }

    static clone(node) {
        return new PollNode(node.getDataset(), node.__key);
    }

    static importJSON(serializedNode) {
        return new PollNode(serializedNode);
    }

    constructor(dataset = {}, key) {
        super(key);

        this.__pollId = dataset.pollId || dataset.poll_id || '';
        this.__title = dataset.title || '';
        this.__description = dataset.description || '';
        this.__imageSrc = dataset.imageSrc || dataset.image_src || '';
        this.__allowAnonymousVote = Boolean(dataset.allowAnonymousVote ?? dataset.allow_anonymous_vote ?? true);
        this.__expiresAt = dataset.expiresAt || dataset.expires_at || '';
        this.__publishedAt = dataset.publishedAt || dataset.published_at || '';
        this.__createdAt = dataset.createdAt || dataset.created_at || '';
        // 兼容历史值 'multi' → 'multiple'
        {
            const rawPollType = dataset.pollType || dataset.poll_type || 'single';
            this.__pollType = (rawPollType === 'multiple' || rawPollType === 'multi') ? 'multiple' : 'single';
        }
        this.__status = dataset.status || 'draft';
        this.__answerRevealed = Boolean(dataset.answerRevealed ?? dataset.answer_revealed ?? false);
        this.__correctOptionIds = cloneStringArray(dataset.correctOptionIds || dataset.correct_option_ids || []);
        this.__selectedOptionIds = cloneStringArray(dataset.selectedOptionIds || dataset.selected_option_ids || []);
        this.__options = sanitizeOptions(dataset.options);
        this.__totalVotes = Number(dataset.totalVotes ?? dataset.total_votes ?? 0);
    }

    createDOM() {
        return document.createElement('div');
    }

    updateDOM() {
        return false;
    }

    exportDOM() {
        const element = document.createElement('div');
        element.setAttribute('data-kg-poll-card', 'true');

        if (this.pollId) {
            element.setAttribute('data-poll-id', this.pollId);
        }

        return {element};
    }

    hasEditMode() {
        return true;
    }

    getIsVisibilityActive() {
        return false;
    }

    getIcon() {
        return PollCardIcon;
    }

    get pollId() {
        return this.getLatest().__pollId;
    }

    get title() {
        return this.getLatest().__title;
    }

    get description() {
        return this.getLatest().__description;
    }

    get imageSrc() {
        return this.getLatest().__imageSrc;
    }

    get allowAnonymousVote() {
        return Boolean(this.getLatest().__allowAnonymousVote);
    }

    get expiresAt() {
        return this.getLatest().__expiresAt;
    }

    get publishedAt() {
        return this.getLatest().__publishedAt;
    }

    get createdAt() {
        return this.getLatest().__createdAt;
    }

    get pollType() {
        return this.getLatest().__pollType;
    }

    get status() {
        return this.getLatest().__status;
    }

    get answerRevealed() {
        return this.getLatest().__answerRevealed;
    }

    get correctOptionIds() {
        return cloneStringArray(this.getLatest().__correctOptionIds);
    }

    get selectedOptionIds() {
        return cloneStringArray(this.getLatest().__selectedOptionIds);
    }

    get options() {
        return sanitizeOptions(this.getLatest().__options);
    }

    get totalVotes() {
        return Number(this.getLatest().__totalVotes || 0);
    }

    setTitle(value = '') {
        this.getWritable().__title = value;
    }

    setDescription(value = '') {
        this.getWritable().__description = value;
    }

    setImageSrc(value = '') {
        this.getWritable().__imageSrc = value;
    }

    setAllowAnonymousVote(value = true) {
        this.getWritable().__allowAnonymousVote = Boolean(value);
    }

    setExpiresAt(value = '') {
        this.getWritable().__expiresAt = value;
    }

    setPublishedAt(value = '') {
        this.getWritable().__publishedAt = value;
    }

    setCreatedAt(value = '') {
        this.getWritable().__createdAt = value;
    }

    setOptions(options = []) {
        this.getWritable().__options = sanitizeOptions(options);
    }

    setStatus(status = 'draft') {
        this.getWritable().__status = status;
    }

    setPollType(pollType = 'single') {
        this.getWritable().__pollType = pollType === 'multiple' ? 'multiple' : 'single';
    }

    setPollId(pollId = '') {
        this.getWritable().__pollId = pollId;
    }

    setAnswerRevealed(answerRevealed = false) {
        this.getWritable().__answerRevealed = Boolean(answerRevealed);
    }

    setCorrectOptionIds(optionIds = []) {
        this.getWritable().__correctOptionIds = cloneStringArray(optionIds);
    }

    setSelectedOptionIds(optionIds = []) {
        this.getWritable().__selectedOptionIds = cloneStringArray(optionIds);
    }

    setTotalVotes(totalVotes = 0) {
        this.getWritable().__totalVotes = Number(totalVotes || 0);
    }

    applyPollSnapshot({
        pollId,
        title,
        description,
        imageSrc,
        allowAnonymousVote,
        expiresAt,
        publishedAt,
        createdAt,
        pollType,
        status,
        answerRevealed,
        correctOptionIds,
        selectedOptionIds,
        options,
        totalVotes
    }) {
        const writable = this.getWritable();
        writable.__pollId = pollId ?? writable.__pollId;
        writable.__title = title ?? writable.__title;
        writable.__description = description ?? writable.__description;
        writable.__imageSrc = imageSrc ?? writable.__imageSrc;
        writable.__allowAnonymousVote = Boolean(allowAnonymousVote ?? writable.__allowAnonymousVote);
        writable.__expiresAt = expiresAt ?? writable.__expiresAt;
        writable.__publishedAt = publishedAt ?? writable.__publishedAt;
        writable.__createdAt = createdAt ?? writable.__createdAt;
        writable.__pollType = pollType ?? writable.__pollType;
        writable.__status = status ?? writable.__status;
        writable.__answerRevealed = Boolean(answerRevealed ?? writable.__answerRevealed);
        writable.__correctOptionIds = cloneStringArray(correctOptionIds ?? writable.__correctOptionIds);
        writable.__selectedOptionIds = cloneStringArray(selectedOptionIds ?? writable.__selectedOptionIds);
        writable.__options = sanitizeOptions(options ?? writable.__options);
        writable.__totalVotes = Number(totalVotes ?? writable.__totalVotes ?? 0);
    }

    getDataset() {
        return {
            pollId: this.pollId,
            title: this.title,
            description: this.description,
            imageSrc: this.imageSrc,
            allowAnonymousVote: this.allowAnonymousVote,
            expiresAt: this.expiresAt,
            publishedAt: this.publishedAt,
            createdAt: this.createdAt,
            pollType: this.pollType,
            status: this.status,
            answerRevealed: this.answerRevealed,
            correctOptionIds: this.correctOptionIds,
            selectedOptionIds: this.selectedOptionIds,
            options: this.options,
            totalVotes: this.totalVotes
        };
    }

    exportJSON() {
        return {
            type: 'poll',
            version: 1,
            ...this.getDataset()
        };
    }

    isEmpty() {
        return false;
    }

    decorate() {
        return (
            <KoenigCardWrapper nodeKey={this.getKey()}>
                <PollNodeComponent
                    answerRevealed={this.answerRevealed}
                    correctOptionIds={this.correctOptionIds}
                    description={this.description}
                    expiresAt={this.expiresAt}
                    allowAnonymousVote={this.allowAnonymousVote}
                    publishedAt={this.publishedAt}
                    createdAt={this.createdAt}
                    imageSrc={this.imageSrc}
                    nodeKey={this.getKey()}
                    options={this.options}
                    pollId={this.pollId}
                    pollType={this.pollType}
                    selectedOptionIds={this.selectedOptionIds}
                    status={this.status}
                    title={this.title}
                    totalVotes={this.totalVotes}
                />
            </KoenigCardWrapper>
        );
    }
}

export function $createPollNode(dataset) {
    return new PollNode(dataset);
}

export function $isPollNode(node) {
    return node instanceof PollNode;
}
