import {$createPollNode, PollNode} from '../../src/nodes/PollNode';
const {createHeadlessEditor} = require('@lexical/headless');

const editorNodes = [PollNode];

describe('PollNode', function () {
    let editor;
    let dataset;

    const editorTest = testFn => function () {
        let resolve, reject;
        const promise = new Promise((resolve_, reject_) => {
            resolve = resolve_;
            reject = reject_;
        });

        editor.update(() => {
            try {
                testFn();
                resolve();
            } catch (error) {
                reject(error);
            }
        });

        return promise;
    };

    beforeEach(function () {
        editor = createHeadlessEditor({nodes: editorNodes});
        dataset = {
            type: 'poll',
            version: 1,
            pollId: 'poll_123',
            title: 'Which release should we ship next?',
            description: 'Pick one option below.',
            imageSrc: 'https://example.com/poll-cover.jpg',
            allowAnonymousVote: true,
            expiresAt: '2026-05-16T09:00:00.000Z',
            publishedAt: '2026-05-15T09:00:00.000Z',
            createdAt: '2026-05-15T08:00:00.000Z',
            pollType: 'multiple',
            status: 'published',
            answerRevealed: false,
            correctOptionIds: [],
            selectedOptionIds: [],
            totalVotes: 12,
            options: [
                {
                    id: 'opt_1',
                    text: 'Alpha',
                    voteCount: 7,
                    voteRate: 58.33,
                    sortOrder: 0
                },
                {
                    id: 'opt_2',
                    text: 'Beta',
                    voteCount: 5,
                    voteRate: 41.67,
                    sortOrder: 1
                }
            ]
        };
    });

    it('exports allowAnonymousVote via exportJSON()', editorTest(function () {
        const pollNode = $createPollNode(dataset);
        const json = pollNode.exportJSON();

        expect(json.allowAnonymousVote).toBe(true);
        expect(json.pollType).toBe('multiple');
        expect(json.options).toHaveLength(2);
    }));

    it('reads allow_anonymous_vote from API-shaped data', editorTest(function () {
        const pollNode = $createPollNode({
            ...dataset,
            allowAnonymousVote: undefined,
            allow_anonymous_vote: true,
            pollType: undefined,
            poll_type: 'single'
        });

        expect(pollNode.allowAnonymousVote).toBe(true);
        expect(pollNode.pollType).toBe('single');
    }));

    it('defaults allowAnonymousVote to true', editorTest(function () {
        const pollNode = $createPollNode({
            ...dataset,
            allowAnonymousVote: undefined,
            allow_anonymous_vote: undefined
        });

        expect(pollNode.allowAnonymousVote).toBe(true);
    }));
});
