import test from 'node:test'
import assert from 'node:assert/strict'
import { GUESTBOOK_CONTENT_MAX, GUESTBOOK_TITLE_MAX, charCount, clip, validEntry } from '../src/features/guestbook/guestbookApi.ts'

test('방명록: 제목 8자, 내용 130자 제한(앞뒤 공백 제외, 이모지도 한 글자)', () => {
  assert.equal(GUESTBOOK_TITLE_MAX, 8)
  assert.equal(GUESTBOOK_CONTENT_MAX, 130)
  assert.equal(charCount('  안녕  '), 2)
  assert.equal(charCount('😀😀'), 2)
  assert.equal(validEntry('12345678', '가'.repeat(130)), true)
  assert.equal(validEntry('123456789', '내용'), false)
  assert.equal(validEntry('제목', '가'.repeat(131)), false)
  assert.equal(validEntry('   ', '내용'), false)
  assert.equal(validEntry('제목', ' '), false)
})

test('방명록: 입력은 최대 글자 수에서 잘린다', () => {
  assert.equal(clip('안녕하세요반가워요!!', 8), '안녕하세요반가워')
  assert.equal(clip('😀'.repeat(10), 8), '😀'.repeat(8))
  assert.equal(clip('짧은 글', 8), '짧은 글')
})
