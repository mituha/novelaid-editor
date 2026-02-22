import { useEffect, useCallback, RefObject } from 'react';

/**
 * textarea の高さを内容に合わせて自動調整するフック
 * @param ref textarea への ref
 * @param value 監視する値（通常は input の内容）
 */
export function useAutoResize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  const resize = useCallback(() => {
    const element = ref.current;
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [ref]);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return resize;
}
