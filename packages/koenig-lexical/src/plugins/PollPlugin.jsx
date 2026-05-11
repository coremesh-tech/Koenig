import React from 'react';
import {$createPollNode, INSERT_POLL_COMMAND, PollNode} from '../nodes/PollNode';
import {COMMAND_PRIORITY_LOW} from 'lexical';
import {INSERT_CARD_COMMAND} from './KoenigBehaviourPlugin';
import {mergeRegister} from '@lexical/utils';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';

export const PollPlugin = () => {
    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        if (!editor.hasNodes([PollNode])) {
            console.error('PollPlugin: PollNode not registered'); // eslint-disable-line no-console
            return;
        }

        return mergeRegister(
            editor.registerCommand(
                INSERT_POLL_COMMAND,
                async (dataset) => {
                    const cardNode = $createPollNode(dataset);
                    editor.dispatchCommand(INSERT_CARD_COMMAND, {cardNode, openInEditMode: true});

                    return true;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor]);

    return null;
};

export default PollPlugin;
