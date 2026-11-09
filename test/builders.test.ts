import { describe, expect, it } from 'vitest';
import { AttachmentBuilder } from '../src/builders/AttachmentBuilder.js';
import { Colors, resolveColor } from '../src/builders/Colors.js';
import { EmbedBuilder, validateEmbeds } from '../src/builders/EmbedBuilder.js';
import { ErrorCodes } from '../src/errors/ErrorCodes.js';
import { StrafeRangeError } from '../src/errors/StrafeError.js';
import { Embed } from '../src/structures/Embed.js';
import { LimitedCollection, Options } from '../src/util/Options.js';

function embedError(fn: () => unknown): StrafeRangeError {
  try {
    fn();
  } catch (error) {
    if (error instanceof StrafeRangeError) return error;
    throw error;
  }
  throw new Error('expected an EmbedInvalid error');
}

describe('EmbedBuilder', () => {
  it('builds the wire form with discord.js setters', () => {
    const embed = new EmbedBuilder()
      .setTitle('Status')
      .setDescription('All good')
      .setURL('https://example.com')
      .setColor('Green')
      .setAuthor({ name: 'Bot', iconURL: 'attachment://icon.png', url: 'https://example.com/bot' })
      .setFooter({ text: 'footer', iconURL: 'https://example.com/f.png' })
      .setImage('attachment://chart.png')
      .setThumbnail('https://example.com/t.png')
      .setTimestamp(0)
      .addFields({ name: 'a', value: '1', inline: true }, { name: 'b', value: '2' });
    expect(embed.toJSON()).toEqual({
      title: 'Status',
      description: 'All good',
      url: 'https://example.com',
      color: Colors.Green,
      author: { name: 'Bot', icon_url: 'attachment://icon.png', url: 'https://example.com/bot' },
      footer: { text: 'footer', icon_url: 'https://example.com/f.png' },
      image: { url: 'attachment://chart.png' },
      thumbnail: { url: 'https://example.com/t.png' },
      timestamp: '1970-01-01T00:00:00.000Z',
      fields: [
        { name: 'a', value: '1', inline: true },
        { name: 'b', value: '2' },
      ],
    });
    expect(embed.setTitle(null).setColor(null).toJSON().title).toBeUndefined();
  });

  it('accepts camelCase EmbedData and copies received embeds', () => {
    const fromData = new EmbedBuilder({ title: 't', footer: { text: 'f', iconURL: 'https://x.test/i.png' }, timestamp: new Date(0) });
    expect(fromData.data.footer).toEqual({ text: 'f', icon_url: 'https://x.test/i.png' });
    expect(fromData.data.timestamp).toBe('1970-01-01T00:00:00.000Z');
    const received = new Embed({ type: 'rich', title: 'x', image: { url: 'https://a.test/i.png', proxy_url: 'https://h/api/media/v1/x' } });
    const copy = EmbedBuilder.from(received).setDescription('d');
    expect(copy.data.title).toBe('x');
    expect(received.description).toBeNull();
    expect(received.image?.proxyURL).toBe('https://h/api/media/v1/x');
  });

  it('counts code points, like the server', () => {
    // 256 emoji are 512 UTF-16 units but 256 code points: allowed.
    expect(() => new EmbedBuilder().setTitle('😀'.repeat(256))).not.toThrow();
    const error = embedError(() => new EmbedBuilder().setTitle('😀'.repeat(257)));
    expect(error.code).toBe(ErrorCodes.EmbedInvalid);
    expect(error.path).toBe('title');
    expect(error.message).toBe('title: can be at most 256 characters');
  });

  it('checks URLs, fields and empty embeds', () => {
    expect(embedError(() => new EmbedBuilder().setURL('attachment://x.png')).path).toBe('url');
    expect(embedError(() => new EmbedBuilder().setImage('ftp://x.test/a.png')).path).toBe('image.url');
    expect(embedError(() => new EmbedBuilder().setThumbnail('https://user:pw@x.test/a.png')).message).toMatch(/username or password/);
    expect(embedError(() => new EmbedBuilder().addFields({ name: '', value: 'v' })).path).toBe('fields[0].name');
    const many = Array.from({ length: 26 }, (_, i) => ({ name: `n${i}`, value: 'v' }));
    expect(embedError(() => new EmbedBuilder().addFields(many)).path).toBe('fields');
    expect(embedError(() => new EmbedBuilder().toJSON()).message).toMatch(/nothing to show/);
    expect(new EmbedBuilder().setFields([{ name: 'x', value: 'y' }]).spliceFields(0, 1).data.fields).toEqual([]);
  });

  it('checks a whole message: 10 embeds and 6000 characters', () => {
    const big = { description: 'x'.repeat(4000) };
    expect(embedError(() => validateEmbeds([big, big])).message).toMatch(/total at most 6000/);
    expect(embedError(() => validateEmbeds(Array.from({ length: 11 }, () => ({ title: 't' })))).path).toBe('embeds');
    expect(embedError(() => validateEmbeds([{ title: 't' }, { color: 1.5, title: 't' }])).path).toBe('embeds[1].color');
    expect(new EmbedBuilder({ title: 'abc', fields: [{ name: 'n', value: 'vv' }] }).length).toBe(6);
  });
});

