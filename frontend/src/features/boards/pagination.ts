/**
 * 게시판마다 같은 크기로 목록을 나누고 삭제 후 페이지 범위를 보정한다.
 * @author seulgae
 * @version 1.0, 게시판 5건 페이지 계산
 * @see "None"
 */
export const BOARD_PAGE_SIZE = 5

/** 목록이 줄어들면 마지막 유효 페이지를 사용한다. */
export function listPage<T>(items: readonly T[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(items.length / BOARD_PAGE_SIZE))
  const page = Math.max(0, Math.min(requestedPage, pages - 1))
  return { items: items.slice(page * BOARD_PAGE_SIZE, (page + 1) * BOARD_PAGE_SIZE), page, pages }
}
