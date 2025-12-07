/**
 * Mind verify command - checks platform services readiness
 */

import { defineCommand, usePlatform } from '@kb-labs/shared-command-kit';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events';

type MindVerifyFlags = {
  json: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

type ServiceStatus = {
  service: string;
  required: boolean;
  available: boolean;
  configured: boolean;
  message?: string;
};

export const run = defineCommand({
  name: 'mind:verify',
  flags: {
    json: {
      type: 'boolean',
      description: 'Output in JSON format',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet output',
      default: false,
    },
  },
  analytics: {
    startEvent: ANALYTICS_EVENTS.VERIFY_STARTED,
    finishEvent: ANALYTICS_EVENTS.VERIFY_FINISHED,
    actor: ANALYTICS_ACTOR.id,
  },
  async handler(ctx: any, argv: string[], flags: any) {
    ctx.tracker.checkpoint('start');

    // Use global platform singleton (clean approach with usePlatform helper)
    const platform = usePlatform();
    const services: ServiceStatus[] = [];

    if (!platform) {
      const result = {
        ok: false,
        services,
        issues: ['platform context is missing'],
        meta: { timingMs: ctx.tracker.total() },
      };
      if (flags.json) {
        ctx.output?.json(result);
      } else {
        ctx.output?.error('Platform services are not available in this context');
      }
      return 1;
    }

    const check = (
      name: string,
      required: boolean,
      available: boolean,
      configured: boolean,
      message?: string,
    ) => {
      services.push({ service: name, required, available, configured, message });
    };

    const has = (key: keyof typeof platform) => Boolean((platform as any)[key]);
    const isConfigured = (svc: string) => platform.isConfigured?.(svc) ?? has(svc as any);

    check('vectorStore', true, has('vectorStore'), isConfigured('vectorStore'));
    check('embeddings', true, has('embeddings'), isConfigured('embeddings'));
    check('llm', false, has('llm'), isConfigured('llm'));
    check('cache', false, has('cache'), true);
    check('storage', false, has('storage'), true);
    check('analytics', false, has('analytics'), true);

    const requiredOk = services.filter(s => s.required).every(s => s.available && s.configured);
    const issues = services
      .filter(s => s.required && (!s.available || !s.configured))
      .map(s => `${s.service} is missing or not configured`);

    ctx.tracker.checkpoint('verify-complete');

    const result = {
      ok: requiredOk,
      services,
      issues,
      meta: { timingMs: ctx.tracker.total() },
    };

    if (flags.json) {
      ctx.output?.json(result);
    } else if (!flags.quiet) {
      const { ui } = ctx.output!;
      const sections = [
        {
          header: 'Services',
          items: services.map(s => {
            const status = s.available && s.configured ? ui.symbols.success : ui.symbols.warning;
            return `${status} ${s.service}: ${s.available ? 'available' : 'missing'}${s.configured ? '' : ' (not configured)'}`;
          }),
        },
      ];
      if (issues.length) {
        sections.push({
          header: 'Issues',
          items: issues.map(i => `${ui.symbols.warning} ${i}`),
        });
      }
      const outputText = ui.sideBox({
        title: 'Mind Verify - Platform',
        sections,
        status: requiredOk ? 'success' : 'warning',
        timing: ctx.tracker.total(),
      });
      ctx.output?.write(outputText);
    }

    return requiredOk ? 0 : 1;
  },
});
