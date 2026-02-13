/** A user-configurable frontmatter template */
export interface FrontmatterTemplate {
  name: string;
  enabled: boolean;
  category: 'slack' | 'web';
  frontmatter: Record<string, string | string[]>;
}

/** Map of template IDs to template definitions */
export type TemplateStore = Record<string, FrontmatterTemplate>;

/** Built-in default templates. Used on first run and for "Reset to Defaults". */
export const DEFAULT_TEMPLATES: TemplateStore = {
  slack_default: {
    name: 'Slack Default',
    enabled: true,
    category: 'slack',
    frontmatter: {
      title: '{{channel}}',
      source: '{{source_category}}',
      source_url: '{{source_url}}',
      workspace: '{{workspace}}',
      channel: '{{channel}}',
      channel_type: '{{channel_type}}',
      captured: '{{captured|date:"YYYY-MM-DDTHH:mm:ssZ"}}',
      date_range: '{{date_range}}',
      message_count: '{{message_count}}',
      tags: ['slack'],
    },
  },
  slack_detailed: {
    name: 'Slack Detailed',
    enabled: false,
    category: 'slack',
    frontmatter: {
      title: '{{channel}}',
      source: '{{source_category}}',
      source_url: '{{source_url}}',
      workspace: '{{workspace}}',
      channel: '{{channel}}',
      channel_type: '{{channel_type}}',
      topic: '{{topic}}',
      purpose: '{{purpose}}',
      participants: '{{participants|join:", "}}',
      captured: '{{captured|date:"YYYY-MM-DDTHH:mm:ssZ"}}',
      date_range: '{{date_range}}',
      message_count: '{{message_count}}',
      export_scope: '{{export_scope}}',
      tags: ['slack', '{{workspace|lowercase|slug}}'],
    },
  },
  web_default: {
    name: 'Web Clip Default',
    enabled: true,
    category: 'web',
    frontmatter: {
      title: '{{title}}',
      source: '{{source_category}}',
      source_url: '{{source_url}}',
      author: '{{author}}',
      published: '{{published|date:"YYYY-MM-DD"}}',
      captured: '{{captured|date:"YYYY-MM-DDTHH:mm:ssZ"}}',
      tags: ['web-clip'],
    },
  },
};

/** IDs of built-in templates (cannot be deleted, only reset) */
export const BUILTIN_TEMPLATE_IDS = new Set(Object.keys(DEFAULT_TEMPLATES));
