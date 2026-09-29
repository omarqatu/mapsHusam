import { describe, expect, it } from 'vitest';
import { youtubeId } from './featureModel';

const ID = 'dQw4w9WgXcQ';
describe('youtubeId', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?feature=share&v=${ID}&t=5`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
  ])('reads %s', (url) => expect(youtubeId(url)).toBe(ID));

  it.each([
    'https://www.facebook.com/watch/?v=123456789012',
    'https://www.youtube.com/@channel',
    'https://www.youtube.com/watch?v=short',
    'https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ',
    'not a url',
  ])('ignores %s', (url) => expect(youtubeId(url)).toBeNull());
});
