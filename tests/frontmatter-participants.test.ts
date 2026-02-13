import { describe, it, expect } from 'vitest';
import {
  buildSlackTemplateContext,
  buildFrontmatterFromTemplate,
  type FrontmatterContext,
} from '../src/background/markdown/frontmatter';
import type { FrontmatterTemplate } from '../src/shared/default-templates';
import type { ChannelInfo } from '../src/background/slack-api';

function makeChannel(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    id: 'C024BE91L',
    name: 'general',
    is_channel: true,
    is_group: false,
    is_im: false,
    is_mpim: false,
    ...overrides,
  };
}

function makeFmCtx(overrides: Partial<FrontmatterContext> = {}): FrontmatterContext {
  return {
    channel: makeChannel(),
    workspaceName: 'Acme',
    workspaceDomain: 'acme',
    messages: [{ type: 'message', ts: '1700000000.000000', text: 'hi' }],
    messageCount: 1,
    scope: { mode: 'last_n', count: 50 },
    ...overrides,
  };
}

describe('participants in template context', () => {
  it('includes participants when provided', () => {
    const ctx = makeFmCtx({ participants: ['Alice', 'Bob'] });
    const tc = buildSlackTemplateContext(ctx);
    expect(tc.participants).toEqual(['Alice', 'Bob']);
  });

  it('omits participants when undefined', () => {
    const ctx = makeFmCtx();
    const tc = buildSlackTemplateContext(ctx);
    expect(tc.participants).toBeUndefined();
  });

  it('omits participants when empty array', () => {
    const ctx = makeFmCtx({ participants: [] });
    const tc = buildSlackTemplateContext(ctx);
    expect(tc.participants).toBeUndefined();
  });

  it('resolves participants in template with join filter', () => {
    const template: FrontmatterTemplate = {
      name: 'test',
      enabled: true,
      category: 'slack',
      frontmatter: {
        channel: '{{channel}}',
        participants: '{{participants|join:", "}}',
      },
    };
    const ctx = makeFmCtx({
      channel: makeChannel({ is_im: true, is_channel: false, name: 'dm-test' }),
      participants: ['Alice', 'Bob', 'Charlie'],
    });

    const yaml = buildFrontmatterFromTemplate(template, ctx);
    expect(yaml).toContain('participants: "Alice, Bob, Charlie"');
  });

  it('renders empty participants as empty string when no members', () => {
    const template: FrontmatterTemplate = {
      name: 'test',
      enabled: true,
      category: 'slack',
      frontmatter: {
        channel: '{{channel}}',
        participants: '{{participants|join:", "}}',
      },
    };
    const ctx = makeFmCtx();

    const yaml = buildFrontmatterFromTemplate(template, ctx);
    // participants should be omitted (empty string → omitted by serializeFrontmatter)
    expect(yaml).not.toContain('participants');
  });

  it('skips participants for public channels', () => {
    const ctx = makeFmCtx({
      channel: makeChannel({ is_channel: true }),
      // No participants — channels don't get them
    });
    const tc = buildSlackTemplateContext(ctx);
    expect(tc.participants).toBeUndefined();
  });
});
