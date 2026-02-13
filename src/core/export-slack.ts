import type { SlackMessage, RichTextBlock } from '../types/slack-api';
import type { MessageScope } from '../types/messages';
import { API_DELAY_MS } from '../shared/constants';
import { fetchMessages, fetchChannelInfo, fetchThreadReplies, fetchTeamInfo } from '../background/slack-api';
import { resolveUsers } from '../background/user-cache';
import { convertMessages } from '../background/markdown/converter';
import { buildSlackFrontmatter, buildFrontmatterFromTemplate } from '../background/markdown/frontmatter';
import type { FrontmatterContext } from '../background/markdown/frontmatter';
import { getActiveTemplate } from '../shared/template-storage';

export interface ProgressInfo {
  current: number;
  total?: number;
  phase: 'fetching' | 'resolving_users' | 'converting' | 'fetching_threads';
}

export interface ExportSlackOptions {
  channelId: string;
  scope: MessageScope;
  includeThreads: boolean;
  includeReactions: boolean;
  includeFiles: boolean;
  includeFrontmatter: boolean;
  onProgress?: (progress: ProgressInfo) => void;
}

export interface ExportSlackResult {
  markdown: string;
  messageCount: number;
}

export async function exportSlackChannel(
  options: ExportSlackOptions,
): Promise<ExportSlackResult> {
  // 1. Build fetch options from scope
  const fetchOpts: { limit?: number; oldest?: string; latest?: string } = {};
  if (options.scope.mode === 'last_n') {
    fetchOpts.limit = options.scope.count;
  } else if (options.scope.mode === 'date_range') {
    fetchOpts.oldest = String(options.scope.oldest);
    fetchOpts.latest = String(options.scope.latest);
  }

  // 2. Fetch messages
  options.onProgress?.({ current: 0, phase: 'fetching' });
  const messages = await fetchMessages(options.channelId, {
    ...fetchOpts,
    onPage: (pageNum) => options.onProgress?.({ current: pageNum, phase: 'fetching' }),
  });

  // 3. Collect all unique user IDs
  options.onProgress?.({ current: 0, phase: 'resolving_users' });
  const userIds = collectUserIds(messages);

  // 4. Resolve display names (batch, cached)
  const userMap = await resolveUsers(Array.from(userIds));

  // 5. Get channel info
  const channelInfo = await fetchChannelInfo(options.channelId);

  // 6. Fetch thread replies if requested
  let threadReplies: Record<string, SlackMessage[]> | undefined;
  if (options.includeThreads) {
    threadReplies = {};
    const threadParents = messages.filter(
      (m) => m.thread_ts === m.ts && m.reply_count && m.reply_count > 0,
    );

    options.onProgress?.({ current: 0, total: threadParents.length, phase: 'fetching_threads' });
    for (let i = 0; i < threadParents.length; i++) {
      const parent = threadParents[i];
      const replies = await fetchThreadReplies(options.channelId, parent.ts);
      threadReplies[parent.ts] = replies;

      // Collect user IDs from thread replies too
      for (const reply of replies) {
        if (reply.user) userIds.add(reply.user);
      }

      options.onProgress?.({
        current: i + 1,
        total: threadParents.length,
        phase: 'fetching_threads',
      });

      if (i < threadParents.length - 1) {
        await new Promise((r) => setTimeout(r, API_DELAY_MS));
      }
    }

    // Resolve any new user IDs from threads
    const allUserMap = await resolveUsers(Array.from(userIds));
    Object.assign(userMap, allUserMap);
  }

  // 7. Convert to markdown
  options.onProgress?.({ current: 0, phase: 'converting' });

  const markdown = convertMessages(messages, {
    channelName: channelInfo.name,
    userMap,
    includeReactions: options.includeReactions,
    includeFiles: options.includeFiles,
    includeThreadReplies: options.includeThreads,
    threadReplies,
    skipDocumentHeader: options.includeFrontmatter,
  });

  // 8. Prepend frontmatter if requested
  let finalMarkdown = markdown;
  if (options.includeFrontmatter) {
    let teamInfo = { name: '', domain: '' };
    try {
      teamInfo = await fetchTeamInfo();
    } catch {
      // team.info may fail for some workspaces; fall back to empty
    }

    const fmCtx: FrontmatterContext = {
      channel: channelInfo,
      workspaceName: teamInfo.name,
      workspaceDomain: teamInfo.domain,
      messages,
      messageCount: messages.length,
      scope: options.scope,
    };

    let frontmatter: string;
    try {
      const activeTemplate = await getActiveTemplate('slack');
      if (activeTemplate) {
        frontmatter = buildFrontmatterFromTemplate(activeTemplate, fmCtx);
      } else {
        frontmatter = buildSlackFrontmatter(fmCtx);
      }
    } catch {
      frontmatter = buildSlackFrontmatter(fmCtx);
    }

    finalMarkdown = frontmatter + '\n\n' + markdown;
  }

  return {
    markdown: finalMarkdown,
    messageCount: messages.length,
  };
}

function collectUserIds(messages: SlackMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (msg.user) ids.add(msg.user);
    if (msg.blocks) {
      for (const block of msg.blocks) {
        if (block.type === 'rich_text') {
          for (const el of (block as RichTextBlock).elements) {
            if ('elements' in el) {
              for (const inline of el.elements) {
                if (inline.type === 'user') ids.add(inline.user_id);
              }
            }
          }
        }
      }
    }
  }
  return ids;
}
