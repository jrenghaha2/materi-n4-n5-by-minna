import { useCallback, useRef } from 'react';
import type React from 'react';

export const CARD_DRAG_THRESHOLD_PX = 6;

export interface FlipDecisionInput {
  isInteractiveTarget: boolean;
  hadSelectionOnPointerDown: boolean;
  currentSelectionText: string;
  startPoint: { x: number; y: number } | null;
  endPoint: { x: number; y: number };
  clickDetail?: number;
  dragThresholdPx?: number;
}

/**
 * Pure decision helper determining whether a click anywhere on a flashcard
 * should flip the card, while preserving text selection (blocking/dragging)
 * and interactive child controls (audio buttons, flip buttons, links, inputs).
 */
export function shouldFlipOnCardClick({
  isInteractiveTarget,
  hadSelectionOnPointerDown,
  currentSelectionText,
  startPoint,
  endPoint,
  clickDetail = 1,
  dragThresholdPx = CARD_DRAG_THRESHOLD_PX,
}: FlipDecisionInput): boolean {
  if (isInteractiveTarget) return false;
  if (clickDetail > 1) return false;
  if (hadSelectionOnPointerDown) return false;
  if (currentSelectionText.trim().length > 0) return false;

  if (startPoint) {
    const distance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    if (distance > dragThresholdPx) return false;
  }

  return true;
}

function getSelectedText(): string {
  if (typeof window === 'undefined' || !window.getSelection) return '';
  return window.getSelection()?.toString() ?? '';
}

function isInsideInteractiveElement(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return Boolean(
    (target as Element).closest('button, a, input, select, textarea, [data-no-flip="true"]')
  );
}

/**
 * Reusable pointer + click handlers for flippable flashcard faces:
 * - Click/tap anywhere on front or back face flips the card
 * - Dragging to highlight/block text (Kanji, Kana, meaning, examples) never flips
 * - Clicking while text is selected clears selection without flipping
 * - Clicking nested buttons (AudioButton, Depan button) never double-flips
 */
export function useCardFlipHandlers(onFlip: () => void) {
  const pointerDownRef = useRef<{
    x: number;
    y: number;
    hadSelection: boolean;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') {
      pointerDownRef.current = null;
      return;
    }
    pointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      hadSelection: getSelectedText().trim().length > 0,
    };
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const start = pointerDownRef.current;
      pointerDownRef.current = null;

      const allowFlip = shouldFlipOnCardClick({
        isInteractiveTarget: isInsideInteractiveElement(e.target),
        hadSelectionOnPointerDown: start?.hadSelection ?? false,
        currentSelectionText: getSelectedText(),
        startPoint: start ? { x: start.x, y: start.y } : null,
        endPoint: { x: e.clientX, y: e.clientY },
        clickDetail: e.detail,
      });

      if (allowFlip) {
        onFlip();
      }
    },
    [onFlip]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onFlip();
      }
    },
    [onFlip]
  );

  return { onPointerDown, onClick, onKeyDown };
}
