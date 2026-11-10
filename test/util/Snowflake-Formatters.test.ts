import { describe, expect, it } from 'vitest';
import * as F from '../../src/util/Formatters.js';
import { SnowflakeUtil } from '../../src/util/Snowflake.js';

describe('SnowflakeUtil', () => {
  it("uses Strafe's epoch (1288834974657), not Discord's", () => {
    expect(SnowflakeUtil.EPOCH).toBe(1288834974657);
    expect(SnowflakeUtil.timestampFrom('2102226824774811648')).toBe(1790044907169);
    expect(SnowflakeUtil.dateFrom('2102226824774811648').toISOString()).toBe('2026-09-22T02:41:47.169Z');
  });

  it('deconstructs and generates round trip', () => {
    const id = SnowflakeUtil.generate({ timestamp: 1790044907169, nodeId: 5, increment: 7 });
    const parts = SnowflakeUtil.deconstruct(id);
    expect(parts.timestamp).toBe(1790044907169);
    expect(parts.nodeId).toBe(5);
    expect(parts.increment).toBe(7);
    expect(parts.epoch).toBe(SnowflakeUtil.EPOCH);
    expect(SnowflakeUtil.timestampFrom(BigInt(id))).toBe(1790044907169);
    expect(SnowflakeUtil.generate({ timestamp: new Date(1790044907169) })).toMatch(/^\d+$/);
    expect(() => SnowflakeUtil.generate({ timestamp: 0 })).toThrow(RangeError);
  });

  it('compares and validates', () => {
    expect(SnowflakeUtil.compare('10', '9')).toBe(1);
    expect(SnowflakeUtil.compare('2102226824774811648', '2102226824774811649')).toBe(-1);
    expect(SnowflakeUtil.compare('5', '5')).toBe(0);
    expect(SnowflakeUtil.isSnowflake('2102226824774811648')).toBe(true);
    expect(SnowflakeUtil.isSnowflake('abc')).toBe(false);
    expect(SnowflakeUtil.isSnowflake(123)).toBe(false);
  });
});

describe('Formatters', () => {
  it('mentions', () => {
    expect(F.userMention('1')).toBe('<@1>');
    expect(F.roleMention('2')).toBe('<@&2>');
    expect(F.roomMention('3')).toBe('<#3>');
    expect(F.formatEmoji('4')).toBe('<:_:4>');
    expect(F.formatEmoji('4', true, 'wave')).toBe('<a:wave:4>');
    expect(F.formatEmoji({ id: '5', name: 'blob', animated: false })).toBe('<:blob:5>');
  });

  it('timestamps', () => {
    const date = new Date(1_790_044_907_169);
    expect(F.time(date)).toBe('<t:1790044907>');
    expect(F.time(date, F.TimestampStyles.RelativeTime)).toBe('<t:1790044907:R>');
    expect(F.time(1_790_044_907, 'F')).toBe('<t:1790044907:F>');
    expect(F.time()).toMatch(/^<t:\d+>$/);
  });

  it('markdown', () => {
    expect(F.bold('x')).toBe('**x**');
    expect(F.italic('x')).toBe('*x*');
    expect(F.underline('x')).toBe('__x__');
    expect(F.strikethrough('x')).toBe('~~x~~');
    expect(F.spoiler('x')).toBe('||x||');
    expect(F.inlineCode('x')).toBe('`x`');
    expect(F.codeBlock('x')).toBe('```\nx\n```');
    expect(F.codeBlock('ts', 'let a')).toBe('```ts\nlet a\n```');
    expect(F.quote('x')).toBe('> x');
    expect(F.blockQuote('a\nb')).toBe('> a\n> b');
    expect(F.heading('x', 2)).toBe('## x');
    expect(F.subtext('x')).toBe('-# x');
    expect(F.hyperlink('docs', 'https://strafe.chat')).toBe('[docs](https://strafe.chat)');
    expect(F.hyperlink('docs', new URL('https://strafe.chat/'), 'Strafe')).toBe('[docs](https://strafe.chat/ "Strafe")');
    expect(F.hideLinkEmbed('https://strafe.chat')).toBe('<https://strafe.chat>');
    expect(F.escapeMarkdown('*hi* _there_ `x` ||s|| > q')).toBe('\\*hi\\* \\_there\\_ \\`x\\` \\|\\|s\\|\\| \\> q');
    expect(F.Formatters.bold('y')).toBe('**y**');
  });

  it('escapeMentions defeats the server mention patterns', () => {
    const escaped = F.escapeMentions('hi <@123> <@!4> <@&5> @everyone and @here');
    // The server's patterns (messages/service.go).
    expect(/<@!?(\d+)>/.test(escaped)).toBe(false);
    expect(/<@&(\d+)>/.test(escaped)).toBe(false);
    expect(/(^|\W)@(everyone|here)(\W|$)/.test(escaped)).toBe(false);
    expect(escaped.replaceAll('\u200b', '')).toBe('hi <@123> <@!4> <@&5> @everyone and @here');
  });
});