describe('Colors', () => {
  it('resolves names, hex, rgb and numbers', () => {
    expect(resolveColor('Red')).toBe(0xed4245);
    expect(resolveColor('#ff8800')).toBe(0xff8800);
    expect(resolveColor('#f80')).toBe(0xff8800);
    expect(resolveColor([255, 136, 0])).toBe(0xff8800);
    expect(resolveColor(0x123456)).toBe(0x123456);
    expect(resolveColor('Random')).toBeLessThanOrEqual(0xffffff);
    expect(() => resolveColor(0x1000000)).toThrow(/Invalid color/);
    expect(() => resolveColor('Nope' as never)).toThrow(/Invalid color/);
    expect(() => resolveColor([256, 0, 0])).toThrow(StrafeRangeError);
  });
});

describe('AttachmentBuilder', () => {
  it('takes its name from paths and URLs', () => {
    expect(new AttachmentBuilder('./files/report.pdf').name).toBe('report.pdf');
    expect(new AttachmentBuilder('https://x.test/a/chart.png?v=2').name).toBe('chart.png');
    expect(new AttachmentBuilder(new Uint8Array([1]), { name: 'a.bin' }).setSize(10, 20).toJSON()).toEqual({
      attachment: new Uint8Array([1]),
      name: 'a.bin',
      width: 10,
      height: 20,
    });
    expect(new AttachmentBuilder(new Uint8Array([1])).setName('b.txt').name).toBe('b.txt');
  });
});

describe('Options and LimitedCollection', () => {
  it('evicts the oldest entry past the limit, keeping protected ones', () => {
    const c = new LimitedCollection<string, number>({ maxSize: 2, keepOverLimit: (v) => v === 1 });
    c.set('a', 1).set('b', 2).set('c', 3);
    expect([...c.keys()]).toEqual(['a', 'c']);
    const none = new LimitedCollection<string, number>({ maxSize: 0 });
    none.set('x', 1);
    expect(none.size).toBe(0);
  });

  it('builds caches per manager', () => {
    const factory = Options.cacheWithLimits({ MessageManager: 2, UserManager: Infinity, ReactionManager: { maxSize: 1 } });
    expect(factory('MessageManager')).toBeInstanceOf(LimitedCollection);
    expect(factory('UserManager')).not.toBeInstanceOf(LimitedCollection);
    expect((factory('ReactionManager') as LimitedCollection<string, unknown>).maxSize).toBe(1);
    expect(factory('SpaceManager')).not.toBeInstanceOf(LimitedCollection);
    expect(Options.cacheEverything()('MessageManager')).not.toBeInstanceOf(LimitedCollection);
  });
});
