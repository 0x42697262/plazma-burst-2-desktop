import type { Rule } from 'eslint';
import { ALLOWED_COMMENT_PATTERNS, MESSAGE_ID } from './constants.ts';
import { TEXT } from './text.ts';

const isAllowedComment = (value: string): boolean => ALLOWED_COMMENT_PATTERNS.some((pattern) => pattern.test(value));

export const noComments: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: { description: TEXT.noCommentsDescription },
    messages: { [MESSAGE_ID.comment]: TEXT.noCommentsMessage },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isAllowedComment(comment.value) || !comment.loc) continue;
          context.report({ loc: comment.loc, messageId: MESSAGE_ID.comment });
        }
      },
    };
  },
};
