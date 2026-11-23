import { describe, expect, it } from 'vitest'
import { embedUrl, youtubeId } from '../src/lib/youtube'

describe('youtubeId: any link the studio might paste', () => {
  const id = 'dQw4w9WgXcQ'
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abcDEF123`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}?feature=share`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `www.youtube.com/watch?v=${id}`,
    `  ${id}  `,
  ])('%s', (url) => expect(youtubeId(url)).toBe(id))
  it.each(['', 'hello', 'https://vimeo.com/12345', 'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/@tplum'])('rejects %s', (url) => expect(youtubeId(url)).toBeNull())
  it('plays privately and straight away', () => {
    expect(embedUrl(id)).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1&rel=0/)
  })
})
